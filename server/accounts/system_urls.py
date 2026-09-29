from django.urls import path
from .system_views import SuperAdminLoginView, SystemConfigView, SystemEndpointsView

urlpatterns = [
    path('login/', SuperAdminLoginView.as_view(), name='superadmin-login'),
    path('config/', SystemConfigView.as_view(), name='system-config'),
    path('endpoints/', SystemEndpointsView.as_view(), name='system-endpoints'),
]
