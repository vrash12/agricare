from django.http import JsonResponse
from theme.firebase_service import get_system_config

EXCLUDED_PATHS = [
    '/api/system/',
    '/api/auth/login/',
    '/admin/',
]

class SystemMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if any(path.startswith(p) for p in EXCLUDED_PATHS):
            return self.get_response(request)

        try:
            config = get_system_config()

            if not config.get('isSystemEnabled', True):
                return JsonResponse({'error': 'System is currently under maintenance.', 'isSystemDisabled': True}, status=503)

            disabled_endpoints = config.get('disabledEndpoints', [])
            for endpoint in disabled_endpoints:
                if path.startswith(f'/api/{endpoint}'):
                    return JsonResponse({'error': 'This feature is currently unavailable.', 'isEndpointDisabled': True}, status=503)

        except Exception:
            pass

        return self.get_response(request)
