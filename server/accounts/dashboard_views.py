from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import IsAdmin
from accounts.firebase_service import get_user_by_identifier
from core.firebase import db
from tickets.firebase_service import get_ticket_counts, get_knowledge_repository_visits
from datetime import datetime, timezone, timedelta

USERS_COLLECTION = 'users'
TICKETS_COLLECTION = 'tickets'
ANALYTICS_COLLECTION = 'analytics'

def get_worker_counts():
    docs = db.collection(USERS_COLLECTION).where('role', '==', 'extension_worker').get()
    active = 0
    inactive = 0
    for doc in docs:
        data = doc.to_dict()
        if data.get('isPending'):
            continue
        if data.get('isActive'):
            active += 1
        else:
            inactive += 1
    analytics_doc = db.collection('analytics').document('extension_workers').get()
    deleted = analytics_doc.to_dict().get('deleted', 0) if analytics_doc.exists else 0
    total = active + inactive
    return {'active': active, 'inactive': inactive, 'deleted': deleted, 'total': total}

def get_last_6_months_labels():
    now = datetime.now(timezone.utc)
    labels = []
    starts = []
    for i in range(5, -1, -1):
        month = (now.month - i - 1) % 12 + 1
        year = now.year + ((now.month - i - 1) // 12)
        labels.append(datetime(year, month, 1).strftime('%b %Y'))
        starts.append(datetime(year, month, 1, tzinfo=timezone.utc))
    return labels, starts

def get_monthly_ticket_counts():
    labels, starts = get_last_6_months_labels()
    tickets = db.collection(TICKETS_COLLECTION).get()
    counts = [0] * 6
    for ticket in tickets:
        date_str = ticket.to_dict().get('date')
        if not date_str:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        for i in range(5):
            if starts[i] <= date < starts[i + 1]:
                counts[i] += 1
                break
        else:
            if date >= starts[5]:
                counts[5] += 1
    return labels, counts

def get_available_ticket_years():
    tickets = db.collection(TICKETS_COLLECTION).get()
    years = set()
    for ticket in tickets:
        date_str = ticket.to_dict().get('date')
        if date_str:
            years.add(datetime.fromisoformat(date_str).year)
    return sorted(years, reverse=True)

def get_monthly_tickets_by_position():
    labels, starts = get_last_6_months_labels()

    positions_docs = db.collection('positions').get()
    positions = {doc.id: doc.to_dict().get('name', 'Unknown') for doc in positions_docs}

    workers_docs = db.collection(USERS_COLLECTION).where('role', '==', 'extension_worker').get()
    worker_position = {}
    for doc in workers_docs:
        data = doc.to_dict()
        pos_id = data.get('positionId', '')
        worker_position[doc.id] = positions.get(pos_id, 'Unknown')

    position_names = sorted(set(worker_position.values()))
    matrix = {label: {pos: 0 for pos in position_names} for label in labels}

    tickets = db.collection(TICKETS_COLLECTION).get()
    for ticket in tickets:
        data = ticket.to_dict()
        date_str = data.get('date')
        worker_id = data.get('extensionWorkerId', '')
        if not date_str or worker_id not in worker_position:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        pos_name = worker_position[worker_id]
        for i in range(5):
            if starts[i] <= date < starts[i + 1]:
                matrix[labels[i]][pos_name] += 1
                break
        else:
            if date >= starts[5]:
                matrix[labels[5]][pos_name] += 1

    return labels, position_names, matrix

def get_monthly_tickets_by_position_year(year):
    positions_docs = db.collection('positions').get()
    positions = {doc.id: doc.to_dict().get('name', 'Unknown') for doc in positions_docs}

    workers_docs = db.collection(USERS_COLLECTION).where('role', '==', 'extension_worker').get()
    worker_position = {}
    for doc in workers_docs:
        data = doc.to_dict()
        pos_id = data.get('positionId', '')
        worker_position[doc.id] = positions.get(pos_id, 'Unknown')

    position_names = sorted(set(worker_position.values()))
    labels = [datetime(year, m, 1).strftime('%b %Y') for m in range(1, 13)]
    matrix = {label: {pos: 0 for pos in position_names} for label in labels}

    tickets = db.collection(TICKETS_COLLECTION).get()
    for ticket in tickets:
        data = ticket.to_dict()
        date_str = data.get('date')
        worker_id = data.get('extensionWorkerId', '')
        if not date_str or worker_id not in worker_position:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        if date.year != year:
            continue
        label = date.strftime('%b %Y')
        matrix[label][worker_position[worker_id]] += 1

    return labels, position_names, matrix


def get_available_farmer_years():
    farmers = db.collection(USERS_COLLECTION).where('role', '==', 'farmer').get()
    years = set()
    for farmer in farmers:
        date_str = farmer.to_dict().get('date')
        if date_str:
            years.add(datetime.fromisoformat(date_str).year)
    return sorted(years, reverse=True)

def get_monthly_farmer_counts():
    labels, starts = get_last_6_months_labels()
    farmers = db.collection(USERS_COLLECTION).where('role', '==', 'farmer').get()
    counts = [0] * 6
    for farmer in farmers:
        date_str = farmer.to_dict().get('date')
        if not date_str:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        for i in range(5):
            if starts[i] <= date < starts[i + 1]:
                counts[i] += 1
                break
        else:
            if date >= starts[5]:
                counts[5] += 1
    return labels, counts

def get_monthly_farmer_counts_year(year):
    labels = [datetime(year, m, 1).strftime('%b %Y') for m in range(1, 13)]
    farmers = db.collection(USERS_COLLECTION).where('role', '==', 'farmer').get()
    counts = {label: 0 for label in labels}
    for farmer in farmers:
        date_str = farmer.to_dict().get('date')
        if not date_str:
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        if date.year != year:
            continue
        counts[date.strftime('%b %Y')] += 1
    return labels, [counts[l] for l in labels]

def get_monthly_visit_counts():
    labels, starts = get_last_6_months_labels()
    doc = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository').get()
    monthly_visits = doc.to_dict().get('monthly_visits', {}) if doc.exists else {}
    counts = []
    for label in labels:
        counts.append(monthly_visits.get(label, 0))
    return labels, counts

def get_available_visit_years():
    doc = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository').get()
    if not doc.exists:
        return [datetime.now(timezone.utc).year]
    daily = doc.to_dict().get('daily_visits', {})
    years = set()
    for key in daily:
        try:
            years.add(datetime.strptime(key, '%Y-%m-%d').year)
        except ValueError:
            pass
    if not years:
        years.add(datetime.now(timezone.utc).year)
    return sorted(years, reverse=True)

def get_visit_log_weekly(week_offset=0):
    now = datetime.now(timezone.utc)
    current_monday = now - timedelta(days=now.weekday())
    monday = (current_monday + timedelta(weeks=week_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
    days = [monday + timedelta(days=i) for i in range(7)]
    day_keys = [d.strftime('%Y-%m-%d') for d in days]
    day_names = [d.strftime('%a %b %d') for d in days]

    doc = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository').get()
    daily = doc.to_dict().get('daily_visits', {}) if doc.exists else {}

    rows = [[name, daily.get(key, 0)] for name, key in zip(day_names, day_keys)]
    return rows, monday.strftime('%b %d'), (monday + timedelta(days=6)).strftime('%b %d, %Y')

def get_visit_log_monthly(year):
    doc = db.collection(ANALYTICS_COLLECTION).document('knowledge_repository').get()
    monthly = doc.to_dict().get('monthly_visits', {}) if doc.exists else {}
    labels = [datetime(year, m, 1).strftime('%b %Y') for m in range(1, 13)]
    rows = [[label, monthly.get(label, 0)] for label in labels]
    return rows

def get_available_worker_log_years():
    logs = db.collection('worker_logs').get()
    years = set()
    for log in logs:
        date_str = log.to_dict().get('date')
        if date_str:
            years.add(datetime.fromisoformat(date_str).year)
    if not years:
        years.add(datetime.now(timezone.utc).year)
    return sorted(years, reverse=True)

def get_worker_log_weekly(year, week_offset=0):
    now = datetime.now(timezone.utc)
    current_monday = now - timedelta(days=now.weekday())
    monday = (current_monday + timedelta(weeks=week_offset)).replace(hour=0, minute=0, second=0, microsecond=0)
    days = [monday + timedelta(days=i) for i in range(7)]
    day_names = [d.strftime('%a %b %d') for d in days]

    logs = db.collection('worker_logs').get()
    matrix = {name: {'online': 0, 'offline': 0, 'deleted': 0} for name in day_names}

    for log in logs:
        data = log.to_dict()
        date_str = data.get('date')
        event_type = data.get('type')
        if not date_str or event_type not in ('online', 'offline', 'deleted'):
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        for i, day in enumerate(days):
            day_end = day + timedelta(days=1)
            if day <= date < day_end:
                matrix[day_names[i]][event_type] += 1
                break

    rows = []
    for name in day_names:
        m = matrix[name]
        rows.append([name, m['online'], m['offline'], m['deleted'], m['online'] + m['offline'] + m['deleted']])
    return rows, monday.strftime('%b %d'), (monday + timedelta(days=6)).strftime('%b %d, %Y')

def get_worker_log_monthly(year):
    month_names = [datetime(year, m, 1).strftime('%b %Y') for m in range(1, 13)]
    logs = db.collection('worker_logs').get()
    matrix = {name: {'online': 0, 'offline': 0, 'deleted': 0} for name in month_names}

    for log in logs:
        data = log.to_dict()
        date_str = data.get('date')
        event_type = data.get('type')
        if not date_str or event_type not in ('online', 'offline', 'deleted'):
            continue
        date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        if date.year != year:
            continue
        label = date.strftime('%b %Y')
        if label in matrix:
            matrix[label][event_type] += 1

    rows = []
    for name in month_names:
        m = matrix[name]
        rows.append([name, m['online'], m['offline'], m['deleted'], m['online'] + m['offline'] + m['deleted']])
    return rows


def get_farmer_ticket_stats(farmer_id):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    tickets = db.collection(TICKETS_COLLECTION)\
        .where('participants', 'array_contains', farmer_id).get()
    total = pending = resolved = today_count = weekly_count = monthly_count = 0
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    for t in tickets:
        data = t.to_dict()
        total += 1
        if data.get('status') == 'pending': pending += 1
        if data.get('status') == 'resolved': resolved += 1
        date_str = data.get('date')
        if date_str:
            date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
            if date >= today_start: today_count += 1
            if date >= week_start: weekly_count += 1
            if date >= month_start: monthly_count += 1
    return {'total': total, 'pending': pending, 'resolved': resolved,
            'today': today_count, 'weekly': weekly_count, 'monthly': monthly_count}

def get_worker_ticket_stats(worker_id):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    tickets = db.collection(TICKETS_COLLECTION)\
        .where('extensionWorkerId', '==', worker_id).get()
    total = pending = resolved = today_count = weekly_count = monthly_count = 0
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    for t in tickets:
        data = t.to_dict()
        total += 1
        if data.get('status') == 'pending': pending += 1
        if data.get('status') == 'resolved': resolved += 1
        date_str = data.get('date')
        if date_str:
            date = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
            if date >= today_start: today_count += 1
            if date >= week_start: weekly_count += 1
            if date >= month_start: monthly_count += 1
    return {'total': total, 'pending': pending, 'resolved': resolved,
            'today': today_count, 'weekly': weekly_count, 'monthly': monthly_count}


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        workers = get_worker_counts()
        tickets = get_ticket_counts()
        visits = get_knowledge_repository_visits()
        return Response({
            'workers': {'active': workers['active'], 'inactive': workers['inactive']},
            'tickets': {'today': tickets['today'], 'weekly': tickets['weekly'], 'monthly': tickets['monthly']},
            'knowledgeRepositoryVisits': visits,
        })


class FarmerDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = get_farmer_ticket_stats(request.user.id)
        return Response(stats)


class WorkerDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = get_worker_ticket_stats(request.user.id)
        return Response(stats)


class ReportsStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        workers = get_worker_counts()
        ticket_labels, ticket_counts = get_monthly_ticket_counts()
        farmer_labels, farmer_counts = get_monthly_farmer_counts()
        visit_labels, visit_counts = get_monthly_visit_counts()
        pos_labels, positions, ticket_matrix = get_monthly_tickets_by_position()
        available_years = get_available_ticket_years()
        available_worker_years = get_available_worker_log_years()
        available_farmer_years = get_available_farmer_years()
        available_visit_years = get_available_visit_years()
        return Response({
            'workers': workers,
            'tickets': {'labels': ticket_labels, 'data': ticket_counts},
            'ticketsByPosition': {'months': pos_labels, 'positions': positions, 'matrix': ticket_matrix},
            'farmers': {'labels': farmer_labels, 'data': farmer_counts},
            'visits': {'labels': visit_labels, 'data': visit_counts},
            'availableYears': available_years,
            'availableWorkerYears': available_worker_years,
            'availableFarmerYears': available_farmer_years,
            'availableVisitYears': available_visit_years,
        })


class TicketsByPositionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        try:
            year = int(request.query_params.get('year', datetime.now().year))
        except ValueError:
            year = datetime.now().year
        labels, positions, matrix = get_monthly_tickets_by_position_year(year)
        return Response({'months': labels, 'positions': positions, 'matrix': matrix})


class WorkerLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        mode = request.query_params.get('mode', 'weekly')
        try:
            year = int(request.query_params.get('year', datetime.now().year))
        except ValueError:
            year = datetime.now().year
        if mode == 'monthly':
            rows = get_worker_log_monthly(year)
            return Response({'rows': rows, 'year': year})
        else:
            try:
                week_offset = int(request.query_params.get('week_offset', 0))
            except ValueError:
                week_offset = 0
            rows, week_start, week_end = get_worker_log_weekly(year, week_offset)
            return Response({'rows': rows, 'weekLabel': f'{week_start} – {week_end}'})


class OnlineWorkersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        docs = db.collection(USERS_COLLECTION).where('role', '==', 'extension_worker').get()
        workers = []
        for doc in docs:
            data = doc.to_dict()
            if data.get('isPending') or not data.get('isActive'):
                continue
            workers.append({
                'id': doc.id,
                'name': f"{data.get('firstName', '')} {data.get('lastName', '')}".strip(),
                'position': data.get('positionId', ''),
            })
        position_docs = {d.id: d.to_dict().get('name', '') for d in db.collection('positions').get()}
        for w in workers:
            w['position'] = position_docs.get(w['position'], 'Unknown')
        return Response({'workers': workers})


class FarmersByMonthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        try:
            year = int(request.query_params.get('year', datetime.now().year))
        except ValueError:
            year = datetime.now().year
        labels, counts = get_monthly_farmer_counts_year(year)
        return Response({'labels': labels, 'data': counts})


class VisitsLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        mode = request.query_params.get('mode', 'weekly')
        try:
            year = int(request.query_params.get('year', datetime.now().year))
        except ValueError:
            year = datetime.now().year
        if mode == 'monthly':
            rows = get_visit_log_monthly(year)
            return Response({'rows': rows})
        else:
            try:
                week_offset = int(request.query_params.get('week_offset', 0))
            except ValueError:
                week_offset = 0
            rows, week_start, week_end = get_visit_log_weekly(week_offset)
            return Response({'rows': rows, 'weekLabel': f'{week_start} – {week_end}'})
