from django.urls import path
from .views import (
    CheckTicketView, SubmitTicketView, TicketListView, TicketDetailView,
    KnowledgeRepositoryVisitsView, TicketStatusView, TicketMessageView, TicketPinView,
    TicketDeleteView, TicketMessageDeleteView, TicketAssignmentView, TicketCategoryListView
)

urlpatterns = [
    path('categories/', TicketCategoryListView.as_view(), name='ticket-categories'),
    path('check/', CheckTicketView.as_view(), name='ticket-check'),
    path('submit/', SubmitTicketView.as_view(), name='ticket-submit'),
    path('visits/', KnowledgeRepositoryVisitsView.as_view(), name='ticket-visits'),
    path('', TicketListView.as_view(), name='ticket-list'),
    path('<str:ticket_id>/', TicketDetailView.as_view(), name='ticket-detail'),
    path('<str:ticket_id>/delete/', TicketDeleteView.as_view(), name='ticket-delete'),
    path('<str:ticket_id>/status/', TicketStatusView.as_view(), name='ticket-status'),
    path('<str:ticket_id>/assignment/', TicketAssignmentView.as_view(), name='ticket-assignment'),
    path('<str:ticket_id>/messages/', TicketMessageView.as_view(), name='ticket-messages'),
    path('<str:ticket_id>/messages/<str:message_id>/pin/', TicketPinView.as_view(), name='ticket-pin'),
    path('<str:ticket_id>/messages/<str:message_id>/delete/', TicketMessageDeleteView.as_view(), name='ticket-message-delete'),
]
