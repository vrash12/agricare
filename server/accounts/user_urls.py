from django.urls import path
from .user_views import (
    FarmerListView, FarmerDetailView, FarmerToggleActiveView,
    ExtensionWorkerListView, ExtensionWorkerDetailView,
    ExtensionWorkerToggleActiveView, ExtensionWorkerApproveView,
    ExtensionWorkerChangePositionView, UploadProfilePictureView,
    NotificationListView, NotificationReadView, NotificationMarkAllReadView,
    AllUsersView, SendNotificationView
)

urlpatterns = [
    path('farmers/', FarmerListView.as_view(), name='farmer-list'),
    path('farmers/<str:user_id>/', FarmerDetailView.as_view(), name='farmer-detail'),
    path('farmers/<str:user_id>/toggle-active/', FarmerToggleActiveView.as_view(), name='farmer-toggle-active'),
    path('extension-workers/', ExtensionWorkerListView.as_view(), name='extension-worker-list'),
    path('extension-workers/<str:user_id>/', ExtensionWorkerDetailView.as_view(), name='extension-worker-detail'),
    path('extension-workers/<str:user_id>/toggle-active/', ExtensionWorkerToggleActiveView.as_view(), name='extension-worker-toggle-active'),
    path('extension-workers/<str:user_id>/approve/', ExtensionWorkerApproveView.as_view(), name='extension-worker-approve'),
    path('extension-workers/<str:user_id>/change-position/', ExtensionWorkerChangePositionView.as_view(), name='extension-worker-change-position'),
    path('profile-picture/', UploadProfilePictureView.as_view(), name='upload-profile-picture'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification-read-all'),
    path('notifications/send/', SendNotificationView.as_view(), name='notification-send'),
    path('notifications/<str:notification_id>/read/', NotificationReadView.as_view(), name='notification-read'),
    path('all/', AllUsersView.as_view(), name='all-users'),
]
