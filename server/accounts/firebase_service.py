from core.firebase import db
from datetime import datetime

USERS_COLLECTION = 'users'
ROLES_COLLECTION = 'roles'
POSITIONS_COLLECTION = 'positions'
NOTIFICATIONS_SUBCOLLECTION = 'notifications'

def get_user_by_username(username):
    docs = db.collection(USERS_COLLECTION).where('username', '==', username).limit(1).get()
    for doc in docs:
        return {'id': doc.id, **doc.to_dict()}
    return None

def get_user_by_mobile(mobile_number):
    docs = db.collection(USERS_COLLECTION).where('mobileNumber', '==', mobile_number).limit(1).get()
    for doc in docs:
        return {'id': doc.id, **doc.to_dict()}
    return None

def get_user_by_id(user_id):
    doc = db.collection(USERS_COLLECTION).document(user_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None

def get_user_by_email(email):
    docs = db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get()
    for doc in docs:
        return {'id': doc.id, **doc.to_dict()}
    return None

def create_user(data):
    doc_ref = db.collection(USERS_COLLECTION).document()
    doc_ref.set({
        'firstName': data['firstName'],
        'lastName': data['lastName'],
        'barangay': data.get('barangay', ''),
        'username': data['username'],
        'mobileNumber': data['mobileNumber'],
        'email': data.get('email', ''),
        'passwordHash': data['passwordHash'],
        'role': data['role'],
        'isActive': True,
        'isResetPass': False,
        'isPending': data.get('isPending', False),
        'positionId': data.get('positionId', ''),
        'supabaseId': data.get('supabaseId', ''),
        'date': datetime.utcnow().isoformat(),
    })
    return doc_ref.id

def update_user(user_id, data):
    db.collection(USERS_COLLECTION).document(user_id).update(data)

def get_user_by_identifier(identifier):
    user = get_user_by_username(identifier)
    if not user:
        user = get_user_by_mobile(identifier)
    if not user:
        user = get_user_by_email(identifier)
    return user

def get_all_positions():
    docs = db.collection(POSITIONS_COLLECTION).get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def get_position_by_id(position_id):
    doc = db.collection(POSITIONS_COLLECTION).document(position_id).get()
    if doc.exists:
        return {'id': doc.id, **doc.to_dict()}
    return None

def create_position(data):
    doc_ref = db.collection(POSITIONS_COLLECTION).document()
    doc_ref.set({
        'name': data['name'],
        'isActive': True,
    })
    return doc_ref.id

def update_position(position_id, data):
    db.collection(POSITIONS_COLLECTION).document(position_id).update(data)

def delete_position(position_id):
    db.collection(POSITIONS_COLLECTION).document(position_id).delete()

def get_all_farmers():
    docs = db.collection(USERS_COLLECTION).where('role', '==', 'farmer').get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def get_all_extension_workers():
    docs = db.collection(USERS_COLLECTION).where('role', 'in', ['extension_worker', 'lgu_personnel']).get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def log_worker_event(user_id, event_type):
    db.collection('worker_logs').document().set({
        'workerId': user_id,
        'type': event_type,
        'date': datetime.utcnow().isoformat(),
    })

def delete_user(user_id):
    user = get_user_by_id(user_id)
    if user and user.get('role') == 'extension_worker':
        ref = db.collection('analytics').document('extension_workers')
        doc = ref.get()
        if doc.exists:
            ref.update({'deleted': doc.to_dict().get('deleted', 0) + 1})
        else:
            ref.set({'deleted': 1})
        log_worker_event(user_id, 'deleted')
    if user and user.get('supabaseId'):
        try:
            from core.supabase import supabase
            supabase.auth.admin.delete_user(user['supabaseId'])
        except Exception:
            pass
    db.collection(USERS_COLLECTION).document(user_id).delete()

def toggle_user_active(user_id):
    user = get_user_by_id(user_id)
    if user:
        new_state = not user.get('isActive', True)
        db.collection(USERS_COLLECTION).document(user_id).update({'isActive': new_state})
        log_worker_event(user_id, 'online' if new_state else 'offline')

def approve_extension_worker(user_id):
    db.collection(USERS_COLLECTION).document(user_id).update({'isPending': False})

def get_all_admins():
    docs = db.collection(USERS_COLLECTION).where('role', '==', 'admin').get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def create_notification(user_id, notification_type, message, related_user_id='', related_ticket_id='', file_data='', file_name='', file_type=''):
    doc_ref = db.collection(USERS_COLLECTION).document(user_id).collection(NOTIFICATIONS_SUBCOLLECTION).document()
    doc_ref.set({
        'type': notification_type,
        'message': message,
        'relatedUserId': related_user_id,
        'relatedTicketId': related_ticket_id,
        'fileData': file_data,
        'fileName': file_name,
        'fileType': file_type,
        'isRead': False,
        'date': datetime.utcnow().isoformat(),
    })

def get_notifications(user_id):
    docs = db.collection(USERS_COLLECTION).document(user_id).collection(NOTIFICATIONS_SUBCOLLECTION).order_by('date', direction='DESCENDING').get()
    return [{'id': doc.id, **doc.to_dict()} for doc in docs]

def mark_notification_read(user_id, notification_id):
    db.collection(USERS_COLLECTION).document(user_id).collection(NOTIFICATIONS_SUBCOLLECTION).document(notification_id).update({'isRead': True})

def mark_all_notifications_read(user_id):
    docs = db.collection(USERS_COLLECTION).document(user_id).collection(NOTIFICATIONS_SUBCOLLECTION).where('isRead', '==', False).get()
    for doc in docs:
        doc.reference.update({'isRead': True})

def notify_user_ws(user_id, notification):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'notifications_{user_id}',
        {'type': 'send_notification', 'data': notification}
    )

def notify_admins_ws(notification):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()
    admins = get_all_admins()
    for admin in admins:
        async_to_sync(channel_layer.group_send)(
            f'notifications_{admin["id"]}',
            {'type': 'send_notification', 'data': notification}
        )

def broadcast_admin_update(event_type):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'admin_updates',
        {'type': 'admin_update', 'data': {'type': event_type}}
    )

def broadcast_ticket_update():
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'ticket_updates',
        {'type': 'ticket_update', 'data': {'type': 'ticket_update'}}
    )
