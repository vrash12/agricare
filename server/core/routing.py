from django.urls import path
from .consumers import SystemConsumer, NotificationConsumer, AdminUpdatesConsumer, TicketUpdatesConsumer, TicketConsumer

websocket_urlpatterns = [
    path('ws/system/', SystemConsumer.as_asgi()),
    path('ws/notifications/<str:user_id>/', NotificationConsumer.as_asgi()),
    path('ws/admin-updates/', AdminUpdatesConsumer.as_asgi()),
    path('ws/ticket-updates/', TicketUpdatesConsumer.as_asgi()),
    path('ws/tickets/<str:ticket_id>/', TicketConsumer.as_asgi()),
]
