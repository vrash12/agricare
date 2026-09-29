"""Create repeatable AgriXA demo accounts in the configured Firestore project.

Run from the server directory with: py -3.12 -u scripts/seed_demo_accounts.py
The credential CSV is written before any users are created so an interrupted run
can be retried without losing the generated passwords.
"""

import argparse
import csv
import hashlib
import os
import secrets
import string
import sys
import time
from pathlib import Path
from dotenv import dotenv_values

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from accounts.firebase_service import create_user, update_user  # noqa: E402
from core.firebase import db  # noqa: E402


FARMERS = [
    ('Maria Lourdes D.', 'Santos', 'Poblacion'),
    ('Jose Miguel R.', 'Cruz', 'San Isidro'),
    ('Ana Patricia M.', 'Reyes', 'San Jose'),
    ('Roberto L.', 'Dela Cruz', 'Santa Cruz'),
    ('Liza Mae C.', 'Bautista', 'San Roque'),
    ('Fernando P.', 'Garcia', 'Mabini'),
    ('Evelyn S.', 'Ramos', 'Maligaya'),
    ('Mark Anthony T.', 'Mendoza', 'Bagong Silang'),
    ('Jasmine A.', 'Villanueva', 'San Antonio'),
    ('Edgar R.', 'Navarro', 'San Vicente'),
    ('Rosalie B.', 'Aquino', 'Poblacion'),
    ('Noel Vincent G.', 'Flores', 'San Isidro'),
    ('Marites U.', 'Castillo', 'San Jose'),
    ('Daniel C.', 'Soriano', 'Santa Cruz'),
    ('Cristina O.', 'Valdez', 'San Roque'),
]

WORKERS = [
    ('Jessie Hion L.', 'Payo', 'Municipal Agriculturist', 'jessie.payo'),
    ('Karla Mae V.', 'Asuncion', 'Rice Report Officer', 'karla.asuncion'),
    ('John Derick P.', 'Lacap', 'Corn Program', 'john.lacap'),
    ('Stephanie Danielle', 'Lirado', 'High Value Crops Development Program Coordinator', 'stephanie.lirado'),
    ('Aervin Tirol', 'Cuchapin', 'Livestock Coordinator', 'aervin.cuchapin'),
    ('Arthur V.', 'Dupitas', 'Organic Program Coordinator', 'arthur.dupitas'),
    ('Regine C.', 'Dungca', 'RSBSA Focal Person', 'regine.dungca'),
    ('Maria Cristina R.', 'Villanueva', 'Seed Inspector', 'maria.villanueva'),
    ('Paolo Miguel S.', 'Reyes', 'Crop Insurance Coordinator', 'paolo.reyes'),
    ('Lea Patricia M.', 'Navarro', 'Agribusiness and Marketing Program Coordinator', 'lea.navarro'),
]

FIELDS = ['role', 'fullName', 'username', 'temporaryPassword', 'email', 'mobileNumber', 'status']


def double_sha256(password):
    first = hashlib.sha256(password.encode('utf-8')).hexdigest()
    return hashlib.sha256(first.encode('utf-8')).hexdigest()


def new_password():
    alphabet = string.ascii_letters + string.digits
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(18))
        if any(c.islower() for c in password) and any(c.isupper() for c in password) and any(c.isdigit() for c in password):
            return password


def specs(positions, gmail_sender):
    sender_local, separator, sender_domain = gmail_sender.partition('@')
    if not separator or sender_domain.lower() != 'gmail.com':
        raise RuntimeError('A configured @gmail.com sender is required for demo email aliases.')
    result = []
    for index, (first, last, barangay) in enumerate(FARMERS, start=1):
        result.append({
            'firstName': first, 'lastName': last, 'barangay': barangay,
            'username': f'demo.farmer.{index:02d}', 'role': 'farmer', 'positionId': '',
        })
    for first, last, position, slug in WORKERS:
        if position not in positions:
            raise RuntimeError(f'Missing LGU position: {position}')
        result.append({
            'firstName': first, 'lastName': last, 'barangay': '',
            'username': f'demo.lgu.{slug}', 'role': 'extension_worker',
            'positionId': positions[position],
        })
    result.append({
        'firstName': 'AgriXA Demo', 'lastName': 'Admin', 'barangay': '',
        'username': 'demo.admin.01', 'role': 'admin', 'positionId': '',
    })
    for index, spec in enumerate(result, start=1):
        spec['email'] = f'{sender_local}+agrixa-demo-{index:02d}@gmail.com'
        spec['mobileNumber'] = f'{index:011d}'
    return result


