import secrets
import redis
import os
import requests
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from core.firebase import db

redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

OTP_EXPIRY = 300  # 5 minutes
OTP_COLLECTION = 'otps'
PENDING_REG_COLLECTION = 'pending_registrations'

def generate_otp():
    return str(100000 + secrets.randbelow(900000))

def _redis_available():
    try:
        redis_client.ping()
        return True
    except Exception:
        return False

def store_otp(mobile_number, otp):
    if _redis_available():
        redis_client.setex(f'otp:{mobile_number}', OTP_EXPIRY, otp)
    else:
        db.collection(OTP_COLLECTION).document(mobile_number).set({
            'otp': otp,
            'expiresAt': datetime.now(timezone.utc) + timedelta(seconds=OTP_EXPIRY)
        })

def verify_otp(mobile_number, otp):
    if _redis_available():
        stored = redis_client.get(f'otp:{mobile_number}')
        if stored and stored.decode() == otp:
            redis_client.delete(f'otp:{mobile_number}')
            return True
        return False
    else:
        doc = db.collection(OTP_COLLECTION).document(mobile_number).get()
        if not doc.exists:
            return False
        data = doc.to_dict()
        if data['otp'] != otp:
            return False
        if datetime.now(timezone.utc) > data['expiresAt']:
            db.collection(OTP_COLLECTION).document(mobile_number).delete()
            return False
        db.collection(OTP_COLLECTION).document(mobile_number).delete()
        return True


def send_otp(mobile_number, email=None):
    if not email:
        raise ValueError('A verified email address is required to send an OTP.')
    otp = generate_otp()
    sender = os.getenv('GMAIL_USER') or os.getenv('EMAIL_HOST_USER')
    app_password = os.getenv('GMAIL_APP_PASSWORD') or os.getenv('EMAIL_HOST_PASSWORD')
    if not sender or not app_password:
        raise RuntimeError('Email delivery is not configured.')
    try:
        html_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background-color: #fff9e9; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #204a0e; font-size: 28px; margin: 0;">
                        Agri<span style="color: #478347;">Care</span>
                    </h1>
                    <p style="color: #478347; font-size: 14px; margin: 4px 0 0;">Smart Farming Support System</p>
                </div>
                <div style="background-color: #fff; border-radius: 8px; padding: 24px; border: 1px solid #87b787;">
                    <p style="color: #204a0e; font-size: 15px; margin: 0 0 16px;">Hello,</p>
                    <p style="color: #204a0e; font-size: 15px; margin: 0 0 24px;">Your OTP verification code is:</p>
                    <div style="text-align: center; background-color: #d4eed1; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <span style="font-size: 36px; font-weight: bold; color: #204a0e; letter-spacing: 8px;">{otp}</span>
                    </div>
                    <p style="color: #478347; font-size: 13px; margin: 0; text-align: center;">Valid for <strong>5 minutes</strong>. Do not share this code.</p>
                </div>
                <p style="color: #87b787; font-size: 12px; text-align: center; margin-top: 24px;">
                    If you did not request this, please ignore this email.
                </p>
            </div>
        """
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'AgriCare OTP Verification'
        msg['From'] = f'AgriCare <{sender}>'
        msg['To'] = email
        msg.attach(MIMEText(html_message, 'html'))
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=15) as server:
            server.login(sender, app_password)
            server.sendmail(sender, email, msg.as_string())
        store_otp(mobile_number, otp)
        return True
    except Exception as exc:
        raise RuntimeError('Failed to send OTP email.') from exc


def send_approval_email(email, first_name):
    if os.getenv('DEBUG', 'True') == 'True':
        print(f'[DEV] Approval email for {email}: Account approved')
        return True
    try:
        html_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background-color: #fff9e9; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #204a0e; font-size: 28px; margin: 0;">
                        Agri<span style="color: #478347;">Care</span>
                    </h1>
                    <p style="color: #478347; font-size: 14px; margin: 4px 0 0;">Smart Farming Support System</p>
                </div>
                <div style="background-color: #fff; border-radius: 8px; padding: 24px; border: 1px solid #87b787;">
                    <p style="color: #204a0e; font-size: 15px; margin: 0 0 16px;">Hello, {first_name}!</p>
                    <p style="color: #204a0e; font-size: 15px; margin: 0 0 24px;">Your extension worker account has been <strong>approved</strong>. You can now log in to AgriCare and start handling tickets.</p>
                    <div style="text-align: center; background-color: #d4eed1; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <span style="font-size: 32px;">✅</span>
                        <p style="color: #204a0e; font-weight: bold; margin: 8px 0 0;">Account Approved</p>
                    </div>
                    <p style="color: #478347; font-size: 13px; margin: 0; text-align: center;">Welcome to the AgriCare team!</p>
                </div>
                <p style="color: #87b787; font-size: 12px; text-align: center; margin-top: 24px;">
                    If you did not register for this account, please ignore this email.
                </p>
            </div>
        """
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'AgriCare — Your Account Has Been Approved'
        msg['From'] = f'AgriCare <{os.getenv("GMAIL_USER")}>'
        msg['To'] = email
        msg.attach(MIMEText(html_message, 'html'))
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(os.getenv('GMAIL_USER'), os.getenv('GMAIL_APP_PASSWORD'))
            server.sendmail(os.getenv('GMAIL_USER'), email, msg.as_string())
        print(f'[Gmail] Approval email sent to {email}')
        return True
    except Exception as e:
        print(f'[Gmail Error] {str(e)}')
        return False


