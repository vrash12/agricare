"""Offline regression checks; no live Firestore, Supabase, email, or Redis writes.

Run: python -m unittest discover -s tests -p test_access_control.py -v
"""
import asyncio
import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from django.conf import settings

if not settings.configured:
    settings.configure(
        SECRET_KEY='offline-access-control-regression-key',
        INSTALLED_APPS=['django.contrib.auth', 'django.contrib.contenttypes'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        REST_FRAMEWORK={'DEFAULT_AUTHENTICATION_CLASSES': [], 'UNAUTHENTICATED_USER': None},
        CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}},
        USE_TZ=True,
    )
    import django
    django.setup()

# Fail immediately if any test accidentally reaches an unmocked database operation.
offline_db = MagicMock()
offline_db.collection.side_effect = AssertionError('Unexpected database access')
sys.modules['core.firebase'] = SimpleNamespace(db=offline_db)
sys.modules['core.supabase'] = SimpleNamespace(supabase=MagicMock(), supabase_anon=MagicMock())
sys.modules['accounts.otp_service'] = MagicMock()

from rest_framework.test import APIRequestFactory, force_authenticate
from accounts import user_views as users, position_views as positions
from accounts import authentication, system_views, supabase_views
from theme.views import ThemeView
from tickets import views as tickets, firebase_service as ticket_store
from tickets.capacity import with_capacity, ticket_capacity, TicketCapacityReached
from core.consumers import TicketConsumer, NotificationConsumer, AdminUpdatesConsumer
from core.websocket_auth import TokenAuthMiddleware, authenticate_scope
from asgiref.testing import ApplicationCommunicator


def actor(role='farmer', user_id='f1', **extra):
    return SimpleNamespace(role=role, id=user_id, is_authenticated=True,
                           is_active=extra.get('is_active', True),
                           is_pending=extra.get('is_pending', False))


TICKET = {'id': 't1', 'participants': ['f1', 'f2'], 'extensionWorkerId': 'w1', 'status': 'ongoing'}
FARMER = {'id': 'f1', 'role': 'farmer', 'firstName': 'Test', 'lastName': 'Farmer', 'isActive': True}
WORKER = {'id': 'w1', 'role': 'extension_worker', 'firstName': 'Test', 'lastName': 'Worker', 'isActive': True}


