from accounts.permissions import WORKER_ROLES, is_active_user
from rest_framework.exceptions import NotFound, PermissionDenied


def ticket_owner(ticket):
    participants = ticket.get('participants') or []
    return ticket.get('farmerId') or (participants[0] if participants else None)


def can_access_ticket(user, ticket):
    if not is_active_user(user) or not ticket:
        return False
    if user.role == 'admin':
        return True
    if user.role in WORKER_ROLES:
        return ticket.get('extensionWorkerId') == user.id
    return user.role == 'farmer' and (
        user.id == ticket_owner(ticket) or user.id in (ticket.get('participants') or [])
    )


def can_view_ticket(user, ticket):
    """Farmers may read every ticket so past solutions stay searchable; only members can participate."""
    if not is_active_user(user) or not ticket:
        return False
    return user.role == 'farmer' or can_access_ticket(user, ticket)


def require_ticket_view(user, ticket):
    if not ticket:
        raise NotFound('Ticket not found')
    if not can_view_ticket(user, ticket):
        raise PermissionDenied('You do not have access to this ticket.')


def require_ticket_access(user, ticket):
    if not ticket:
        raise NotFound('Ticket not found')
    if not can_access_ticket(user, ticket):
        raise PermissionDenied('You do not have access to this ticket.')


def require_assigned_worker(user, ticket):
    require_ticket_access(user, ticket)
    if user.role not in WORKER_ROLES or ticket.get('extensionWorkerId') != user.id:
        raise PermissionDenied('Only the assigned LGU worker can perform this action.')
