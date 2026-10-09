from django.urls import path
from .knowledge_views import KnowledgeListView, KnowledgeDetailView, KnowledgeValidationView, KnowledgeReviewersView

urlpatterns = [
    path('', KnowledgeListView.as_view(), name='knowledge-list'),
    path('reviewers/', KnowledgeReviewersView.as_view(), name='knowledge-reviewers'),
    path('<str:entry_id>/', KnowledgeDetailView.as_view(), name='knowledge-detail'),
    path('<str:entry_id>/validate/', KnowledgeValidationView.as_view(), name='knowledge-validate'),
]
