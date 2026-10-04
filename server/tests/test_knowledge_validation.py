"""Offline regression checks for the knowledge validation workflow.

Run from ``server`` with the project virtual environment, for example::

    python -m unittest discover -s tests -p test_knowledge_validation.py -v

The Firestore client is replaced with a small in-memory fake so this module
cannot write to the live knowledge repository.
"""

import copy
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.conf import settings


if not settings.configured:
    settings.configure(
        SECRET_KEY='offline-knowledge-validation-regression-key',
        INSTALLED_APPS=['django.contrib.auth', 'django.contrib.contenttypes'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES': [], 'UNAUTHENTICATED_USER': None},
        USE_TZ=True,
    )
    import django
    django.setup()


# Keep imports in this test offline even when it is run by itself.
offline_db = MagicMock()
offline_db.collection.side_effect = AssertionError('Unexpected live database access')
sys.modules['core.firebase'] = SimpleNamespace(db=offline_db)
sys.modules['core.supabase'] = SimpleNamespace(supabase=MagicMock(), supabase_anon=MagicMock())

from rest_framework.test import APIRequestFactory, force_authenticate

from accounts import knowledge_views as knowledge


def actor(role='farmer', user_id='f1', **extra):
    return SimpleNamespace(
        role=role,
        id=user_id,
        is_authenticated=True,
        is_active=extra.get('is_active', True),
        is_pending=extra.get('is_pending', False),
    )


def entry(entry_id, **overrides):
    data = {
        'title': 'Rice yellowing leaves',
        'question': 'How can I address yellowing rice leaves?',
        'answer': 'Check soil nutrients and consult the local agriculture office.',
        'category': 'Crops',
        'keywords': ['rice', 'yellowing', 'nutrients'],
        'sourceName': 'International Rice Research Institute',
        'sourceUrl': 'https://www.irri.org/',
        'isPublished': False,
        'validationStatus': 'pending',
        'createdBy': 'w1',
        'createdAt': '2026-10-01T00:00:00+00:00',
        'updatedAt': '2026-10-01T00:00:00+00:00',
        'submittedAt': '2026-10-01T00:00:00+00:00',
    }
    data.update(overrides)
    return entry_id, data


class FakeSnapshot:
    def __init__(self, entry_id, data):
        self.id = entry_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return copy.deepcopy(self._data) if self._data is not None else None


class FakeDocument:
    def __init__(self, collection, entry_id):
        self.collection = collection
        self.entry_id = entry_id
        self.id = entry_id

    def get(self):
        return FakeSnapshot(self.entry_id, self.collection.records.get(self.entry_id))

    def set(self, data):
        self.collection.records[self.entry_id] = copy.deepcopy(data)

    def update(self, changes):
        if self.entry_id not in self.collection.records:
            raise AssertionError(f'Unexpected update for missing entry: {self.entry_id}')
        self.collection.records[self.entry_id].update(copy.deepcopy(changes))

    def delete(self):
        self.collection.records.pop(self.entry_id, None)


class FakeCollection:
    def __init__(self, records):
        self.records = records
        self.next_id = 1

    def get(self):
        return [FakeSnapshot(entry_id, data) for entry_id, data in self.records.items()]

    def document(self, entry_id=None):
        if entry_id is None:
            while f'new-{self.next_id}' in self.records:
                self.next_id += 1
            entry_id = f'new-{self.next_id}'
            self.next_id += 1
        return FakeDocument(self, entry_id)


class FakeFirestore:
    def __init__(self, records):
        self.collections = {'knowledge_entries': FakeCollection(records)}

    def collection(self, name):
        if name not in self.collections:
            self.collections[name] = FakeCollection({})
        return self.collections[name]


class KnowledgeValidationTests(unittest.TestCase):
    def request(self, view, method, user, data=None, **kwargs):
        request = getattr(APIRequestFactory(), method)('/knowledge/', data or {}, format='json')
        if user is not None:
            force_authenticate(request, user=user)
        return view.as_view()(request, **kwargs)

    def use_entries(self, *items):
        records = {entry_id: copy.deepcopy(data) for entry_id, data in items}
        fake = FakeFirestore(records)
        return fake, patch.object(knowledge, 'db', fake)

    def test_farmer_cannot_create_edit_delete_or_validate(self):
        item = entry('pending-1')
        fake, database = self.use_entries(item)
        payload = {
            'title': 'New article',
            'answer': 'A sourced answer.',
            'sourceName': 'IRRI',
            'sourceUrl': 'https://www.irri.org/',
        }
        with database:
            cases = [
                (knowledge.KnowledgeListView, 'post', {}, payload),
                (knowledge.KnowledgeDetailView, 'patch', {'entry_id': 'pending-1'}, {'answer': 'Changed'}),
                (knowledge.KnowledgeDetailView, 'delete', {'entry_id': 'pending-1'}, {}),
                (knowledge.KnowledgeValidationView, 'post', {'entry_id': 'pending-1'}, {'action': 'approve'}),
            ]
            for view, method, kwargs, data in cases:
                with self.subTest(view=view.__name__, method=method):
                    response = self.request(view, method, actor(), data, **kwargs)
                    self.assertEqual(response.status_code, 403)
            self.assertEqual(fake.collection('knowledge_entries').records['pending-1']['validationStatus'], 'pending')

    def test_farmer_sees_only_explicitly_validated_and_published_entries(self):
        records = [
            entry('published', validationStatus='validated', isPublished=True),
            entry('pending-but-published', validationStatus='pending', isPublished=True),
            entry('validated-but-hidden', validationStatus='validated', isPublished=False),
            entry('rejected-but-published', validationStatus='rejected', isPublished=True),
            entry('seed-auto-approved', validationStatus='validated', isPublished=True,
                  validatedBy='system:knowledge-seed', validatedByName='Curated agricultural source'),
            # This represents a pre-migration record. It must not be public
            # without explicit validation metadata.
            entry('legacy-without-status', validationStatus=None, isPublished=True),
        ]
        fake, database = self.use_entries(*records)
        with database:
            response = self.request(knowledge.KnowledgeListView, 'get', actor())
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data], ['published'])

    def test_authorized_roles_can_approve_and_reject_with_reviewer_metadata(self):
        reviewer_data = {'firstName': 'Karla Mae', 'lastName': 'Asuncion'}
        for role in ('admin', 'extension_worker', 'lgu_personnel'):
            with self.subTest(role=role):
                approve_item = entry('approve-1')
                fake, database = self.use_entries(approve_item)
                with database, patch.object(knowledge, 'get_user_by_id', return_value=reviewer_data):
                    response = self.request(
                        knowledge.KnowledgeValidationView,
                        'post',
                        actor(role, f'{role}-1'),
                        {'action': 'approve'},
                        entry_id='approve-1',
                    )
                self.assertEqual(response.status_code, 200)
                approved = fake.collection('knowledge_entries').records['approve-1']
                self.assertEqual(approved['validationStatus'], 'validated')
                self.assertTrue(approved['isPublished'])
                self.assertEqual(approved['validatedBy'], f'{role}-1')
                self.assertEqual(approved['validatedByName'], 'Karla Mae Asuncion')
                self.assertTrue(approved['validatedAt'])

                reject_item = entry('reject-1')
                fake, database = self.use_entries(reject_item)
                with database, patch.object(knowledge, 'get_user_by_id', return_value=reviewer_data):
                    response = self.request(
                        knowledge.KnowledgeValidationView,
                        'post',
                        actor(role, f'{role}-2'),
                        {'action': 'reject', 'note': 'Please confirm the source and dosage.'},
                        entry_id='reject-1',
                    )
                self.assertEqual(response.status_code, 200)
                rejected = fake.collection('knowledge_entries').records['reject-1']
                self.assertEqual(rejected['validationStatus'], 'rejected')
                self.assertFalse(rejected['isPublished'])
                self.assertEqual(rejected['validatedBy'], f'{role}-2')
                self.assertEqual(rejected['validationNote'], 'Please confirm the source and dosage.')

    def test_new_submission_is_pending_even_when_publish_is_requested(self):
        fake, database = self.use_entries()
        payload = {
            'title': 'Managing rice pests',
            'question': 'How do I manage rice pests?',
            'answer': 'Use integrated pest management and consult the LGU.',
            'category': 'Pests',
            'keywords': ['rice', 'pests'],
            'sourceName': 'International Rice Research Institute',
            'sourceUrl': 'https://www.irri.org/',
            'isPublished': True,
        }
        with database:
            response = self.request(knowledge.KnowledgeListView, 'post', actor('extension_worker', 'w1'), payload)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['validationStatus'], 'pending')
        self.assertFalse(response.data['isPublished'])
        stored = fake.collection('knowledge_entries').records[response.data['id']]
        self.assertEqual(stored['validationStatus'], 'pending')
        self.assertFalse(stored['isPublished'])

    def test_editing_content_resets_validation_and_publication(self):
        item = entry(
            'validated-1',
            validationStatus='validated',
            isPublished=True,
            validatedBy='admin-1',
            validatedByName='Admin Reviewer',
            validatedAt='2026-10-02T00:00:00+00:00',
            validationNote='Approved.',
        )
        fake, database = self.use_entries(item)
        with database:
            response = self.request(
                knowledge.KnowledgeDetailView,
                'patch',
                actor('lgu_personnel', 'lgu-1'),
                {'answer': 'Updated guidance requiring a fresh review.'},
                entry_id='validated-1',
            )
        self.assertEqual(response.status_code, 200)
        updated = fake.collection('knowledge_entries').records['validated-1']
        self.assertEqual(updated['validationStatus'], 'pending')
        self.assertFalse(updated['isPublished'])
        self.assertIsNone(updated['validatedBy'])
        self.assertIsNone(updated['validatedByName'])
        self.assertIsNone(updated['validatedAt'])
        self.assertIsNone(updated['validationNote'])
        self.assertTrue(updated['submittedAt'])


if __name__ == '__main__':
    unittest.main()
