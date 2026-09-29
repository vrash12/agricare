"""Concern categories mapped to the LGU's existing personnel positions."""
from rest_framework.exceptions import ValidationError
from accounts.permissions import WORKER_ROLES
from accounts.firebase_service import get_all_positions, get_all_extension_workers


CATEGORIES = (
    ('rice', 'Rice / Palay', 'Rice Report Officer'),
    ('corn', 'Corn / Mais', 'Corn Program'),
    ('high-value-crops', 'Vegetables, fruits and high-value crops', 'High Value Crops Development Program Coordinator'),
    ('livestock', 'Livestock and poultry', 'Livestock Coordinator'),
    ('organic', 'Organic agriculture', 'Organic Program Coordinator'),
    ('registration', 'Farmer registration / RSBSA', 'RSBSA Focal Person'),
    ('seeds', 'Seeds and planting materials', 'Seed Inspector'),
    ('insurance', 'Crop insurance and damage claims', 'Crop Insurance Coordinator'),
    ('marketing', 'Agribusiness and marketing', 'Agribusiness and Marketing Program Coordinator'),
    ('general', 'Other agricultural concerns', 'Municipal Agriculturist'),
)


def get_category(category_id):
    for category in CATEGORIES:
        if category[0] == category_id:
            return {'id': category[0], 'name': category[1], 'position': category[2]}
    raise ValidationError({'error': 'Select a valid concern category.'})


def eligible_personnel():
    positions = {p['id']: ' '.join(p.get('name', '').casefold().split())
                 for p in get_all_positions() if p.get('isActive', True)}
    return [(worker, positions[worker['positionId']]) for worker in get_all_extension_workers()
            if worker.get('role') in WORKER_ROLES and worker.get('isActive', True)
            and not worker.get('isPending') and worker.get('positionId') in positions]


def candidates_for(category, personnel):
    position = ' '.join(category['position'].casefold().split())
    specialists = [worker for worker, name in personnel if name == position]
    return specialists or [worker for worker, name in personnel if name == 'municipal agriculturist']


def route_concern(category):
    candidates = candidates_for(category, eligible_personnel())
    if not candidates:
        return None
    # A stable primary contact per category; admins can reassign existing tickets.
    return min(candidates, key=lambda worker: str(worker['id']))


def category_directory():
    personnel = eligible_personnel()
    return [{'id': category_id, 'name': name,
             'available': bool(candidates_for(get_category(category_id), personnel))}
            for category_id, name, _ in CATEGORIES]
