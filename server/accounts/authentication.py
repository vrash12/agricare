from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.authentication import BaseAuthentication
from .firebase_service import get_user_by_id, get_user_by_email
from core.supabase import supabase
from types import SimpleNamespace
import os

class FirebaseUser:
    def __init__(self, user_data):
        self.id = user_data['id']
        self.role = user_data.get('role')
        self.is_authenticated = True
        self.is_active = user_data.get('isActive', True)
        self.is_pending = user_data.get('isPending', False)
        self.position_id = user_data.get('positionId', '')

class FirebaseJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None

    def get_user(self, validated_token):
        user_id = validated_token.get('user_id')
        if not user_id:
            if (validated_token.get('role') == 'superadmin'
                    and os.getenv('SUPERADMIN_USERNAME')
                    and validated_token.get('username') == os.getenv('SUPERADMIN_USERNAME')):
                return SimpleNamespace(id='system-admin', role='superadmin',
                                       is_authenticated=True, is_active=True, is_pending=False)
            return None
        user_data = get_user_by_id(user_id)
        if not user_data or not user_data.get('isActive', True) or user_data.get('isPending'):
            return None
        return FirebaseUser(user_data)

class SupabaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        try:
            res = supabase.auth.get_user(token)
            if res.user is None:
                return None
            user_data = get_user_by_email(res.user.email)
            if (not user_data or not user_data.get('isActive', True) or user_data.get('isPending')
                    or user_data.get('supabaseId') != res.user.id):
                return None
            return (FirebaseUser(user_data), token)
        except Exception:
            return None

