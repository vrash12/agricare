from core.firebase import db

SYSTEM_COLLECTION = 'system'

DEFAULT_THEME = {
    'primaryColor': '#478347',
    'secondaryColor': '#87b787',
    'dangerColor': '#e53e3e',
    'backgroundColor': '#fff9e9',
    'textColor': '#204a0e',
    'borderRadius': '8px',
    'minecraftMode': False,
    'minecraftLogo': False,
    'minecraftHero': False,
    'minecraftSteve': False,
    'minecraftMusic': False,
}

def get_theme():
    doc = db.collection(SYSTEM_COLLECTION).document('theme').get()
    if doc.exists:
        data = doc.to_dict()
        merged = {**DEFAULT_THEME, **data}
        if merged != data:
            db.collection(SYSTEM_COLLECTION).document('theme').set(merged)
        return merged
    db.collection(SYSTEM_COLLECTION).document('theme').set(DEFAULT_THEME)
    return DEFAULT_THEME

def update_theme(data):
    db.collection(SYSTEM_COLLECTION).document('theme').set(data, merge=True)

def get_system_config():
    doc = db.collection(SYSTEM_COLLECTION).document('config').get()
    defaults = {
        'isSystemEnabled': True,
        'disabledEndpoints': [],
        'useSupabaseAuth': False,
        'dashboardTemplates': {'admin': 1, 'farmer': 1, 'extension_worker': 1},
    }
    if doc.exists:
        data = doc.to_dict()
        for key, val in defaults.items():
            if key not in data:
                data[key] = val
        return data
    return defaults

def update_system_config(data):
    db.collection(SYSTEM_COLLECTION).document('config').set(data, merge=True)
