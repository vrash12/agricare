import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
import base64

if not firebase_admin._apps:
    firebase_creds_base64 = os.getenv('FIREBASE_CREDENTIALS_BASE64')
    if firebase_creds_base64:
        creds_json = json.loads(base64.b64decode(firebase_creds_base64).decode('utf-8'))
        cred = credentials.Certificate(creds_json)
    else:
        cred = credentials.Certificate(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'firebase-credentials.json'))
    
    firebase_admin.initialize_app(cred)

db = firestore.client()
