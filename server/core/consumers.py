import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from accounts.permissions import APPLICATION_ROLES, is_active_user
from tickets.permissions import can_access_ticket
from .websocket_auth import authenticate_scope

class SystemConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add('system', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('system', self.channel_name)

    async def system_update(self, event):
        await self.send(text_data=json.dumps(event['data']))

class ProtectedConsumer(AsyncWebsocketConsumer):
    async def permitted(self):
        user = self.scope.get('user')
        return is_active_user(user) and user.role in APPLICATION_ROLES

    async def connect(self):
        if not await self.permitted():
            await self.close(code=4403)
            return
        self.group_name = self.get_group_name()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, 'group_name', None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def deliver(self, event):
        # Recheck disabled accounts and membership on long-lived connections.
        self.scope['user'] = await authenticate_scope(self.scope)
        if not await self.permitted():
            await self.close(code=4403)
            return
        await self.send(text_data=json.dumps(event['data']))


class NotificationConsumer(ProtectedConsumer):
    async def permitted(self):
        return (await super().permitted()
                and self.scope['user'].id == self.scope['url_route']['kwargs']['user_id'])

    def get_group_name(self):
        return f"notifications_{self.scope['user'].id}"

    async def send_notification(self, event):
        await self.deliver(event)


class AdminUpdatesConsumer(ProtectedConsumer):
    def get_group_name(self):
        # Contains refresh signals only; the worker directory uses this channel too.
        return 'admin_updates'

    async def admin_update(self, event):
        await self.deliver({'data': {'type': event['data'].get('type')}})


class TicketUpdatesConsumer(ProtectedConsumer):
    def get_group_name(self):
        return 'ticket_updates'

    async def ticket_update(self, event):
        await self.deliver({'data': {'type': 'ticket_update'}})


class TicketConsumer(ProtectedConsumer):
    async def permitted(self):
        if not await super().permitted():
            return False
        from tickets.firebase_service import get_ticket_by_id
        ticket = await database_sync_to_async(get_ticket_by_id)(self.scope['url_route']['kwargs']['ticket_id'])
        return can_access_ticket(self.scope['user'], ticket)

    def get_group_name(self):
        return f"ticket_{self.scope['url_route']['kwargs']['ticket_id']}"

    async def ticket_message(self, event):
        await self.deliver(event)
