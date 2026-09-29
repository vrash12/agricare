from http.cookies import SimpleCookie
from types import SimpleNamespace
from urllib.parse import unquote
from channels.db import database_sync_to_async


@database_sync_to_async
def authenticate_scope(scope):
    """Verify the REST identity using the existing browser token cookie."""
    from accounts.authentication import FirebaseJWTAuthentication, SupabaseAuthentication
    headers = dict(scope.get('headers', []))
    authorization = headers.get(b'authorization', b'').decode('utf-8', errors='ignore')
    if not authorization:
        cookies = SimpleCookie()
        try:
            cookies.load(headers.get(b'cookie', b'').decode('utf-8'))
            token = unquote(cookies['token'].value) if 'token' in cookies else ''
        except Exception:
            return None
        if not token:
            return None
        authorization = f'Bearer {token}'
    request = SimpleNamespace(headers={'Authorization': authorization}, META={'HTTP_AUTHORIZATION': authorization})
    for backend in (FirebaseJWTAuthentication(), SupabaseAuthentication()):
        try:
            result = backend.authenticate(request)
            if result:
                return result[0]
        except Exception:
            continue
    return None


class TokenAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope['user'] = await authenticate_scope(scope)
        return await self.app(scope, receive, send)
