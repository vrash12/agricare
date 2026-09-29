from django.urls import path
from .dashboard_views import DashboardStatsView, FarmerDashboardStatsView, WorkerDashboardStatsView, ReportsStatsView, TicketsByPositionView, WorkerLogsView, FarmersByMonthView, VisitsLogView, OnlineWorkersView

urlpatterns = [
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('farmer-stats/', FarmerDashboardStatsView.as_view(), name='farmer-dashboard-stats'),
    path('worker-stats/', WorkerDashboardStatsView.as_view(), name='worker-dashboard-stats'),
    path('reports/tickets-by-position/', TicketsByPositionView.as_view(), name='tickets-by-position'),
    path('reports/worker-logs/', WorkerLogsView.as_view(), name='worker-logs'),
    path('reports/farmers-by-month/', FarmersByMonthView.as_view(), name='farmers-by-month'),
    path('reports/visits-log/', VisitsLogView.as_view(), name='visits-log'),
    path('reports/online-workers/', OnlineWorkersView.as_view(), name='online-workers'),
    path('reports/', ReportsStatsView.as_view(), name='reports-stats'),
]
