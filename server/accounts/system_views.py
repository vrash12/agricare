from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from theme.firebase_service import get_system_config, update_system_config, get_theme
from asgiref.sync import async_to_sync
from django.conf import settings
import os
from .permissions import IsSystemAdmin

def broadcast_system_update(data):
    try:
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                'system',
                {'type': 'system_update', 'data': data}
            )
    except Exception:
        pass

def get_superadmin_tokens():
    refresh = RefreshToken()
    refresh['role'] = 'superadmin'
    refresh['username'] = os.getenv('SUPERADMIN_USERNAME')
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class SuperAdminLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if (not username or not password or not os.getenv('SUPERADMIN_USERNAME')
                or not os.getenv('SUPERADMIN_PASSWORD')
                or username != os.getenv('SUPERADMIN_USERNAME') or password != os.getenv('SUPERADMIN_PASSWORD')):
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = get_superadmin_tokens()
        return Response({
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': {
                'username': username,
                'role': 'superadmin',
            }
        })


class SystemConfigView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsSystemAdmin()]
    def get(self, request):
        return Response(get_system_config())

    def patch(self, request):
        update_system_config(request.data)
        broadcast_system_update({'type': 'config', **get_system_config()})
        return Response({'message': 'System config updated'})


class SystemEndpointsView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsSystemAdmin()]
    def get(self, request):
        config = get_system_config()
        return Response({'disabledEndpoints': config.get('disabledEndpoints', [])})

    def patch(self, request):
        endpoint = request.data.get('endpoint')
        action = request.data.get('action')
        config = get_system_config()
        disabled = config.get('disabledEndpoints', [])

        if action == 'disable' and endpoint not in disabled:
            disabled.append(endpoint)
        elif action == 'enable' and endpoint in disabled:
            disabled.remove(endpoint)

        update_system_config({'disabledEndpoints': disabled})
        broadcast_system_update({'type': 'config', **get_system_config()})
        return Response({'message': f'Endpoint {action}d successfully'})

