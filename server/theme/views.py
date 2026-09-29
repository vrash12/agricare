from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .firebase_service import get_theme, update_theme
from accounts.permissions import IsAdminOrSystemAdmin

class ThemeView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsAdminOrSystemAdmin()]

    def get(self, request):
        return Response(get_theme())

    def patch(self, request):
        update_theme(request.data)
        from accounts.system_views import broadcast_system_update
        broadcast_system_update({'type': 'theme', **get_theme()})
        return Response({'message': 'Theme updated successfully'})