class RequestTests(unittest.TestCase):
    def request(self, view, method, user, data=None, **kwargs):
        req = getattr(APIRequestFactory(), method)('/test/', data or {}, format='json')
        if user:
            force_authenticate(req, user=user)
        return view.as_view()(req, **kwargs)

    def test_log_clear_is_scoped_and_reversible(self):
        records = [{'id': 'read', 'isRead': True}, {'id': 'unread', 'isRead': False}, {'id': 'archived', 'isArchived': True}]
        fake = MagicMock()
        with patch.object(users, 'get_notifications', return_value=records), patch.object(users.store, 'db', fake), patch.object(users, 'notify_user_ws'):
            response = self.request(users.NotificationLogsView, 'post', actor('admin', 'admin1'), {'action': 'clear_read'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['count'], 1)
            fake.collection().document.assert_called_with('admin1')
            fake.collection().document().collection().document.assert_called_with('read')
            fake.collection().document().collection().document().update.assert_called_with({'isArchived': True})
            response = self.request(users.NotificationLogsView, 'post', actor('admin', 'admin1'), {'action': 'restore'})
            self.assertEqual(response.data['count'], 1)
            fake.collection().document().collection().document().update.assert_called_with({'isArchived': False})

    def test_account_management_rejects_farmers_workers_and_anonymous(self):
        cases = [
            (users.ExtensionWorkerListView, 'post', {}),
            (users.ExtensionWorkerDetailView, 'patch', {'user_id': 'w1'}),
            (users.NotificationLogsView, 'post', {}),
            (users.FarmerListView, 'get', {}),
            (users.FarmerDetailView, 'get', {'user_id': 'f1'}),
            (users.FarmerDetailView, 'delete', {'user_id': 'f1'}),
            (users.FarmerToggleActiveView, 'patch', {'user_id': 'f1'}),
            (users.ExtensionWorkerDetailView, 'delete', {'user_id': 'w1'}),
            (users.ExtensionWorkerToggleActiveView, 'patch', {'user_id': 'w1'}),
            (users.ExtensionWorkerApproveView, 'patch', {'user_id': 'w1'}),
            (users.ExtensionWorkerChangePositionView, 'patch', {'user_id': 'w1'}),
            (positions.PositionListView, 'post', {}),
            (positions.PositionDetailView, 'patch', {'position_id': 'p1'}),
            (positions.PositionDetailView, 'delete', {'position_id': 'p1'}),
        ]
        for user in [None, actor(), actor('extension_worker', 'w1'), actor('lgu_personnel', 'w1')]:
            for view, method, kwargs in cases:
                with self.subTest(role=getattr(user, 'role', None), view=view.__name__, method=method):
                    response = self.request(view, method, user, {'name': 'Crop officer', 'positionId': 'p1'}, **kwargs)
                    self.assertIn(response.status_code, (401, 403))

    def test_admin_can_manage_correct_account_type(self):
        with patch.object(users, 'get_user_by_id', return_value=FARMER), patch.object(users, 'toggle_user_active') as write, patch.object(users, 'broadcast_admin_update'):
            self.assertEqual(self.request(users.FarmerToggleActiveView, 'patch', actor('admin', 'a1'), user_id='f1').status_code, 200)
            write.assert_called_once_with('f1')
        with patch.object(users, 'get_user_by_id', return_value=WORKER), patch.object(users, 'delete_user') as write:
            self.assertEqual(self.request(users.FarmerDetailView, 'delete', actor('admin', 'a1'), user_id='w1').status_code, 404)
            write.assert_not_called()

    def test_directory_does_not_expose_credentials_or_pending_workers(self):
        worker = {**WORKER, 'email': 'private@example.test', 'mobileNumber': 'private', 'passwordHash': 'secret', 'supabaseId': 'secret-id'}
        with patch.object(users, 'get_all_extension_workers', return_value=[worker, {**worker, 'id': 'pending', 'isPending': True}]):
            response = self.request(users.ExtensionWorkerListView, 'get', actor())
            self.assertEqual(len(response.data), 1)
            self.assertFalse({'passwordHash', 'supabaseId', 'email', 'mobileNumber'} & response.data[0].keys())
            admin_response = self.request(users.ExtensionWorkerListView, 'get', actor('admin', 'a1'))
            self.assertEqual(len(admin_response.data), 2)
            self.assertNotIn('passwordHash', admin_response.data[0])
        with patch.object(users, 'get_user_by_id', return_value=FARMER):
            self.assertEqual(self.request(users.ExtensionWorkerDetailView, 'get', actor(), user_id='f1').status_code, 404)

    def test_ticket_details_only_for_members_assigned_worker_and_admin(self):
        for user, expected in [(None, 403), (actor(), 200), (actor('farmer', 'f2'), 200),
                               (actor('farmer', 'stranger'), 403), (actor('extension_worker', 'w1'), 200),
                               (actor('extension_worker', 'w2'), 403), (actor('lgu_personnel', 'w1'), 200),
                               (actor('admin', 'a1'), 200), (actor('unknown', 'x'), 403)]:
            with self.subTest(user=user), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch.object(tickets, 'get_ticket_messages', return_value=[]) as read:
                response = self.request(tickets.TicketDetailView, 'get', user, ticket_id='t1')
                self.assertEqual(response.status_code, expected)
                self.assertEqual(read.call_count, int(expected == 200))

    @patch('accounts.firebase_service.get_user_by_id', return_value={'barangay': 'Poblacion'})
    def test_ticket_list_uses_current_user_scope(self, mock_owner):
        with patch.object(tickets, 'get_tickets_by_farmer', return_value=[TICKET]) as read:
            self.assertEqual(self.request(tickets.TicketListView, 'get', actor()).data, [with_capacity(TICKET)])
            read.assert_called_once_with('f1')
        with patch.object(tickets, 'get_tickets_by_worker', return_value=[TICKET]) as read:
            self.assertEqual(self.request(tickets.TicketListView, 'get', actor('lgu_personnel', 'w1')).data, [with_capacity({**TICKET, 'barangay': 'Poblacion'})])
            read.assert_called_once_with('w1')

    def test_unrelated_users_cannot_mutate_ticket(self):
        for user in [actor('farmer', 'outsider'), actor('extension_worker', 'w2')]:
            for view, method, data, kwargs in [
                (tickets.TicketMessageView, 'post', {'message': 'Injection'}, {}),
                (tickets.TicketStatusView, 'patch', {'status': 'ongoing'}, {}),
                (tickets.TicketPinView, 'patch', {}, {'message_id': 'm1'}),
            ]:
                with self.subTest(view=view.__name__, user=user), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch.object(tickets, 'add_message') as add, patch.object(tickets, 'update_ticket_status') as update, patch.object(tickets, 'pin_message') as pin:
                    self.assertEqual(self.request(view, method, user, data, ticket_id='t1', **kwargs).status_code, 403)
                    add.assert_not_called(); update.assert_not_called(); pin.assert_not_called()

    def test_member_cannot_self_assign_staff_status_or_pin(self):
        with patch.object(tickets, 'get_ticket_by_id', return_value=TICKET):
            for status in ['pending', 'ongoing', 'waiting_for_feedback', 'cancel_resolution']:
                self.assertEqual(self.request(tickets.TicketStatusView, 'patch', actor(), {'status': status}, ticket_id='t1').status_code, 403)
            self.assertEqual(self.request(tickets.TicketPinView, 'patch', actor(), ticket_id='t1', message_id='m1').status_code, 403)

    def test_resolution_requires_owner_and_pending_confirmation(self):
        with patch.object(tickets, 'get_ticket_by_id', return_value=TICKET):
            self.assertEqual(self.request(tickets.TicketStatusView, 'patch', actor(), {'status': 'resolved'}, ticket_id='t1').status_code, 400)
        waiting = {**TICKET, 'status': 'waiting_for_feedback'}
        with patch.object(tickets, 'get_ticket_by_id', return_value=waiting), patch.object(tickets, 'update_ticket_status') as write, patch('accounts.firebase_service.create_notification'), patch('accounts.firebase_service.notify_user_ws'), patch('accounts.firebase_service.broadcast_ticket_update'):
            self.assertEqual(self.request(tickets.TicketStatusView, 'patch', actor('farmer', 'f2'), {'status': 'resolved'}, ticket_id='t1').status_code, 403)
            self.assertEqual(self.request(tickets.TicketStatusView, 'patch', actor(), {'status': 'resolved'}, ticket_id='t1').status_code, 200)
            write.assert_called_once_with('t1', 'resolved')

    def test_assigned_worker_can_pin_and_request_resolution(self):
        with patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch.object(tickets, 'get_message_by_id', return_value={'id': 'm1'}), patch.object(tickets, 'pin_message', return_value=False) as pin, patch.object(tickets, 'update_ticket_status') as update, patch('accounts.firebase_service.get_user_by_id', return_value=WORKER), patch('accounts.firebase_service.create_notification'), patch('accounts.firebase_service.notify_user_ws'), patch('accounts.firebase_service.broadcast_ticket_update'):
            self.assertEqual(self.request(tickets.TicketPinView, 'patch', actor('extension_worker', 'w1'), ticket_id='t1', message_id='m1').status_code, 200)
            pin.assert_called_once_with('t1', 'm1')
            self.assertEqual(self.request(tickets.TicketStatusView, 'patch', actor('extension_worker', 'w1'), {'status': 'waiting_for_feedback'}, ticket_id='t1').status_code, 200)
            update.assert_called_once_with('t1', 'waiting_for_feedback')

    def test_members_can_send_messages(self):
        for user in [actor(), actor('extension_worker', 'w1'), actor('lgu_personnel', 'w1')]:
            with self.subTest(user=user), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch.object(tickets, 'add_message') as write, patch('accounts.firebase_service.get_user_by_id', return_value=FARMER), patch('accounts.firebase_service.create_notification'), patch('accounts.firebase_service.notify_user_ws'):
                self.assertEqual(self.request(tickets.TicketMessageView, 'post', user, {'message': 'Hello'}, ticket_id='t1').status_code, 201)
                self.assertEqual(write.call_args.args[1]['senderId'], user.id)

    def test_join_cannot_grant_access_to_another_farmers_ticket(self):
        payload = {'title': 'Rice', 'concern': 'Rice leaves', 'extensionWorkerId': 'w1', 'categoryId': 'rice', 'joinExisting': True, 'ticketId': 't1'}
        with patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch('accounts.firebase_service.get_user_by_id', return_value=WORKER), patch('tickets.firebase_service.join_ticket') as join:
            self.assertEqual(self.request(tickets.SubmitTicketView, 'post', actor('farmer', 'outsider'), payload).status_code, 403)
            join.assert_not_called()

    def test_matching_filters_other_farmers_before_ranking(self):
        docs = [SimpleNamespace(id='other', to_dict=lambda: {**TICKET, 'id': 'other', 'participants': ['other'], 'keywords': ['rice']}),
                SimpleNamespace(id='mine', to_dict=lambda: {**TICKET, 'id': 'mine', 'keywords': ['rice']})]
        fake = MagicMock()
        fake.collection.return_value.where.return_value.get.return_value = docs
        with patch.object(ticket_store, 'db', fake):
            self.assertEqual(ticket_store.find_matching_ticket('w1', ['rice'], 'f1')['id'], 'mine')
            self.assertIsNone(ticket_store.find_matching_ticket('w1', ['rice'], 'outsider'))

    def test_ticket_creation_routes_on_server_and_ignores_spoofed_assignee(self):
        payload = {'title': 'Rice', 'concern': 'Rice leaves', 'categoryId': 'rice', 'extensionWorkerId': 'attacker', 'farmerName': 'Forged', 'extensionWorkerName': 'Forged', 'categoryName': 'Forged'}
        with patch.object(tickets, 'route_concern', return_value=None), patch.object(tickets, 'create_ticket') as create:
            self.assertEqual(self.request(tickets.SubmitTicketView, 'post', actor(), payload).status_code, 409)
            create.assert_not_called()
        with patch.object(tickets, 'route_concern', return_value=WORKER), patch('accounts.firebase_service.get_user_by_id', return_value=FARMER), patch.object(tickets, 'create_ticket', return_value='new') as create, patch('accounts.firebase_service.create_notification') as notify, patch('accounts.firebase_service.notify_user_ws'), patch('accounts.firebase_service.broadcast_ticket_update'):
            response = self.request(tickets.SubmitTicketView, 'post', actor(), payload)
            self.assertEqual(response.status_code, 201)
            stored = create.call_args.args[0]
            self.assertEqual(stored['farmerName'], 'Test Farmer')
            self.assertEqual(stored['extensionWorkerId'], 'w1')
            self.assertEqual(stored['extensionWorkerName'], 'Test Worker')
            self.assertEqual(stored['categoryId'], 'rice')
            self.assertEqual(stored['categoryName'], 'Rice / Palay')
            self.assertEqual(notify.call_args.args[0], 'w1')
            self.assertEqual(response.data['extensionWorkerName'], 'Test Worker')

    def test_system_mutations_require_system_admin(self):
        for view in [system_views.SystemConfigView, system_views.SystemEndpointsView]:
            for user in [None, actor(), actor('admin', 'a1')]:
                self.assertIn(self.request(view, 'patch', user, {'action': 'disable', 'endpoint': '/api/tickets'}).status_code, (401, 403))
        with patch('accounts.system_views.update_system_config') as write, patch('accounts.system_views.get_system_config', return_value={}), patch('accounts.system_views.broadcast_system_update'):
            self.assertEqual(self.request(system_views.SystemConfigView, 'patch', actor('superadmin', 'system-admin'), {'maintenance': True}).status_code, 200)
            write.assert_called_once()
        self.assertIn(self.request(ThemeView, 'patch', actor(), {'primaryColor': '#000'}).status_code, (401, 403))

    def test_assignment_requires_an_active_admin(self):
        for user in [None, actor(), actor('extension_worker', 'w1'), actor('lgu_personnel', 'w1'),
                     actor('superadmin', 's1'), actor('admin', 'a1', is_active=False), actor('admin', 'a1', is_pending=True)]:
            with self.subTest(user=user), patch.object(tickets, 'update_ticket_assignment') as write:
                response = self.request(tickets.TicketAssignmentView, 'patch', user, {'extensionWorkerId': 'w2'}, ticket_id='t1')
                self.assertIn(response.status_code, (401, 403))
                write.assert_not_called()

    def test_assignment_rejects_missing_ticket_and_invalid_personnel(self):
        with patch.object(tickets, 'get_ticket_by_id', return_value=None), patch.object(tickets, 'update_ticket_assignment') as write:
            self.assertEqual(self.request(tickets.TicketAssignmentView, 'patch', actor('admin', 'a1'), {'extensionWorkerId': 'w2'}, ticket_id='missing').status_code, 404)
            write.assert_not_called()
        for worker in [None, FARMER, {**WORKER, 'role': 'admin'}, {**WORKER, 'isActive': False}, {**WORKER, 'isPending': True}]:
            with self.subTest(worker=worker), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch('accounts.firebase_service.get_user_by_id', return_value=worker), patch.object(tickets, 'update_ticket_assignment') as write:
                self.assertEqual(self.request(tickets.TicketAssignmentView, 'patch', actor('admin', 'a1'), {'extensionWorkerId': 'w2'}, ticket_id='t1').status_code, 400)
                write.assert_not_called()
        for worker_id in [None, '', ' ', 25, ['w2'], {'id': 'w2'}, 'users/w2']:
            with self.subTest(worker_id=worker_id), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch('accounts.firebase_service.get_user_by_id') as read:
                self.assertEqual(self.request(tickets.TicketAssignmentView, 'patch', actor('admin', 'a1'), {'extensionWorkerId': worker_id}, ticket_id='t1').status_code, 400)
                read.assert_not_called()

    def test_assignment_persists_canonical_identity_and_notifies_current_members(self):
        for role in ['extension_worker', 'lgu_personnel']:
            worker = {**WORKER, 'id': 'w2', 'role': role, 'firstName': 'New'}
            fake = MagicMock()
            channel = SimpleNamespace(group_send=AsyncMock())
            with self.subTest(role=role), patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch('accounts.firebase_service.get_user_by_id', return_value=worker), patch.object(ticket_store, 'db', fake), patch('accounts.firebase_service.create_notification') as notify, patch('accounts.firebase_service.notify_user_ws'), patch('accounts.firebase_service.broadcast_ticket_update') as broadcast, patch('channels.layers.get_channel_layer', return_value=channel):
                response = self.request(tickets.TicketAssignmentView, 'patch', actor('admin', 'a1'), {'extensionWorkerId': 'w2', 'extensionWorkerName': 'Forged', 'assignedBy': 'Forged', 'participants': ['outsider'], 'status': 'resolved'}, ticket_id='t1')
                self.assertEqual(response.status_code, 200)
                updated = response.data['ticket']
                self.assertEqual(updated['extensionWorkerId'], 'w2')
                self.assertEqual(updated['extensionWorkerName'], 'New Worker')
                self.assertEqual(updated['assignedBy'], 'a1')
                self.assertEqual(updated['participants'], TICKET['participants'])
                self.assertEqual(updated['status'], 'ongoing')
                write = fake.collection.return_value.document.return_value.update
                write.assert_called_once()
                self.assertEqual(set(write.call_args.args[0]), {'extensionWorkerId', 'extensionWorkerName', 'assignedBy', 'assignedAt', 'assignmentMethod'})
                fake.collection.return_value.document.assert_called_once_with('t1')
                self.assertEqual({call.args[0] for call in notify.call_args_list}, {'w2', 'f1', 'f2'})
                self.assertTrue(all(call.args[4] == 't1' for call in notify.call_args_list))
                broadcast.assert_called_once()
                channel.group_send.assert_awaited_once_with('ticket_t1', {'type': 'ticket_message', 'data': {'type': 'assignment_updated'}})
                from tickets.permissions import can_access_ticket
                self.assertFalse(can_access_ticket(actor('extension_worker', 'w1'), updated))
                self.assertTrue(can_access_ticket(actor(role, 'w2'), updated))
                self.assertTrue(can_access_ticket(actor(), updated))

    def test_same_assignment_does_not_write_or_send_duplicate_notifications(self):
        with patch.object(tickets, 'get_ticket_by_id', return_value=TICKET), patch('accounts.firebase_service.get_user_by_id', return_value=WORKER), patch.object(tickets, 'update_ticket_assignment') as write, patch('accounts.firebase_service.create_notification') as notify:
            response = self.request(tickets.TicketAssignmentView, 'patch', actor('admin', 'a1'), {'extensionWorkerId': 'w1'}, ticket_id='t1')
            self.assertEqual(response.status_code, 200)
            write.assert_not_called()
            notify.assert_not_called()

    def test_ticket_check_requires_category_and_uses_farmer_scope(self):
        payload = {'title': 'Rice', 'concern': 'Rice leaves', 'categoryId': 'rice'}
        for category_id in [None, '', 'invented', [], {}]:
            with self.subTest(category_id=category_id), patch.object(tickets, 'find_matching_ticket') as read:
                self.assertEqual(self.request(tickets.CheckTicketView, 'post', actor(), {**payload, 'categoryId': category_id}).status_code, 400)
                read.assert_not_called()
        with patch.object(tickets, 'find_matching_ticket', return_value=None) as read:
            self.assertEqual(self.request(tickets.CheckTicketView, 'post', actor(), payload).status_code, 200)
            self.assertEqual(read.call_args.kwargs, {'farmer_id': 'f1', 'category_id': 'rice'})

    def test_worker_directory_queries_both_supported_lgu_roles(self):
        from accounts import firebase_service as accounts_store
        fake = MagicMock()
        fake.collection.return_value.where.return_value.get.return_value = []
        with patch.object(accounts_store, 'db', fake):
            self.assertEqual(accounts_store.get_all_extension_workers(), [])
        fake.collection.return_value.where.assert_called_once_with('role', 'in', ['extension_worker', 'lgu_personnel'])

    def test_category_routing_uses_matching_active_approved_specialist(self):
        from tickets import routing
        for category_id, name, position in routing.CATEGORIES:
            staff = [
                {**WORKER, 'id': 'specialist', 'positionId': 'p1'},
                {**WORKER, 'id': 'disabled', 'positionId': 'p1', 'isActive': False},
                {**WORKER, 'id': 'pending', 'positionId': 'p1', 'isPending': True},
                {**FARMER, 'id': 'wrong-role', 'positionId': 'p1'},
                {**WORKER, 'id': 'disabled-position', 'positionId': 'p2'},
            ]
            positions = [{'id': 'p1', 'name': position, 'isActive': True}, {'id': 'p2', 'name': position, 'isActive': False}]
            with self.subTest(category=name), patch.object(routing, 'get_all_positions', return_value=positions), patch.object(routing, 'get_all_extension_workers', return_value=staff):
                self.assertEqual(routing.route_concern(routing.get_category(category_id))['id'], 'specialist')

    def test_category_routing_prefers_specialist_then_municipal_triage(self):
        from tickets import routing
        positions = [{'id': 'rice', 'name': ' rice REPORT officer '}, {'id': 'triage', 'name': 'Municipal Agriculturist'}, {'id': 'corn', 'name': 'Corn Program'}]
        specialist = {**WORKER, 'id': 'z-rice', 'positionId': 'rice', 'role': 'lgu_personnel'}
        general = {**WORKER, 'id': 'a-triage', 'positionId': 'triage'}
        other = {**WORKER, 'id': 'corn-worker', 'positionId': 'corn'}
        with patch.object(routing, 'get_all_positions', return_value=positions):
            with patch.object(routing, 'get_all_extension_workers', return_value=[general, other, specialist]):
                self.assertEqual(routing.route_concern(routing.get_category('rice'))['id'], 'z-rice')
            with patch.object(routing, 'get_all_extension_workers', return_value=[general, other, {**specialist, 'isActive': False}]):
                self.assertEqual(routing.route_concern(routing.get_category('rice'))['id'], 'a-triage')
            with patch.object(routing, 'get_all_extension_workers', return_value=[other]):
                self.assertIsNone(routing.route_concern(routing.get_category('rice')))
                directory = routing.category_directory()
                self.assertFalse(next(item for item in directory if item['id'] == 'rice')['available'])
                self.assertTrue(next(item for item in directory if item['id'] == 'corn')['available'])

    def test_category_catalog_requires_login_and_exposes_no_personal_data(self):
        self.assertIn(self.request(tickets.TicketCategoryListView, 'get', None).status_code, (401, 403))
        with patch.object(tickets, 'category_directory', return_value=[{'id': 'rice', 'name': 'Rice / Palay', 'available': True}]):
            response = self.request(tickets.TicketCategoryListView, 'get', actor())
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.data[0]), {'id', 'name', 'available'})

    def test_category_required_for_new_tickets_even_if_worker_id_is_supplied(self):
        for category_id in [None, '', 'unknown', {}, []]:
            with self.subTest(category_id=category_id), patch.object(tickets, 'create_ticket') as write:
                payload = {'title': 'Rice', 'concern': 'Rice leaves', 'categoryId': category_id, 'extensionWorkerId': 'w1'}
                self.assertEqual(self.request(tickets.SubmitTicketView, 'post', actor(), payload).status_code, 400)
                write.assert_not_called()

    def test_similar_tickets_match_category_despite_admin_reassignment(self):
        records = [
            {**TICKET, 'id': 'mine', 'categoryId': 'rice', 'extensionWorkerId': 'different-worker', 'keywords': ['rice']},
            {**TICKET, 'id': 'wrong-category', 'categoryId': 'corn', 'keywords': ['rice']},
            {**TICKET, 'id': 'other-farmer', 'categoryId': 'rice', 'participants': ['outsider'], 'keywords': ['rice']},
        ]
        fake = MagicMock()
        fake.collection.return_value.where.return_value.get.return_value = [SimpleNamespace(id=item['id'], to_dict=lambda record=item: record) for item in records]
        with patch.object(ticket_store, 'db', fake):
            self.assertEqual(ticket_store.find_matching_ticket(None, ['rice'], 'f1', category_id='rice')['id'], 'mine')
        fake.collection.return_value.where.assert_called_once_with('participants', 'array_contains', 'f1')

    def test_continue_existing_ticket_preserves_assignment_and_category(self):
        payload = {'title': 'Rice', 'concern': 'Rice leaves', 'categoryId': 'rice', 'joinExisting': True, 'ticketId': 't1'}
        with patch.object(tickets, 'get_ticket_by_id', return_value={**TICKET, 'categoryId': 'rice'}), patch.object(tickets, 'route_concern') as route, patch.object(tickets, 'create_ticket') as create:
            self.assertEqual(self.request(tickets.SubmitTicketView, 'post', actor(), payload).status_code, 200)
            self.assertEqual(self.request(tickets.SubmitTicketView, 'post', actor(), {**payload, 'categoryId': 'corn'}).status_code, 403)
            route.assert_not_called()
            create.assert_not_called()

    def test_new_ticket_stores_category_and_automatic_assignment_audit(self):
        fake = MagicMock()
        data = {'extensionWorkerId': 'w1', 'extensionWorkerName': 'Test Worker', 'categoryId': 'rice', 'categoryName': 'Rice / Palay', 'title': 'Rice', 'concern': 'Leaves', 'keywords': ['rice'], 'farmerId': 'f1', 'farmerName': 'Test Farmer'}
        with patch.object(ticket_store, 'db', fake), patch.object(ticket_store, 'add_message'):
            ticket_store.create_ticket(data)
        saved = fake.collection.return_value.document.return_value.set.call_args.args[0]
        self.assertEqual(saved['categoryId'], 'rice')
        self.assertEqual(saved['categoryName'], 'Rice / Palay')
        self.assertEqual(saved['assignedBy'], 'system')
        self.assertEqual(saved['assignmentMethod'], 'category')
        self.assertEqual(saved['participants'], ['f1'])

    def test_public_signup_cannot_create_admin(self):
        response = self.request(supabase_views.SupabaseRegisterView, 'post', None,
                                {'email': 'test@example.test', 'password': 'irrelevant', 'mobileNumber': 'test', 'role': 'admin'})
        self.assertEqual(response.status_code, 400)

    def test_disabled_or_pending_accounts_cannot_use_existing_tokens(self):
        for data in [{**FARMER, 'isActive': False}, {**WORKER, 'isPending': True}]:
            with patch.object(authentication, 'get_user_by_id', return_value=data):
                self.assertIsNone(authentication.FirebaseJWTAuthentication().get_user({'user_id': data['id']}))
        with patch.object(authentication, 'get_user_by_id', return_value=FARMER):
            user = authentication.FirebaseJWTAuthentication().get_user({'user_id': 'f1', 'role': 'admin'})
            self.assertEqual(user.role, 'farmer')

    def test_superadmin_credentials_cannot_be_empty(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.request(system_views.SuperAdminLoginView, 'post', None).status_code, 401)


