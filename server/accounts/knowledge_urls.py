from django.urls import path
from .knowledge_views import KnowledgeListView, KnowledgeDetailView

urlpatterns = [
    path('', KnowledgeListView.as_view(), name='knowledge-list'),
    path('<str:entry_id>/', KnowledgeDetailView.as_view(), name='knowledge-detail'),
]
