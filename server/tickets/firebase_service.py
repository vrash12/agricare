from core.firebase import db
from datetime import datetime, timezone, timedelta
from firebase_admin import firestore
from rest_framework.exceptions import NotFound, ValidationError
from .capacity import farmer_participants, ticket_capacity, TicketCapacityReached

TICKETS_COLLECTION = 'tickets'
MESSAGES_SUBCOLLECTION = 'messages'
ANALYTICS_COLLECTION = 'analytics'

STOPWORDS = {
    'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
    'or', 'but', 'my', 'me', 'i', 'we', 'our', 'your', 'their', 'this', 'that',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'with', 'from', 'by', 'about', 'as', 'into', 'through', 'during', 'how',
    'what', 'when', 'where', 'why', 'which', 'who', 'not', 'no', 'so', 'if',
    'its', 'also', 'just', 'very', 'too', 'some', 'any', 'all', 'there', 'then'
}

def extract_keywords(text):
    words = text.lower().split()
    keywords = []
    for word in words:
        cleaned = ''.join(c for c in word if c.isalpha())
        if cleaned and cleaned not in STOPWORDS:
            keywords.append(cleaned)
    return list(set(keywords))

def extract_keywords_combined(title, concern):
    return list(set(extract_keywords(title) + extract_keywords(concern)))

def find_matching_ticket(extension_worker_id, keywords, farmer_id, category_id=None):
    query = db.collection(TICKETS_COLLECTION)
    if category_id:
        docs = query.where('participants', 'array_contains', farmer_id).get()
    else:
        docs = query.where('extensionWorkerId', '==', extension_worker_id).get()
    best_match = None
    best_score = 0
    for doc in docs:
        data = doc.to_dict()
        if category_id and data.get('categoryId') != category_id:
            continue
        if farmer_id not in (data.get('participants') or []) and data.get('farmerId') != farmer_id:
            continue
        if data.get('status') not in ['pending', 'ongoing', 'resolved']:
            continue
        stored = data.get('keywords', [])
        if stored:
            existing_keywords = set(stored)
        else:
            existing_keywords = set(extract_keywords_combined(data.get('title', ''), data.get('concern', '')))
        incoming_keywords = set(keywords)
        overlap = len(existing_keywords & incoming_keywords)
        if overlap > 0 and overlap > best_score:
            best_score = overlap
            best_match = {'id': doc.id, **data}
    return best_match

def create_ticket(data):
    doc_ref = db.collection(TICKETS_COLLECTION).document()
    doc_ref.set({
        'extensionWorkerId': data['extensionWorkerId'],
        'extensionWorkerName': data['extensionWorkerName'],
        'categoryId': data['categoryId'],
        'categoryName': data['categoryName'],
        'title': data['title'],
        'concern': data['concern'],
        'keywords': data['keywords'],
        'status': 'pending',
        'participants': [data['farmerId']],
        'farmerId': data['farmerId'],
        'assignedBy': 'system',
        'assignmentMethod': 'category',
        'assignedAt': datetime.now(timezone.utc).isoformat(),
        'date': datetime.utcnow().isoformat(),
    })
    add_message(doc_ref.id, {
        'senderId': data['farmerId'],
        'senderName': data['farmerName'],
        'senderRole': 'farmer',
        'message': data['concern'],
        'fileData': data.get('fileData', ''),
        'fileName': data.get('fileName', ''),
        'fileType': data.get('fileType', ''),
    })
    return doc_ref.id

def join_ticket(ticket_id, farmer_id):
    """Add an already-authorized farmer atomically; callers must enforce access."""
    if not isinstance(farmer_id, str) or not farmer_id.strip():
        raise ValidationError('A farmer ID is required.')
    ticket_ref = db.collection(TICKETS_COLLECTION).document(ticket_id)
    return firestore.transactional(_join_ticket_transaction)(db.transaction(), ticket_ref, farmer_id)


def _join_ticket_transaction(transaction, ticket_ref, farmer_id):
    ticket = ticket_ref.get(transaction=transaction)
    if not ticket.exists:
        raise NotFound('Ticket not found')
    data = ticket.to_dict()
    participants = farmer_participants(data)
    capacity = ticket_capacity(data)
    if farmer_id in participants:
        return {'joined': False, 'capacity': capacity}
    if capacity['status'] == 'full':
        raise TicketCapacityReached(f"This ticket is full ({capacity['limit']} farmers). Please create a separate ticket.")
    participants.append(farmer_id)
    transaction.update(ticket_ref, {'participants': participants})
    return {'joined': True, 'capacity': ticket_capacity({**data, 'participants': participants})}

def add_message(ticket_id, data):
    doc_ref = db.collection(TICKETS_COLLECTION).document(ticket_id)\
        .collection(MESSAGES_SUBCOLLECTION).document()
    doc_ref.set({
        'senderId': data['senderId'],
        'senderName': data['senderName'],
        'senderRole': data['senderRole'],
        'message': data.get('message', ''),
        'fileData': data.get('fileData', ''),
        'fileName': data.get('fileName', ''),
        'fileType': data.get('fileType', ''),
        'isPinned': False,
        'date': datetime.utcnow().isoformat(),
    })
    return doc_ref.id

