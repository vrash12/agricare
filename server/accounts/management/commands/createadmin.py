from django.core.management.base import BaseCommand
import hashlib
from accounts.firebase_service import get_user_by_username, create_user

class Command(BaseCommand):
    help = 'Create an admin account'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--firstname', required=True)
        parser.add_argument('--lastname', required=True)
        parser.add_argument('--mobile', required=True)

    def handle(self, *args, **options):
        username = options['username']
        if get_user_by_username(username):
            self.stdout.write(self.style.ERROR(f'User "{username}" already exists'))
            return

        frontend_hash = hashlib.sha256(options['password'].encode()).hexdigest()
        double_hash = hashlib.sha256(frontend_hash.encode()).hexdigest()
        create_user({
            'firstName': options['firstname'],
            'lastName': options['lastname'],
            'barangay': '',
            'username': username,
            'mobileNumber': options['mobile'],
            'passwordHash': double_hash,
            'role': 'admin',
            'isPending': False,
        })

        self.stdout.write(self.style.SUCCESS(f'Admin "{username}" created successfully'))
