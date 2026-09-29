from rest_framework.permissions import BasePermission


WORKER_ROLES = {'extension_worker', 'lgu_personnel'}
APPLICATION_ROLES = {'admin', 'farmer', *WORKER_ROLES}


def is_active_user(user):
    return bool(user and getattr(user, 'is_authenticated', False)
                and getattr(user, 'is_active', True)
                and not getattr(user, 'is_pending', False))


class IsApplicationUser(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user) and request.user.role in APPLICATION_ROLES


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user) and request.user.role == 'admin'


class IsFarmer(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user) and request.user.role == 'farmer'


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user) and request.user.role == 'superadmin'


class IsAdminOrSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user) and request.user.role in {'admin', 'superadmin'}