def pin_message(ticket_id, message_id):
    ticket_ref = db.collection(TICKETS_COLLECTION).document(ticket_id)
    ticket = ticket_ref.get()
    if not ticket.exists:
        return False
    current_pinned = ticket.to_dict().get('pinnedMessageId', '')
    is_unpin = current_pinned == message_id
    messages = ticket_ref.collection(MESSAGES_SUBCOLLECTION).get()
    for msg in messages:
        msg.reference.update({'isPinned': False if is_unpin else msg.id == message_id})
    ticket_ref.update({'pinnedMessageId': '' if is_unpin else message_id})
    return is_unpin

def delete_message(ticket_id, message_id):
    db.collection(TICKETS_COLLECTION).document(ticket_id)\
        .collection(MESSAGES_SUBCOLLECTION).document(message_id).delete()

def delete_ticket(ticket_id):
    ticket_ref = db.collection(TICKETS_COLLECTION).document(ticket_id)
    messages = ticket_ref.collection(MESSAGES_SUBCOLLECTION).get()
    for msg in messages:
        msg.reference.delete()
    ticket_ref.delete()

def update_ticket_status(ticket_id, new_status):
    db.collection(TICKETS_COLLECTION).document(ticket_id).update({'status': new_status})

def update_ticket_assignment(ticket_id, worker_id, worker_name, assigned_by):
    assignment = {
        'extensionWorkerId': worker_id,
        'extensionWorkerName': worker_name,
        'assignedBy': assigned_by,
        'assignmentMethod': 'admin',
        'assignedAt': datetime.now(timezone.utc).isoformat(),
    }
    db.collection(TICKETS_COLLECTION).document(ticket_id).update(assignment)
    return assignment

def get_all_tickets():
    docs = db.collection(TICKETS_COLLECTION).order_by('date', direction='DESCENDING').get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def get_available_ticket_years():
    docs = db.collection(TICKETS_COLLECTION).get()
    years = set()
    for doc in docs:
        date_str = doc.to_dict().get('date')
        if date_str:
            years.add(datetime.fromisoformat(date_str).year)
    return sorted(years, reverse=True) or [datetime.now(timezone.utc).year]

def get_all_tickets_filtered(week_start_date):
    monday = datetime(
        week_start_date.year, week_start_date.month, week_start_date.day,
        tzinfo=timezone.utc
    )
    sunday = monday + timedelta(days=7)
    docs = db.collection(TICKETS_COLLECTION).get()
    tickets = []
    for doc in docs:
        data = doc.to_dict()
        date_str = data.get('date')
        if not date_str:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        if monday <= date < sunday:
            tickets.append({'id': doc.id, **data})
    return (
        sorted(tickets, key=lambda t: t.get('date', ''), reverse=True),
        monday.strftime('%b %d'),
        (monday + timedelta(days=6)).strftime('%b %d, %Y'),
        monday.month,
        monday.year,
    )

def get_tickets_by_worker(worker_id):
    docs = db.collection(TICKETS_COLLECTION)\
        .where('extensionWorkerId', '==', worker_id).get()
    tickets = [{'id': doc.id, **doc.to_dict()} for doc in docs]
    return sorted(tickets, key=lambda t: t.get('date', ''), reverse=True)

def get_ticket_by_id(ticket_id):
    doc = db.collection(TICKETS_COLLECTION).document(ticket_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None

def get_ticket_messages(ticket_id):
    docs = db.collection(TICKETS_COLLECTION).document(ticket_id)\
        .collection(MESSAGES_SUBCOLLECTION).order_by('date').get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def get_ticket_counts():
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    tickets = db.collection(TICKETS_COLLECTION).get()

    today_count = 0
    weekly_count = 0
    monthly_count = 0

    for ticket in tickets:
        data = ticket.to_dict()
        ticket_date = data.get('date')
        if not ticket_date:
            continue
        if isinstance(ticket_date, str):
            ticket_date = datetime.fromisoformat(ticket_date).replace(tzinfo=timezone.utc)
        if ticket_date >= today_start:
            today_count += 1
        if ticket_date >= week_start:
            weekly_count += 1
        if ticket_date >= month_start:
            monthly_count += 1

    return {
        'today': today_count,
        'weekly': weekly_count,
        'monthly': monthly_count,
    }

def get_knowledge_repository_visits():
    doc = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository').get()
    if doc.exists:
        return doc.to_dict().get('visits', 0)
    return 0

def increment_knowledge_repository_visits():
    ref = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository')
    doc = ref.get()
    now = datetime.now(timezone.utc)
    month_key = now.strftime('%b %Y')
    day_key = now.strftime('%Y-%m-%d')
    if doc.exists:
        data = doc.to_dict()
        monthly = data.get('monthly_visits', {})
        monthly[month_key] = monthly.get(month_key, 0) + 1
        daily = data.get('daily_visits', {})
        daily[day_key] = daily.get(day_key, 0) + 1
        ref.update({'visits': data.get('visits', 0) + 1, 'monthly_visits': monthly, 'daily_visits': daily})
    else:
        ref.set({'visits': 1, 'monthly_visits': {month_key: 1}, 'daily_visits': {day_key: 1}})


def get_tickets_by_farmer(farmer_id):
    docs = db.collection(TICKETS_COLLECTION).where('participants', 'array_contains', farmer_id).get()
    return sorted([{'id': doc.id, **doc.to_dict()} for doc in docs],
                  key=lambda ticket: ticket.get('date', ''), reverse=True)


def get_message_by_id(ticket_id, message_id):
    doc = db.collection(TICKETS_COLLECTION).document(ticket_id).collection(MESSAGES_SUBCOLLECTION).document(message_id).get()
    return {'id': doc.id, **doc.to_dict()} if doc.exists else None