def store_pending_registration(mobile_number, data):
    data['isVerified'] = False
    data['isCompleted'] = False
    if _redis_available():
        redis_client.setex(f'pending_reg:{mobile_number}', OTP_EXPIRY, json.dumps(data))
    else:
        db.collection(PENDING_REG_COLLECTION).document(mobile_number).set({
            'data': json.dumps(data),
            'expiresAt': datetime.now(timezone.utc) + timedelta(seconds=OTP_EXPIRY)
        })
        
def get_pending_registration(mobile_number=None, email=None):
    if email and not mobile_number:
        if _redis_available():
            for key in redis_client.scan_iter('pending_reg:*'):
                data = redis_client.get(key)
                if data:
                    parsed = json.loads(data)
                    if parsed.get('email') == email:
                        return parsed
            return None
        else:
            docs = db.collection(PENDING_REG_COLLECTION).get()
            for doc in docs:
                data = doc.to_dict()
                parsed = json.loads(data['data'])
                if parsed.get('email') == email:
                    return parsed
            return None
    if _redis_available():
        data = redis_client.get(f'pending_reg:{mobile_number}')
        return json.loads(data) if data else None
    else:
        doc = db.collection(PENDING_REG_COLLECTION).document(mobile_number).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        parsed = json.loads(data['data'])
        if not parsed.get('isVerified') and data.get('expiresAt') and datetime.now(timezone.utc) > data['expiresAt']:
            db.collection(PENDING_REG_COLLECTION).document(mobile_number).delete()
            return None
        return parsed


def clear_pending_registration(mobile_number):
    if _redis_available():
        redis_client.delete(f'pending_reg:{mobile_number}')
    else:
        db.collection(PENDING_REG_COLLECTION).document(mobile_number).delete()

def mark_otp_verified(mobile_number):
    if _redis_available():
        redis_client.setex(f'otp_verified:{mobile_number}', OTP_EXPIRY, '1')
    else:
        db.collection(OTP_COLLECTION).document(f'verified_{mobile_number}').set({
            'verified': True,
            'expiresAt': datetime.now(timezone.utc) + timedelta(seconds=OTP_EXPIRY)
        })

def is_otp_verified(mobile_number):
    if _redis_available():
        return redis_client.get(f'otp_verified:{mobile_number}') is not None
    else:
        doc = db.collection(OTP_COLLECTION).document(f'verified_{mobile_number}').get()
        if not doc.exists:
            return False
        data = doc.to_dict()
        if datetime.now(timezone.utc) > data['expiresAt']:
            db.collection(OTP_COLLECTION).document(f'verified_{mobile_number}').delete()
            return False
        return True

def clear_otp_verified(mobile_number):
    if _redis_available():
        redis_client.delete(f'otp_verified:{mobile_number}')
    else:
        db.collection(OTP_COLLECTION).document(f'verified_{mobile_number}').delete()
        
def mark_registration_verified(mobile_number):
    if _redis_available():
        data = redis_client.get(f'pending_reg:{mobile_number}')
        if data:
            parsed = json.loads(data)
            parsed['isVerified'] = True
            redis_client.persist(f'pending_reg:{mobile_number}')
            redis_client.set(f'pending_reg:{mobile_number}', json.dumps(parsed))
    else:
        doc = db.collection(PENDING_REG_COLLECTION).document(mobile_number).get()
        if doc.exists:
            data = doc.to_dict()
            parsed = json.loads(data['data'])
            parsed['isVerified'] = True
            db.collection(PENDING_REG_COLLECTION).document(mobile_number).update({
                'data': json.dumps(parsed),
                'expiresAt': None
            })
            
def mark_registration_completed(mobile_number):
    if _redis_available():
        data = redis_client.get(f'pending_reg:{mobile_number}')
        if data:
            parsed = json.loads(data)
            parsed['isCompleted'] = True
            redis_client.set(f'pending_reg:{mobile_number}', json.dumps(parsed))
    else:
        doc = db.collection(PENDING_REG_COLLECTION).document(mobile_number).get()
        if doc.exists:
            data = doc.to_dict()
            parsed = json.loads(data['data'])
            parsed['isCompleted'] = True
            db.collection(PENDING_REG_COLLECTION).document(mobile_number).update({'data': json.dumps(parsed)})


