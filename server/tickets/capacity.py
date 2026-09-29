"""Shared farmer capacity policy for ticket responses and participant additions."""
from rest_framework.exceptions import APIException

PARTICIPANT_LIMIT = 10


class TicketCapacityReached(APIException):
    status_code = 409
    default_code = 'ticket_full'
    default_detail = 'This ticket is full. Please create a separate ticket.'


def farmer_participants(ticket):
    participants = ticket.get('participants') or []
    if not isinstance(participants, (list, tuple)):
        participants = []
    owner = ticket.get('farmerId')
    # The owner counts even on older records that omit them from participants.
    return list(dict.fromkeys(person_id for person_id in [*participants, owner]
                              if isinstance(person_id, str) and person_id.strip()))


def ticket_capacity(ticket):
    count = len(farmer_participants(ticket))
    warning_at = max(1, (PARTICIPANT_LIMIT * 4 + 4) // 5)
    return {
        'count': count,
        'limit': PARTICIPANT_LIMIT,
        'warningAt': warning_at,
        'remaining': max(0, PARTICIPANT_LIMIT - count),
        'status': 'full' if count >= PARTICIPANT_LIMIT else 'near' if count >= warning_at else 'open',
    }


def with_capacity(ticket):
    return {**ticket, 'capacity': ticket_capacity(ticket)}