def save_csv(path, rows):
    temp_path = path.with_suffix(path.suffix + '.tmp')
    with temp_path.open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    for attempt in range(10):
        try:
            temp_path.replace(path)
            return
        except PermissionError:
            if attempt == 9:
                raise
            time.sleep(0.2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='Check accounts without writing to Firestore or CSV')
    parser.add_argument('--migrate-emails', action='store_true', help='Replace the original example.com addresses with Gmail aliases')
    parser.add_argument('--output', type=Path, default=SERVER_DIR.parent / 'demo-account-credentials.csv')
    args = parser.parse_args()

    gmail_sender = os.getenv('GMAIL_USER') or dotenv_values(SERVER_DIR / '.env').get('GMAIL_USER') or ''
    positions = {doc.to_dict().get('name'): doc.id for doc in db.collection('positions').stream(timeout=20)}
    planned = specs(positions, gmail_sender)
    existing = [{'id': doc.id, **doc.to_dict()} for doc in db.collection('users').stream(timeout=20)]
    by_username = {user.get('username'): user for user in existing}
    by_email = {user.get('email'): user for user in existing if user.get('email')}
    by_mobile = {user.get('mobileNumber'): user for user in existing if user.get('mobileNumber')}

    for spec in planned:
        current = by_username.get(spec['username'])
        if current and current.get('role') != spec['role']:
            raise RuntimeError(f"Username belongs to another account: {spec['username']}")
        if current and current.get('email') != spec['email']:
            old_demo_email = f"{spec['username']}@agrixa-demo.example.com"
            if not args.migrate_emails or current.get('email') != old_demo_email:
                raise RuntimeError(f"Unexpected email for account: {spec['username']}")
        for field, lookup in (('email', by_email), ('mobileNumber', by_mobile)):
            owner = lookup.get(spec[field])
            if owner and owner.get('username') != spec['username']:
                raise RuntimeError(f"{field} already belongs to another account: {spec['username']}")

    missing = [spec for spec in planned if spec['username'] not in by_username]
    to_update = [spec for spec in planned if spec['username'] in by_username and by_username[spec['username']].get('email') != spec['email']]
    print(f'Existing users: {len(existing)}; planned demo accounts: {len(planned)}; to create: {len(missing)}; emails to update: {len(to_update)}', flush=True)
    if args.dry_run:
        for spec in planned:
            print(f"{spec['role']:16} {spec['firstName']} {spec['lastName']} ({spec['username']})", flush=True)
        return

    output = args.output.resolve()
    if output.exists():
        with output.open(newline='', encoding='utf-8') as file:
            rows = list(csv.DictReader(file))
        if not rows or set(rows[0]) != set(FIELDS):
            raise RuntimeError(f'Credential file has an unexpected format: {output}')
    else:
        rows = []
    rows_by_username = {row['username']: row for row in rows}
    for spec in missing:
        if spec['username'] not in rows_by_username:
            row = {
                'role': spec['role'],
                'fullName': f"{spec['firstName']} {spec['lastName']}",
                'username': spec['username'],
                'temporaryPassword': new_password(),
                'email': spec['email'],
                'mobileNumber': spec['mobileNumber'],
                'status': 'pending',
            }
            rows.append(row)
            rows_by_username[spec['username']] = row
    if missing:
        save_csv(output, rows)

    for spec in to_update:
        update_user(by_username[spec['username']]['id'], {'email': spec['email']})
        print(f"Updated email: {spec['username']}", flush=True)

    created = 0
    for spec in missing:
        row = rows_by_username[spec['username']]
        if not row['temporaryPassword']:
            raise RuntimeError(f"Missing password for {spec['username']}")
        create_user({
            **spec,
            'passwordHash': double_sha256(row['temporaryPassword']),
            'isPending': False,
        })
        created += 1
        print(f"Created {created}/{len(missing)}: {spec['username']}", flush=True)

    if output.exists():
        for spec in planned:
            if spec['username'] in rows_by_username:
                row = rows_by_username[spec['username']]
                row['email'] = spec['email']
                row['status'] = 'created'
        save_csv(output, rows)
    print(f'Done. Created {created}; updated {len(to_update)} emails; already present {len(planned) - created}. Credentials: {output}', flush=True)
    if not missing and not output.exists():
        print('Existing demo passwords cannot be recovered; no credential file was found.', flush=True)


if __name__ == '__main__':
    main()