class CapacityTests(unittest.TestCase):
    def test_capacity_boundaries_and_existing_oversized_tickets(self):
        for count, expected in [(0, 'open'), (1, 'open'), (7, 'open'), (8, 'near'), (9, 'near'), (10, 'full'), (12, 'full')]:
            with self.subTest(count=count):
                data = {'participants': [f'f{i}' for i in range(count)]}
                original = list(data['participants'])
                capacity = ticket_capacity(data)
                self.assertEqual(capacity, {'count': count, 'limit': 10, 'warningAt': 8, 'remaining': max(0, 10-count), 'status': expected})
                self.assertEqual(data['participants'], original)

    def test_capacity_counts_distinct_farmers_and_includes_owner(self):
        ticket = {'participants': ['f1', 'f1', '', None, 'f2'], 'farmerId': 'f3', 'extensionWorkerId': 'w1', 'assignedBy': 'a1'}
        self.assertEqual(ticket_capacity(ticket)['count'], 3)
        self.assertEqual(ticket_capacity({'farmerId': 'owner'})['count'], 1)
        self.assertEqual(ticket_capacity({'participants': ['owner'], 'farmerId': 'owner'})['count'], 1)

    def test_limit_and_warning_have_one_server_source(self):
        with patch('tickets.capacity.PARTICIPANT_LIMIT', 20):
            self.assertEqual(ticket_capacity({'participants': [str(i) for i in range(16)]}),
                             {'count': 16, 'limit': 20, 'warningAt': 16, 'remaining': 4, 'status': 'near'})

    def test_join_uses_firestore_transaction(self):
        fake = MagicMock()
        with patch.object(ticket_store, 'db', fake), patch.object(ticket_store.firestore, 'transactional') as wrap:
            ticket_store.join_ticket('t1', 'new-farmer')
            wrap.assert_called_once_with(ticket_store._join_ticket_transaction)
            wrap.return_value.assert_called_once_with(fake.transaction.return_value, fake.collection.return_value.document.return_value, 'new-farmer')
            fake.transaction.assert_called_once()

    def test_final_place_allowed_and_next_join_rejected(self):
        data = {'participants': [f'f{i}' for i in range(9)], 'farmerId': 'f0'}
        ref = MagicMock()
        ref.get.side_effect = lambda **kwargs: SimpleNamespace(exists=True, to_dict=lambda: dict(data))
        transaction = MagicMock()
        transaction.update.side_effect = lambda doc, update: data.update(update)
        result = ticket_store._join_ticket_transaction(transaction, ref, 'tenth')
        self.assertTrue(result['joined'])
        self.assertEqual(result['capacity']['status'], 'full')
        self.assertEqual(result['capacity']['count'], 10)
        ref.get.assert_called_once_with(transaction=transaction)
        transaction.update.assert_called_once_with(ref, {'participants': [*[f'f{i}' for i in range(9)], 'tenth']})
        with self.assertRaises(TicketCapacityReached) as caught:
            ticket_store._join_ticket_transaction(transaction, ref, 'eleventh')
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(len(data['participants']), 10)
        self.assertEqual(transaction.update.call_count, 1)
        ref.update.assert_not_called()

    def test_full_ticket_repeated_join_and_legacy_owner_do_not_write(self):
        for data, existing_id in [
            ({'participants': [f'f{i}' for i in range(10)]}, 'f0'),
            ({'participants': [f'f{i}' for i in range(9)], 'farmerId': 'owner'}, 'owner'),
            ({'participants': [f'f{i}' for i in range(12)]}, 'f0'),
        ]:
            with self.subTest(ticket=data):
                ref, transaction = MagicMock(), MagicMock()
                ref.get.return_value = SimpleNamespace(exists=True, to_dict=lambda: data)
                result = ticket_store._join_ticket_transaction(transaction, ref, existing_id)
                self.assertFalse(result['joined'])
                self.assertEqual(result['capacity']['status'], 'full')
                transaction.update.assert_not_called()

    def test_join_rejects_missing_ticket_and_invalid_farmer(self):
        from rest_framework.exceptions import NotFound, ValidationError
        ref, transaction = MagicMock(), MagicMock()
        ref.get.return_value = SimpleNamespace(exists=False)
        with self.assertRaises(NotFound):
            ticket_store._join_ticket_transaction(transaction, ref, 'f1')
        transaction.update.assert_not_called()
        for farmer_id in [None, '', ' ', []]:
            with self.subTest(farmer_id=farmer_id), self.assertRaises(ValidationError):
                ticket_store.join_ticket('t1', farmer_id)

    def test_capacity_in_details_and_similar_ticket_response(self):
        full = {**TICKET, 'categoryId': 'rice', 'participants': [f'f{i}' for i in range(10)]}
        request = RequestTests().request
        with patch.object(tickets, 'get_ticket_by_id', return_value=full), patch.object(tickets, 'get_ticket_messages', return_value=[]):
            for user in [actor(), actor('extension_worker', 'w1'), actor('admin', 'a1')]:
                response = request(tickets.TicketDetailView, 'get', user, ticket_id='t1')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['capacity']['status'], 'full')
            self.assertEqual(request(tickets.TicketDetailView, 'get', actor('farmer', 'outsider'), ticket_id='t1').status_code, 403)
        payload = {'title': 'Rice', 'concern': 'Rice leaves', 'categoryId': 'rice'}
        with patch.object(tickets, 'find_matching_ticket', return_value=full):
            self.assertEqual(request(tickets.CheckTicketView, 'post', actor(), payload).data['ticket']['capacity']['count'], 10)
        with patch.object(tickets, 'get_ticket_by_id', return_value=full), patch.object(tickets, 'create_ticket') as create:
            response = request(tickets.SubmitTicketView, 'post', actor(), {**payload, 'joinExisting': True, 'ticketId': 't1'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['capacity']['status'], 'full')
            self.assertEqual(request(tickets.SubmitTicketView, 'post', actor('farmer', 'outsider'), {**payload, 'joinExisting': True, 'ticketId': 't1'}).status_code, 403)
            create.assert_not_called()


class SocketTests(unittest.IsolatedAsyncioTestCase):
    async def test_browser_cookie_is_verified_against_current_account(self):
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken()
        token['user_id'] = 'f1'
        token['role'] = 'admin'
        scope = {'headers': [(b'cookie', f'token={token}'.encode())]}
        with patch.object(authentication, 'get_user_by_id', return_value=FARMER):
            user = await authenticate_scope(scope)
        self.assertEqual((user.id, user.role), ('f1', 'farmer'))
        self.assertIsNone(await authenticate_scope({'headers': []}))
        with patch.object(authentication, 'get_user_by_id', return_value={**FARMER, 'isActive': False}), patch.object(authentication.supabase.auth, 'get_user', return_value=SimpleNamespace(user=None)):
            self.assertIsNone(await authenticate_scope(scope))

    async def connect(self, consumer, user, kwargs, allowed):
        scope = {'type': 'websocket', 'path': '/ws/test/', 'headers': [], 'url_route': {'kwargs': kwargs}, 'user': user}
        communicator = ApplicationCommunicator(consumer.as_asgi(), scope)
        await communicator.send_input({'type': 'websocket.connect'})
        event = await communicator.receive_output(timeout=2)
        self.assertEqual(event['type'], 'websocket.accept' if allowed else 'websocket.close')
        await communicator.send_input({'type': 'websocket.disconnect', 'code': 1000})
        await communicator.wait(timeout=2)

    async def test_ticket_socket_checks_membership(self):
        with patch('tickets.firebase_service.get_ticket_by_id', return_value=TICKET):
            for user, allowed in [(None, False), (actor('farmer', 'other'), False), (actor('extension_worker', 'w2'), False),
                                  (actor(), True), (actor('extension_worker', 'w1'), True), (actor('admin', 'a1'), True)]:
                await self.connect(TicketConsumer, user, {'ticket_id': 't1'}, allowed)

    async def test_notification_socket_only_accepts_its_owner(self):
        for user, allowed in [(None, False), (actor(), True), (actor('farmer', 'other'), False), (actor('admin', 'a1'), False)]:
            await self.connect(NotificationConsumer, user, {'user_id': 'f1'}, allowed)
        await self.connect(AdminUpdatesConsumer, None, {}, False)

    async def test_revoked_socket_does_not_receive_events(self):
        consumer = NotificationConsumer()
        consumer.scope = {'user': actor(), 'url_route': {'kwargs': {'user_id': 'f1'}}}
        consumer.send = AsyncMock(); consumer.close = AsyncMock()
        with patch('core.consumers.authenticate_scope', new=AsyncMock(return_value=None)):
            await consumer.send_notification({'data': {'message': 'private'}})
        consumer.send.assert_not_called()
        consumer.close.assert_awaited_once_with(code=4403)

    async def test_middleware_replaces_untrusted_scope_user(self):
        app = AsyncMock()
        verified = actor()
        with patch('core.websocket_auth.authenticate_scope', new=AsyncMock(return_value=verified)):
            await TokenAuthMiddleware(app)({'user': actor('admin', 'forged')}, AsyncMock(), AsyncMock())
        self.assertEqual(app.call_args.args[0]['user'].id, 'f1')

    async def test_reassignment_revokes_old_worker_socket_and_accepts_new_worker(self):
        reassigned = {**TICKET, 'extensionWorkerId': 'w2'}
        consumer = TicketConsumer()
        consumer.scope = {'user': actor('extension_worker', 'w1'), 'url_route': {'kwargs': {'ticket_id': 't1'}}}
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()
        with patch('tickets.firebase_service.get_ticket_by_id', return_value=reassigned), patch('core.consumers.authenticate_scope', new=AsyncMock(return_value=actor('extension_worker', 'w1'))):
            await consumer.ticket_message({'data': {'type': 'assignment_updated'}})
            consumer.send.assert_not_called()
            consumer.close.assert_awaited_once_with(code=4403)
            await self.connect(TicketConsumer, actor('extension_worker', 'w1'), {'ticket_id': 't1'}, False)
            await self.connect(TicketConsumer, actor('lgu_personnel', 'w2'), {'ticket_id': 't1'}, True)


if __name__ == '__main__':
    unittest.main()
