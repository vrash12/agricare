from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .otp_service import send_approval_email
from .permissions import IsAdmin, IsApplicationUser, WORKER_ROLES
from rest_framework.exceptions import NotFound, ValidationError, PermissionDenied
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
import hashlib
from . import firebase_service as store
from .firebase_service import (
    get_all_farmers, get_all_extension_workers, get_user_by_id,
    delete_user, toggle_user_active, approve_extension_worker, update_user,
    get_notifications, mark_notification_read, mark_all_notifications_read, broadcast_admin_update,
    create_notification, notify_user_ws, get_all_admins
)

ADMIN_ACCOUNT_FIELDS = ('id', 'firstName', 'lastName', 'role', 'email', 'mobileNumber',
                        'barangay', 'username', 'isActive', 'isPending', 'positionId',
                        'profilePicture', 'date')
DIRECTORY_FIELDS = ('id', 'firstName', 'lastName', 'username', 'role', 'positionId',
                    'profilePicture', 'isActive', 'isPending')


def account_data(user, admin=False):
    fields = ADMIN_ACCOUNT_FIELDS if admin else DIRECTORY_FIELDS
    return {key: user[key] for key in fields if key in user}


def account_for_role(user_id, roles):
    user = get_user_by_id(user_id)
    if not user or user.get('role') not in roles:
        raise NotFound('Account not found')
    return user


class FarmerListView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        farmers = get_all_farmers()
        return Response([account_data(user, admin=True) for user in farmers])

class FarmerDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, user_id):
        user = account_for_role(user_id, {'farmer'})
        if not user:
            return Response({'error': 'Farmer not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role != 'admin' and (not user.get('isActive', True) or user.get('isPending')):
            raise NotFound('Account not found')
        return Response(account_data(user, admin=request.user.role == 'admin'))

    def delete(self, request, user_id):
        user = account_for_role(user_id, {'farmer'})
        if not user:
            return Response({'error': 'Farmer not found'}, status=status.HTTP_404_NOT_FOUND)
        delete_user(user_id)
        broadcast_admin_update('farmer_updated')
        return Response({'message': 'Farmer deleted successfully'})

class FarmerToggleActiveView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, user_id):
        user = account_for_role(user_id, {'farmer'})
        if not user:
            return Response({'error': 'Farmer not found'}, status=status.HTTP_404_NOT_FOUND)
        toggle_user_active(user_id)
        broadcast_admin_update('farmer_updated')
        return Response({'message': 'Farmer status updated'})


def personnel_data(data, existing=None):
    fields = ('firstName', 'lastName', 'username', 'email', 'mobileNumber', 'barangay', 'positionId')
    result = {key: str(data.get(key, '')).strip() for key in fields}
    result['email'] = result['email'].lower()
    if any(not result[key] for key in ('firstName', 'lastName', 'username', 'email', 'mobileNumber')):
        raise ValidationError({'error': 'Name, username, email and mobile number are required.'})
    try:
        validate_email(result['email'])
    except DjangoValidationError:
        raise ValidationError({'error': 'Enter a valid email address.'})
    for key, lookup in [('username', store.get_user_by_username), ('email', store.get_user_by_email), ('mobileNumber', store.get_user_by_mobile)]:
        match = lookup(result[key])
        if match and match['id'] != (existing or {}).get('id'):
            raise ValidationError({'error': f'{key} is already in use.'})
    if result['positionId'] and not any(p['id'] == result['positionId'] and p.get('isActive', True) for p in store.get_all_positions()):
        raise ValidationError({'error': 'Choose an active position.'})
    return result

class ExtensionWorkerListView(APIView):
    def get_permissions(self):
        return [IsAuthenticated(), IsApplicationUser() if self.request.method == 'GET' else IsAdmin()]

    def post(self, request):
        data = personnel_data(request.data)
        password = request.data.get('password', '')
        if not isinstance(password, str) or len(password) < 8:
            raise ValidationError({'error': 'An initial password of at least 8 characters is required.'})
        data.update(role='extension_worker', isPending=False, passwordHash=hashlib.sha256(password.encode()).hexdigest())
        user_id = store.create_user(data)
        broadcast_admin_update('worker_updated')
        return Response({'id': user_id}, status=201)

    def get(self, request):
        workers = get_all_extension_workers()
        if request.user.role != 'admin':
            workers = [worker for worker in workers if worker.get('isActive', True) and not worker.get('isPending')]
        return Response([account_data(worker, admin=request.user.role == 'admin') for worker in workers])

class ExtensionWorkerDetailView(APIView):
    def patch(self, request, user_id):
        existing = account_for_role(user_id, WORKER_ROLES)
        data = personnel_data({**existing, **request.data}, existing)
        # Email is a login identity when linked to Supabase; do not desynchronise it.
        if existing.get('supabaseId') and data['email'] != existing.get('email'):
            raise ValidationError({'error': 'Linked login emails must be changed through the authentication provider.'})
        update_user(user_id, data)
        broadcast_admin_update('worker_updated')
        return Response(account_data({**existing, **data}, admin=True))

    def get_permissions(self):
        return [IsAuthenticated(), IsApplicationUser() if self.request.method == 'GET' else IsAdmin()]

    def get(self, request, user_id):
        user = account_for_role(user_id, WORKER_ROLES)
        if not user:
            return Response({'error': 'Extension worker not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.role != 'admin' and (not user.get('isActive', True) or user.get('isPending')):
            raise NotFound('Account not found')
        return Response(account_data(user, admin=request.user.role == 'admin'))

    def delete(self, request, user_id):
        user = account_for_role(user_id, WORKER_ROLES)
        if not user:
            return Response({'error': 'Extension worker not found'}, status=status.HTTP_404_NOT_FOUND)
        delete_user(user_id)
        broadcast_admin_update('worker_updated')
        return Response({'message': 'Extension worker deleted successfully'})

class ExtensionWorkerToggleActiveView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, user_id):
        user = account_for_role(user_id, WORKER_ROLES)
        if not user:
            return Response({'error': 'Extension worker not found'}, status=status.HTTP_404_NOT_FOUND)
        toggle_user_active(user_id)
        broadcast_admin_update('worker_updated')
        return Response({'message': 'Extension worker status updated'})

class ExtensionWorkerApproveView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, user_id):
        user = account_for_role(user_id, WORKER_ROLES)
        if not user:
            return Response({'error': 'Extension worker not found'}, status=status.HTTP_404_NOT_FOUND)
        approve_extension_worker(user_id)
        broadcast_admin_update('worker_updated')
        if user.get('email'):
            send_approval_email(user['email'], user['firstName'])
        return Response({'message': 'Extension worker approved'})

class ExtensionWorkerChangePositionView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, user_id):
        position_id = request.data.get('positionId')
        if not position_id:
            return Response({'error': 'Position ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        user = account_for_role(user_id, WORKER_ROLES)
        if not user:
            return Response({'error': 'Extension worker not found'}, status=status.HTTP_404_NOT_FOUND)
        update_user(user_id, {'positionId': position_id})
        broadcast_admin_update('worker_updated')
        return Response({'message': 'Position updated'})

class UploadProfilePictureView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile_picture = request.data.get('profilePicture')
        if not profile_picture:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
        update_user(request.user.id, {'profilePicture': profile_picture})
        return Response({'message': 'Profile picture updated', 'profilePicture': profile_picture})

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = get_notifications(request.user.id)
        return Response([n for n in notifications if not n.get('isArchived')])

class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        mark_notification_read(request.user.id, notification_id)
        return Response({'message': 'Notification marked as read'})

class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        mark_all_notifications_read(request.user.id)
        return Response({'message': 'All notifications marked as read'})

class AllUsersView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        farmers = get_all_farmers()
        workers = get_all_extension_workers()
        admins = get_all_admins()
        users = [
            {'id': u['id'], 'firstName': u['firstName'], 'lastName': u['lastName'], 'role': u['role']}
            for u in farmers + workers + admins
        ]
        return Response(users)

class SendNotificationView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        user_ids = request.data.get('userIds', [])
        notif_type = request.data.get('type', '').strip()
        message = request.data.get('message', '').strip()
        file_data = request.data.get('fileData', '')
        file_name = request.data.get('fileName', '')
        file_type = request.data.get('fileType', '')
        if not user_ids or not notif_type or not message:
            return Response({'error': 'userIds, type, and message are required'}, status=status.HTTP_400_BAD_REQUEST)
        if file_data and len(file_data.encode('utf-8')) > 1048576:
            return Response({'error': 'File must be under 1MB.'}, status=status.HTTP_400_BAD_REQUEST)
        notif = {'type': notif_type, 'message': message}
        for user_id in user_ids:
            create_notification(user_id, notif_type, message, request.user.id, '', file_data, file_name, file_type)
            notify_user_ws(user_id, notif)
        return Response({'message': f'Notification sent to {len(user_ids)} user(s)'})

class NotificationLogsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        action = request.data.get('action')
        if action not in ('clear_read', 'clear_all', 'restore'):
            raise ValidationError({'error': 'Choose a valid log action.'})
        count = 0
        for item in get_notifications(request.user.id):
            archived = bool(item.get('isArchived'))
            if (action == 'restore' and archived) or (action == 'clear_all' and not archived) or (action == 'clear_read' and item.get('isRead') and not archived):
                store.db.collection(store.USERS_COLLECTION).document(request.user.id).collection(store.NOTIFICATIONS_SUBCOLLECTION).document(item['id']).update({'isArchived': action != 'restore'})
                count += 1
        notify_user_ws(request.user.id, {'type': 'logs_updated'})
        return Response({'count': count})
