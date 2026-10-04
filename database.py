import sqlite3
import os
from datetime import datetime, timedelta
import json

import shutil

def get_db_path():
    # Cek apakah berjalan di Vercel, AWS Lambda, atau direktori read-only
    is_serverless = (
        os.environ.get('VERCEL') == '1' or
        bool(os.environ.get('AWS_LAMBDA_FUNCTION_NAME')) or
        bool(os.environ.get('VERCEL_ENV')) or
        not os.access(os.path.dirname(os.path.abspath(__file__)), os.W_OK)
    )
    if is_serverless:
        tmp_db = '/tmp/warehouse.db'
        bundled_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'warehouse.db')
        if not os.path.exists(tmp_db) and os.path.exists(bundled_db):
            try:
                shutil.copy2(bundled_db, tmp_db)
            except Exception as e:
                print("Error copying database to /tmp:", e)
        return tmp_db
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'warehouse.db')

def get_db():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Tabel Konfigurasi Toko
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS store_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT 'Satria Celular',
        tagline TEXT DEFAULT 'Solusi Servis HP Cepat, Terpercaya & Bergaransi',
        address TEXT DEFAULT 'Jl. Raya Utama No. 88, Blok A, Sentra Servis HP',
        phone TEXT DEFAULT '0812-3456-7890',
        whatsapp TEXT DEFAULT '6281234567890',
        warranty_note TEXT DEFAULT 'Garansi berlaku untuk sparepart yang diganti sesuai masa garansi. Segel tidak boleh rusak/batal jika terkena air/jatuh.'
    )
    ''')

    # Tabel Kategori Sparepart
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
    )
    ''')

    # Tabel Merk HP
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    ''')

    # Tabel Teknisi
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS technicians (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        specialty TEXT,
        status TEXT DEFAULT 'active'
    )
    ''')

    # Tabel Sparepart (Gudang/Inventory)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS spareparts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category_id INTEGER,
        brand_id INTEGER,
        compatible_models TEXT,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 2,
        cost_price REAL NOT NULL DEFAULT 0,
        sell_price REAL NOT NULL DEFAULT 0,
        location TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
        FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE SET NULL
    )
    ''')

    # Tabel Tiket Servis HP Masuk
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS service_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT,
        device_brand TEXT NOT NULL,
        device_model TEXT NOT NULL,
        device_color TEXT,
        imei_sn TEXT,
        screen_lock TEXT,
        physical_condition TEXT,
        damage_description TEXT NOT NULL,
        technician_id INTEGER,
        status TEXT NOT NULL DEFAULT 'antrean',
        service_fee REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        down_payment REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'belum_lunas',
        warranty_days INTEGER DEFAULT 30,
        technician_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (technician_id) REFERENCES technicians (id) ON DELETE SET NULL
    )
    ''')

    # Tabel Relasi Sparepart Terpasang di Servis (Pemakaian Stok)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS service_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        sparepart_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_cost_price REAL NOT NULL DEFAULT 0,
        unit_sell_price REAL NOT NULL DEFAULT 0,
        subtotal REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES service_orders (id) ON DELETE CASCADE,
        FOREIGN KEY (sparepart_id) REFERENCES spareparts (id) ON DELETE RESTRICT
    )
    ''')

    # Tabel Log Mutasi Stok
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sparepart_id INTEGER NOT NULL,
        change_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        current_stock INTEGER NOT NULL,
        reference_id TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sparepart_id) REFERENCES spareparts (id) ON DELETE CASCADE
    )
    ''')

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def seed_initial_data(conn):
    cursor = conn.cursor()

    # Cek apakah sudah ada setting
    cursor.execute("SELECT COUNT(*) FROM store_settings")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
        INSERT INTO store_settings (name, tagline, address, phone, whatsapp, warranty_note)
        VALUES ('Satria Celular', 'Pusat Servis HP & Sparepart Terpercaya', 'Jl. Pemuda No. 45, Sentra Elektronik & Gadget', '0812-9876-5432', '6281298765432', 'Garansi ganti sparepart 30 hari. Segel utuh, tidak kena air dan tidak jatuh.')
        ''')

    # Cek Kategori
    cursor.execute("SELECT COUNT(*) FROM categories")
    if cursor.fetchone()[0] == 0:
        categories = [
            ('LCD & Touchscreen', 'Modul layar lengkap dan touchscreen kaca depan'),
            ('Baterai (Battery)', 'Baterai original dan OEM kualitas grade A'),
            ('Fleksibel & Board Cas', 'Sub-board cas, fleksibel penghubung, mic board'),
            ('IC & Komponen Mesin', 'IC Power, IC Cas, IC Audio, CPU, eMMC/UFS, Kapasitor'),
            ('Kamera & Lensa', 'Modul kamera depan dan belakang'),
            ('Casing & Backdoor', 'Tutup belakang, frame tengah, bezel kaca'),
            ('Konektor, Switch & Speaker', 'Buzzer musik, earpiece speaker, tombol on/off volume'),
            ('Aksesoris & Tool Servis', 'Lem LCD (T-7000/B-7000), timah, flux, kabel jumper')
        ]
        cursor.executemany("INSERT INTO categories (name, description) VALUES (?, ?)", categories)

    # Cek Merk HP
    cursor.execute("SELECT COUNT(*) FROM brands")
    if cursor.fetchone()[0] == 0:
        brands = [
            ('Apple / iPhone',),
            ('Samsung',),
            ('Xiaomi / Redmi / POCO',),
            ('Oppo',),
            ('Vivo',),
            ('Realme',),
            ('Infinix / Tecno',),
            ('Asus',),
            ('Universal / Multi-Brand',)
        ]
        cursor.executemany("INSERT INTO brands (name) VALUES (?)", brands)

    # Cek Teknisi
    cursor.execute("SELECT COUNT(*) FROM technicians")
    if cursor.fetchone()[0] == 0:
        techs = [
            ('Satria Utama', '081211112222', 'Spesialis IC Mesin & Reballing (Master Tech)', 'active'),
            ('Budi Santoso', '081233334444', 'Spesialis LCD, Ganti Kaca OCA & Baterai', 'active'),
            ('Rian Pratama', '081255556666', 'Teknisi Software, Bypass, Flashing & Fleksibel', 'active')
        ]
        cursor.executemany("INSERT INTO technicians (name, phone, specialty, status) VALUES (?, ?, ?, ?)", techs)

    # Cek Sparepart
    cursor.execute("SELECT COUNT(*) FROM spareparts")
    if cursor.fetchone()[0] == 0:
        parts = [
            ('LCD-IP11-CROWN', 'LCD iPhone 11 Fullset Crown Incell', 1, 1, 'iPhone 11 (A2111, A2223)', 6, 2, 285000, 475000, 'Rak A-01', 'Kualitas Incell True Tone Support'),
            ('LCD-IPX-OLED', 'LCD iPhone X Hard OLED Premium', 1, 1, 'iPhone X (A1865, A1901)', 2, 2, 360000, 580000, 'Rak A-02', 'OLED tajam, refresh rate 60Hz stabil'),
            ('LCD-SAMA51-OEM', 'LCD Samsung Galaxy A51 OLED 2.5D', 1, 2, 'Samsung A51 (SM-A515F)', 4, 2, 340000, 520000, 'Rak A-05', 'Fingeprint display on tested'),
            ('LCD-REDMI9-ORIG', 'LCD Redmi 9 / 9A / 9C Fullset Touch', 1, 3, 'Redmi 9, Redmi 9A, Redmi 9C, Poco C3', 8, 3, 135000, 240000, 'Rak A-08', 'Layar jernih kontras bagus'),
            ('BAT-IP11-HIP', 'Baterai iPhone 11 High Capacity 3500mAh', 2, 1, 'iPhone 11', 1, 3, 140000, 260000, 'Rak B-01', 'Perlu restok segera!'),
            ('BAT-SAMA50-ORIG', 'Baterai Samsung A50 / A50s / A30 (EB-BA505ABU)', 2, 2, 'Samsung Galaxy A50, A50s, A30, A20', 5, 2, 85000, 160000, 'Rak B-03', 'Original 100% SEIN standard'),
            ('BAT-REDMINOTE8', 'Baterai BN46 Redmi Note 8 / Redmi 7', 2, 3, 'Redmi Note 8, Redmi 7', 0, 3, 75000, 150000, 'Rak B-06', 'Stok HABIS - Pesan ke distributor'),
            ('FLX-CHG-OPPOA5S', 'Board Cas + Mic Oppo A5s / A7 / Realme 3', 3, 4, 'Oppo A5s, Oppo A7, Realme 3', 7, 2, 22000, 65000, 'Rak C-02', 'Fast charging tested'),
            ('FLX-CHG-VIVOY12', 'Papan Konektor Cas Vivo Y12 / Y15 / Y17', 3, 5, 'Vivo Y12, Y15, Y17, Y3', 6, 2, 24000, 70000, 'Rak C-04', 'Lengkap dengan soket mic & handsfree'),
            ('IC-CHG-PMI632', 'IC Power / Charging PMI632-902-00', 4, 9, 'Redmi Note 7, Note 8, Oppo A5 2020', 10, 3, 38000, 110000, 'Kotak IC-01', 'Original New IC Qualcomm'),
            ('CAM-BACK-IP11', 'Modul Kamera Belakang iPhone 11 Dual Cam', 5, 1, 'iPhone 11', 2, 1, 210000, 390000, 'Rak D-01', 'Normal fokus 0.5x dan 1x'),
            ('LEM-T7000-50ML', 'Lem LCD T-7000 Warna Hitam 50ml', 8, 9, 'Universal Semua HP', 12, 4, 18000, 35000, 'Alat Servis Meja 1', 'Perekat elastis waterproof')
        ]
        cursor.executemany('''
        INSERT INTO spareparts (sku, name, category_id, brand_id, compatible_models, stock, min_stock, cost_price, sell_price, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', parts)

        # Log mutasi awal
        cursor.execute("SELECT id, stock FROM spareparts")
        for row in cursor.fetchall():
            cursor.execute('''
            INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
            VALUES (?, 'in_initial', ?, 0, ?, 'INITIAL-SEED', 'Stok awal sistem warehouse')
            ''', (row['id'], row['stock'], row['stock']))

    # Cek Servis Order Contoh
    cursor.execute("SELECT COUNT(*) FROM service_orders")
    if cursor.fetchone()[0] == 0:
        now = datetime.now()
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        two_days_ago = (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
        three_days_ago = (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")

        # 1. Antrean Masuk
        cursor.execute('''
        INSERT INTO service_orders (
            ticket_number, customer_name, customer_phone, customer_address,
            device_brand, device_model, device_color, imei_sn, screen_lock,
            physical_condition, damage_description, technician_id, status,
            service_fee, discount, total_cost, down_payment, payment_status,
            warranty_days, technician_notes, created_at
        ) VALUES (
            'SC-202610-0001', 'Hendra Wijaya', '081299887766', 'Jl. Merak No. 12',
            'Samsung', 'Galaxy A51 8/128GB', 'Prism Crush Blue', '354892019283741', 'Pola Z',
            'Layar retak seribu, backdoor mulus, unit only', 'Layar blank hitam setelah jatuh, nada dering masih bunyi', 2, 'antrean',
            100000, 0, 100000, 50000, 'dp',
            30, 'Perlu tes ganti LCD modul, mesin dicek masih getar', ?
        )
        ''', (now.strftime("%Y-%m-%d %H:%M:%S"),))

        # 2. Sedang Dikerjakan (Sudah dipasang LCD)
        cursor.execute('''
        INSERT INTO service_orders (
            ticket_number, customer_name, customer_phone, customer_address,
            device_brand, device_model, device_color, imei_sn, screen_lock,
            physical_condition, damage_description, technician_id, status,
            service_fee, discount, total_cost, down_payment, payment_status,
            warranty_days, technician_notes, created_at
        ) VALUES (
            'SC-202610-0002', 'Dewi Lestari', '085712348899', 'Perum Indah Blok C3',
            'Apple / iPhone', 'iPhone 11 128GB', 'White', '359182740192834', 'PIN: 140298',
            'Kaca kamera pecah sedikit, casing tergores pemakaian', 'Layar sentuh ghost touch dan bergaris hijau vertikal', 2, 'pengerjaan',
            120000, 20000, 575000, 100000, 'dp',
            30, 'Memasang LCD Crown Incell, TrueTone dicopy pakai iCopy', ?
        )
        ''', (yesterday,))
        s2_id = cursor.lastrowid
        # Pasang sparepart LCD-IP11-CROWN
        cursor.execute('''
        INSERT INTO service_parts (service_id, sparepart_id, quantity, unit_cost_price, unit_sell_price, subtotal)
        VALUES (?, 1, 1, 285000, 475000, 475000)
        ''', (s2_id,))

        # 3. Selesai Siap Diambil
        cursor.execute('''
        INSERT INTO service_orders (
            ticket_number, customer_name, customer_phone, customer_address,
            device_brand, device_model, device_color, imei_sn, screen_lock,
            physical_condition, damage_description, technician_id, status,
            service_fee, discount, total_cost, down_payment, payment_status,
            warranty_days, technician_notes, created_at, completed_at
        ) VALUES (
            'SC-202610-0003', 'Agus Setiawan', '087855443322', 'Jl. Kenanga No. 7',
            'Oppo', 'Oppo A5s 3/32GB', 'Black', '864719283740192', 'Tanpa Kunci',
            'Konektor cas longgar, casing lecet', 'Tidak bisa mengisi daya cas, harus digoyang-goyang baru mau isi', 3, 'selesai',
            60000, 0, 125000, 0, 'belum_lunas',
            14, 'Sudah diganti board cas baru, arus cas normal 1.8A stabil', ?, ?
        )
        ''', (two_days_ago, now.strftime("%Y-%m-%d %H:%M:%S")))
        s3_id = cursor.lastrowid
        # Pasang sparepart FLX-CHG-OPPOA5S
        cursor.execute('''
        INSERT INTO service_parts (service_id, sparepart_id, quantity, unit_cost_price, unit_sell_price, subtotal)
        VALUES (?, 8, 1, 22000, 65000, 65000)
        ''', (s3_id,))

        # 4. Selesai & Sudah Diambil (Lunas)
        cursor.execute('''
        INSERT INTO service_orders (
            ticket_number, customer_name, customer_phone, customer_address,
            device_brand, device_model, device_color, imei_sn, screen_lock,
            physical_condition, damage_description, technician_id, status,
            service_fee, discount, total_cost, down_payment, payment_status,
            warranty_days, technician_notes, created_at, completed_at
        ) VALUES (
            'SC-202609-0098', 'Rudi Hartono', '081377889900', 'Jl. Sukajadi No. 101',
            'Samsung', 'Galaxy A50', 'White', '356789123456789', 'PIN: 000000',
            'Tutup belakang agak renggang akibat baterai kembung', 'Baterai drop drastis dari 80% langsung mati, baterai kembung', 2, 'diambil',
            70000, 0, 230000, 230000, 'lunas',
            30, 'Ganti baterai EB-BA505ABU baru original, lem backdoor rapi', ?, ?
        )
        ''', (three_days_ago, yesterday))
        s4_id = cursor.lastrowid
        cursor.execute('''
        INSERT INTO service_parts (service_id, sparepart_id, quantity, unit_cost_price, unit_sell_price, subtotal)
        VALUES (?, 6, 1, 85000, 160000, 160000)
        ''', (s4_id,))

    conn.commit()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at", DB_PATH)
