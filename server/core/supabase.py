import os
from supabase import create_client

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY')
anon_key = os.getenv('SUPABASE_ANON_KEY')

supabase = create_client(url, key)
supabase_anon = create_client(url, anon_key)
