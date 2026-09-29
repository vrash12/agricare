from django.urls import path
from .position_views import PositionListView, PositionDetailView

urlpatterns = [
    path('', PositionListView.as_view(), name='position-list'),
    path('<str:position_id>/', PositionDetailView.as_view(), name='position-detail'),
]
