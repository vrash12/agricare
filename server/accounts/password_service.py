import hashlib
import hmac
import os

from supabase import create_client

from core.supabase import supabase
from .firebase_service import update_user


def password_hash(password):
    """Match the existing two-round SHA-256 format used by custom login."""
    first = hashlib.sha256(password.encode('utf-8')).hexdigest()
    return hashlib.sha256(first.encode('utf-8')).hexdigest()


def current_password_is_valid(user, password):
    stored = user.get('passwordHash') or ''
    if stored and hmac.compare_digest(stored, password_hash(password)):
        return True

    # Older Supabase registrations saved only the first SHA-256 round.
    if user.get('supabaseId') and stored:
        first = hashlib.sha256(password.encode('utf-8')).hexdigest()
        if hmac.compare_digest(stored, first):
            return True

    if not user.get('supabaseId') or not user.get('email'):
        return False

    try:
        auth = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_ANON_KEY'])
        result = auth.auth.sign_in_with_password({'email': user['email'], 'password': password})
        return result.user is not None and result.user.id == user['supabaseId']
    except Exception:
        return False


def update_password(user, new_password):
    """Keep Firestore and Supabase credentials aligned for dual-auth accounts."""
    old_hash = user.get('passwordHash') or ''
    new_hash = password_hash(new_password)
    if old_hash and hmac.compare_digest(old_hash, new_hash):
        raise ValueError('Choose a password you have not used for this account.')

    update_user(user['id'], {'passwordHash': new_hash, 'isResetPass': False})
    if user.get('supabaseId'):
        try:
            supabase.auth.admin.update_user_by_id(user['supabaseId'], {'password': new_password})
        except Exception:
            update_user(user['id'], {'passwordHash': old_hash})
            raise
