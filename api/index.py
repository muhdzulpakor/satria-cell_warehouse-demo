import os
import sys

# Pastikan root directory masuk ke sys.path agar app dan database dapat diimpor
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app

# Handler alias untuk kompatibilitas penuh runtime Vercel
handler = app
