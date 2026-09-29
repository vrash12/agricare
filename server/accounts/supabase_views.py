from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from core.supabase import supabase, supabase_anon
from .firebase_service import get_user_by_email, get_user_by_mobile, get_user_by_username, create_user, get_user_by_id, get_position_by_id
from .otp_service import store_pending_registration, get_pending_registration, mark_registration_verified, clear_pending_registration, mark_registration_completed
from .otp_service import send_otp
from .password_service import password_hash, update_password


class SupabaseRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        mobile_number = request.data.get('mobileNumber')
        role = request.data.get('role')

        if role not in {'farmer', 'extension_worker'}:
            return Response({'error': 'Invalid registration role'}, status=status.HTTP_400_BAD_REQUEST)

        if not email or not password or not mobile_number or not role:
            return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)

        if get_user_by_mobile(mobile_number):
            return Response({'error': 'Mobile number already exists'}, status=status.HTTP_400_BAD_REQUEST)

        if get_user_by_email(email):
            return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = supabase.auth.sign_up({'email': email, 'password': password})
            if res.user is None:
                return Response({'error': 'Failed to create Supabase account'}, status=status.HTTP_400_BAD_REQUEST)

            double_hash = password_hash(password)
            store_pending_registration(mobile_number, {
                'mobileNumber': mobile_number,
                'email': email,
                'passwordHash': double_hash,
                'role': role,
                'isPending': role == 'extension_worker',
                'supabaseId': res.user.id,
            })
            return Response({'message': 'OTP sent to email'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SupabaseVerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        token = request.data.get('otp')
        mobile_number = request.data.get('mobileNumber')
        is_registration = request.data.get('isRegistration', False)

        if not email or not token:
            return Response({'error': 'email and otp are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = supabase.auth.verify_otp({'email': email, 'token': token, 'type': 'signup'})
            if res.user is None:
                return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)

            if is_registration and mobile_number:
                user_data = get_pending_registration(mobile_number)
                if not user_data:
                    return Response({'error': 'Registration data expired. Please register again.'}, status=status.HTTP_400_BAD_REQUEST)
                mark_registration_verified(mobile_number)

            return Response({'message': 'OTP verified successfully'})
        except Exception as e:
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)


class SupabaseLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        remember_me = request.data.get('rememberMe', False)

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = supabase_anon.auth.sign_in_with_password({'email': email, 'password': password})
            if res.user is None:
                return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

            user = get_user_by_email(email)
            if not user:
                return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

            if not user.get('isActive'):
                return Response({'error': 'Account is disabled'}, status=status.HTTP_401_UNAUTHORIZED)

            if user.get('isPending'):
                return Response({'error': 'Account is pending approval', 'isPending': True}, status=status.HTTP_403_FORBIDDEN)

            position_name = ''
            if user.get('positionId'):
                pos = get_position_by_id(user['positionId'])
                position_name = pos['name'] if pos else ''

            return Response({
                'access': res.session.access_token,
                'refresh': res.session.refresh_token,
                'user': {
                    'id': user['id'],
                    'firstName': user['firstName'],
                    'lastName': user['lastName'],
                    'role': user['role'],
                    'email': user.get('email', ''),
                    'mobileNumber': user['mobileNumber'],
                    'profilePicture': user.get('profilePicture', ''),
                    'barangay': user.get('barangay', ''),
                    'positionName': position_name,
                }
            })
        except Exception as e:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


class SupabaseForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = get_user_by_email(email)
        if not user:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            send_otp(user['mobileNumber'], email=user['email'])
        except Exception:
            return Response({'error': 'Unable to send a verification email right now.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'message': 'OTP sent successfully', 'mobileNumber': user['mobileNumber']})


class SupabaseResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        access_token = request.data.get('accessToken')
        new_password = request.data.get('newPassword', '')

        if not isinstance(access_token, str) or not isinstance(new_password, str) or not access_token or not new_password:
            return Response({'error': 'accessToken and newPassword are required'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            auth_user = supabase.auth.get_user(access_token).user
        except Exception:
            return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not auth_user or not auth_user.email:
            return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_401_UNAUTHORIZED)
        user = get_user_by_email(auth_user.email)
        if not user or user.get('supabaseId') != auth_user.id:
            return Response({'error': 'Account not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            update_password(user, new_password)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Unable to update your password. Please try again.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'message': 'Password reset successfully'})


class SupabaseMeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'No token'}, status=status.HTTP_401_UNAUTHORIZED)

        token = auth_header.split(' ')[1]
        try:
            res = supabase.auth.get_user(token)
            if res.user is None:
                return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

            user = get_user_by_email(res.user.email)
            if not user or not user.get('isActive', True) or user.get('isPending') or user.get('supabaseId') != res.user.id:
                return Response({'error': 'Account is unavailable'}, status=status.HTTP_403_FORBIDDEN)

            position_name = ''
            if user.get('positionId'):
                pos = get_position_by_id(user['positionId'])
                position_name = pos['name'] if pos else ''

            return Response({
                'id': user['id'],
                'firstName': user['firstName'],
                'lastName': user['lastName'],
                'role': user['role'],
                'email': user.get('email', ''),
                'mobileNumber': user['mobileNumber'],
                'profilePicture': user.get('profilePicture', ''),
                'barangay': user.get('barangay', ''),
                'positionName': position_name,
            })
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)
