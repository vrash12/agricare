from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, SendOTPView, VerifyOTPView, LoginView, ForgotPasswordView, ResetPasswordView, ChangePasswordView, CheckUsernameView, CheckMobileView, CompleteRegistrationView, CheckPendingView, CheckEmailView, MeView
from .supabase_views import SupabaseRegisterView, SupabaseVerifyOTPView, SupabaseLoginView, SupabaseForgotPasswordView, SupabaseResetPasswordView, SupabaseMeView

urlpatterns = [
    # Custom auth (fallback)
    path('register/', RegisterView.as_view(), name='register'),
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('check-username/', CheckUsernameView.as_view(), name='check-username'),
    path('check-mobile/', CheckMobileView.as_view(), name='check-mobile'),
    path('complete-registration/', CompleteRegistrationView.as_view(), name='complete-registration'),
    path('check-pending/', CheckPendingView.as_view(), name='check-pending'),
    path('check-email/', CheckEmailView.as_view(), name='check-email'),
    path('me/', MeView.as_view(), name='me'),
    # Supabase auth (primary)
    path('supabase/register/', SupabaseRegisterView.as_view(), name='supabase-register'),
    path('supabase/verify-otp/', SupabaseVerifyOTPView.as_view(), name='supabase-verify-otp'),
    path('supabase/login/', SupabaseLoginView.as_view(), name='supabase-login'),
    path('supabase/forgot-password/', SupabaseForgotPasswordView.as_view(), name='supabase-forgot-password'),
    path('supabase/reset-password/', SupabaseResetPasswordView.as_view(), name='supabase-reset-password'),
    path('supabase/me/', SupabaseMeView.as_view(), name='supabase-me'),
]
