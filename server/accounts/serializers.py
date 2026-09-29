from rest_framework import serializers

class RegisterSerializer(serializers.Serializer):
    mobileNumber = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=['farmer', 'extension_worker'])

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)
    rememberMe = serializers.BooleanField(required=False, default=False)

class SendOTPSerializer(serializers.Serializer):
    mobileNumber = serializers.CharField()

class VerifyOTPSerializer(serializers.Serializer):
    mobileNumber = serializers.CharField()
    otp = serializers.CharField()
    isRegistration = serializers.BooleanField(required=False, default=False)

class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField()

class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
class CompleteRegistrationSerializer(serializers.Serializer):
    mobileNumber = serializers.CharField()
    firstName = serializers.CharField()
    lastName = serializers.CharField()
    barangay = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField()
    positionId = serializers.CharField(required=False, allow_blank=True)


