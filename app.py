import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from database import get_db, init_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates')
)

# Inisialisasi DB saat start jika belum ada
init_db()

def dict_from_row(row):
    return dict(row) if row else None

# Helper generator nomor tiket otomatis (SC-YYYYMM-XXXX)
def generate_ticket_number(conn):
    prefix = f"SC-{datetime.now().strftime('%Y%m')}-"
    cursor = conn.cursor()
    cursor.execute("SELECT ticket_number FROM service_orders WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1", (f"{prefix}%",))
    last_ticket = cursor.fetchone()
    if last_ticket:
        try:
            last_seq = int(last_ticket['ticket_number'].split('-')[-1])
            new_seq = last_seq + 1
        except Exception:
            new_seq = 1
    else:
        new_seq = 1
    return f"{prefix}{new_seq:04d}"

# Helper hitung total servis otomatis
def recalculate_service_total(conn, service_id):
    cursor = conn.cursor()
    cursor.execute("SELECT service_fee, discount FROM service_orders WHERE id = ?", (service_id,))
    order = cursor.fetchone()
    if not order:
        return

    cursor.execute("SELECT COALESCE(SUM(subtotal), 0) as parts_sum FROM service_parts WHERE service_id = ?", (service_id,))
    parts_sum = cursor.fetchone()['parts_sum']

    fee = order['service_fee'] or 0
    disc = order['discount'] or 0
    total = max(0, (fee + parts_sum) - disc)

    cursor.execute("UPDATE service_orders SET total_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (total, service_id))
    conn.commit()

# --- WEB PAGE ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

# --- API ROUTES ---

# 1. Dashboard Metrics
@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db()
    cursor = conn.cursor()

    # Hitung total sparepart & valuasi modal
    cursor.execute("SELECT COUNT(*) as total_items, COALESCE(SUM(stock), 0) as total_units, COALESCE(SUM(stock * cost_price), 0) as total_inventory_value FROM spareparts")
    sp_stat = dict_from_row(cursor.fetchone())

    # Stok menipis / kritis
    cursor.execute("SELECT COUNT(*) FROM spareparts WHERE stock <= min_stock AND stock > 0")
    low_stock = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM spareparts WHERE stock = 0")
    out_of_stock = cursor.fetchone()[0]

    # Servis Aktif (antrean, pengecekan, konfirmasi, menunggu_part, pengerjaan)
    cursor.execute("SELECT COUNT(*) FROM service_orders WHERE status IN ('antrean', 'pengecekan', 'konfirmasi', 'menunggu_part', 'pengerjaan')")
    active_services = cursor.fetchone()[0]

    # Servis Selesai Siap Diambil
    cursor.execute("SELECT COUNT(*) FROM service_orders WHERE status = 'selesai'")
    ready_services = cursor.fetchone()[0]

    # Servis Diambil Bulan Ini & Estimasi Pendapatan (Otomatis berganti setiap bulan baru)
    selected_month = request.args.get('month', '').strip()
    if not selected_month:
        selected_month = datetime.now().strftime("%Y-%m")

    months_id = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    try:
        y, m = map(int, selected_month.split('-'))
        month_label = f"{months_id[m]} {y}"
    except Exception:
        month_label = selected_month

    cursor.execute("""
        SELECT 
            COUNT(*) as completed_count,
            COALESCE(SUM(total_cost), 0) as revenue,
            COALESCE(SUM(service_fee), 0) as total_service_fees
        FROM service_orders 
        WHERE status = 'diambil' AND COALESCE(completed_at, created_at) LIKE ?
    """, (f"{selected_month}%",))
    rev_stat = dict_from_row(cursor.fetchone())

    # Ambil daftar bulan yang tersedia dari riwayat servis
    cursor.execute("""
        SELECT DISTINCT strftime('%Y-%m', COALESCE(completed_at, created_at)) as month_val
        FROM service_orders
        WHERE status = 'diambil' AND COALESCE(completed_at, created_at) IS NOT NULL
        ORDER BY month_val DESC
    """)
    month_rows = cursor.fetchall()
    available_months_raw = [r['month_val'] for r in month_rows if r['month_val']]
    if selected_month not in available_months_raw:
        available_months_raw.insert(0, selected_month)

    available_months = []
    for mv in available_months_raw:
        try:
            my, mm = map(int, mv.split('-'))
            available_months.append({'value': mv, 'label': f"{months_id[mm]} {my}"})
        except Exception:
            available_months.append({'value': mv, 'label': mv})

    # Top 6 Item Stok Menipis
    cursor.execute("""
        SELECT s.*, c.name as category_name, b.name as brand_name
        FROM spareparts s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN brands b ON s.brand_id = b.id
        WHERE s.stock <= s.min_stock
        ORDER BY s.stock ASC, s.name ASC
        LIMIT 6
    """)
    critical_items = [dict_from_row(r) for r in cursor.fetchall()]

    # 5 Servis Terbaru
    cursor.execute("""
        SELECT so.*, t.name as technician_name
        FROM service_orders so
        LEFT JOIN technicians t ON so.technician_id = t.id
        ORDER BY so.id DESC
        LIMIT 5
    """)
    recent_services = [dict_from_row(r) for r in cursor.fetchall()]

    # 6 Riwayat Mutasi Terkini
    cursor.execute("""
        SELECT sl.*, sp.name as part_name, sp.sku
        FROM stock_logs sl
        JOIN spareparts sp ON sl.sparepart_id = sp.id
        ORDER BY sl.id DESC
        LIMIT 6
    """)
    recent_logs = [dict_from_row(r) for r in cursor.fetchall()]

    conn.close()

    return jsonify({
        'status': 'success',
        'inventory': sp_stat,
        'low_stock_count': low_stock,
        'out_of_stock_count': out_of_stock,
        'active_services': active_services,
        'ready_services': ready_services,
        'monthly_revenue': rev_stat,
        'selected_month': selected_month,
        'month_label': month_label,
        'available_months': available_months,
        'critical_items': critical_items,
        'recent_services': recent_services,
        'recent_logs': recent_logs
    })

# 2. Sparepart Inventory Endpoints
@app.route('/api/spareparts', methods=['GET', 'POST'])
def handle_spareparts():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        query = """
            SELECT s.*, c.name as category_name, b.name as brand_name
            FROM spareparts s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN brands b ON s.brand_id = b.id
            WHERE 1=1
        """
        params = []

        search = request.args.get('search', '').strip()
        if search:
            query += " AND (s.name LIKE ? OR s.sku LIKE ? OR s.compatible_models LIKE ? OR s.location LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])

        category_id = request.args.get('category_id')
        if category_id:
            query += " AND s.category_id = ?"
            params.append(category_id)

        brand_id = request.args.get('brand_id')
        if brand_id:
            query += " AND s.brand_id = ?"
            params.append(brand_id)

        low_stock_only = request.args.get('low_stock')
        if low_stock_only == 'true':
            query += " AND s.stock <= s.min_stock"

        query += " ORDER BY s.stock ASC, s.name ASC"
        cursor.execute(query, params)
        items = [dict_from_row(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'status': 'success', 'data': items})

    elif request.method == 'POST':
        data = request.json or {}
        sku = data.get('sku', '').strip().upper()
        name = data.get('name', '').strip()
        if not sku or not name:
            conn.close()
            return jsonify({'status': 'error', 'message': 'SKU dan Nama Sparepart wajib diisi'}), 400

        # Cek duplikat SKU
        cursor.execute("SELECT id FROM spareparts WHERE sku = ?", (sku,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'message': f'SKU {sku} sudah terdaftar'}), 400

        category_id = data.get('category_id') or None
        brand_id = data.get('brand_id') or None
        compatible_models = data.get('compatible_models', '')
        stock = int(data.get('stock', 0))
        min_stock = int(data.get('min_stock', 2))
        cost_price = float(data.get('cost_price', 0))
        sell_price = float(data.get('sell_price', 0))
        location = data.get('location', '')
        notes = data.get('notes', '')

        cursor.execute("""
            INSERT INTO spareparts (sku, name, category_id, brand_id, compatible_models, stock, min_stock, cost_price, sell_price, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sku, name, category_id, brand_id, compatible_models, stock, min_stock, cost_price, sell_price, location, notes))
        part_id = cursor.lastrowid

        # Log mutasi awal
        if stock > 0:
            cursor.execute("""
                INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
                VALUES (?, 'in_initial', ?, 0, ?, 'NEW-ITEM', 'Pendaftaran barang baru di gudang')
            """, (part_id, stock, stock))

        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Sparepart berhasil ditambahkan', 'id': part_id}), 201

@app.route('/api/spareparts/<int:part_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_sparepart(part_id):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute("""
            SELECT s.*, c.name as category_name, b.name as brand_name
            FROM spareparts s
            LEFT JOIN categories c ON s.category_id = c.id
            LEFT JOIN brands b ON s.brand_id = b.id
            WHERE s.id = ?
        """, (part_id,))
        part = cursor.fetchone()
        conn.close()
        if not part:
            return jsonify({'status': 'error', 'message': 'Sparepart tidak ditemukan'}), 404
        return jsonify({'status': 'success', 'data': dict_from_row(part)})

    elif request.method == 'PUT':
        data = request.json or {}
        sku = data.get('sku', '').strip().upper()
        name = data.get('name', '').strip()
        if not sku or not name:
            conn.close()
            return jsonify({'status': 'error', 'message': 'SKU dan Nama Sparepart wajib diisi'}), 400

        # Cek SKU duplikat dengan id lain
        cursor.execute("SELECT id FROM spareparts WHERE sku = ? AND id != ?", (sku, part_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'status': 'error', 'message': f'SKU {sku} sudah dipakai produk lain'}), 400

        cursor.execute("""
            UPDATE spareparts SET
                sku = ?,
                name = ?,
                category_id = ?,
                brand_id = ?,
                compatible_models = ?,
                min_stock = ?,
                cost_price = ?,
                sell_price = ?,
                location = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            sku,
            name,
            data.get('category_id') or None,
            data.get('brand_id') or None,
            data.get('compatible_models', ''),
            int(data.get('min_stock', 2)),
            float(data.get('cost_price', 0)),
            float(data.get('sell_price', 0)),
            data.get('location', ''),
            data.get('notes', ''),
            part_id
        ))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Data sparepart berhasil diperbarui'})

    elif request.method == 'DELETE':
        # Cek pemakaian di servis
        cursor.execute("SELECT COUNT(*) FROM service_parts WHERE sparepart_id = ?", (part_id,))
        usage_count = cursor.fetchone()[0]
        if usage_count > 0:
            conn.close()
            return jsonify({'status': 'error', 'message': f'Tidak dapat dihapus karena pernah digunakan pada {usage_count} transaksi servis'}), 400

        cursor.execute("DELETE FROM spareparts WHERE id = ?", (part_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Sparepart berhasil dihapus'})

@app.route('/api/spareparts/<int:part_id>/adjust-stock', methods=['POST'])
def adjust_stock(part_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, stock FROM spareparts WHERE id = ?", (part_id,))
    part = cursor.fetchone()
    if not part:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Sparepart tidak ditemukan'}), 404

    data = request.json or {}
    change_type = data.get('change_type', 'in_purchase') # in_purchase, out_waste, adjustment
    qty = int(data.get('quantity', 0))
    notes = data.get('notes', '').strip()

    if qty <= 0:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Jumlah harus lebih besar dari 0'}), 400

    prev_stock = part['stock']
    if change_type == 'in_purchase':
        curr_stock = prev_stock + qty
    elif change_type == 'out_waste':
        if prev_stock < qty:
            conn.close()
            return jsonify({'status': 'error', 'message': f'Stok tidak cukup (stok saat ini: {prev_stock})'}), 400
        curr_stock = prev_stock - qty
    elif change_type == 'adjustment':
        # Penyesuaian stok opname langsung set ke angka qty
        target_stock = qty
        diff = target_stock - prev_stock
        qty = abs(diff)
        curr_stock = target_stock
    else:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Tipe penyesuaian stok tidak valid'}), 400

    cursor.execute("UPDATE spareparts SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (curr_stock, part_id))
    cursor.execute("""
        INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (part_id, change_type, qty, prev_stock, curr_stock, data.get('reference_id', 'MANUAL-ADJUST'), notes or 'Penyesuaian stok manual'))

    conn.commit()
    conn.close()
    return jsonify({
        'status': 'success',
        'message': f'Stok {part["name"]} berhasil disesuaikan menjadi {curr_stock}',
        'current_stock': curr_stock
    })

# 3. Service Orders API
@app.route('/api/services', methods=['GET', 'POST'])
def handle_services():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        query = """
            SELECT so.*, t.name as technician_name,
                   (SELECT COUNT(*) FROM service_parts sp WHERE sp.service_id = so.id) as parts_count
            FROM service_orders so
            LEFT JOIN technicians t ON so.technician_id = t.id
            WHERE 1=1
        """
        params = []

        status = request.args.get('status')
        if status:
            query += " AND so.status = ?"
            params.append(status)

        tech_id = request.args.get('technician_id')
        if tech_id:
            query += " AND so.technician_id = ?"
            params.append(tech_id)

        search = request.args.get('search', '').strip()
        if search:
            query += " AND (so.ticket_number LIKE ? OR so.customer_name LIKE ? OR so.customer_phone LIKE ? OR so.device_model LIKE ? OR so.imei_sn LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term, term])

        query += " ORDER BY so.id DESC"
        cursor.execute(query, params)
        orders = [dict_from_row(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'status': 'success', 'data': orders})

    elif request.method == 'POST':
        data = request.json or {}
        customer_name = data.get('customer_name', '').strip()
        customer_phone = data.get('customer_phone', '').strip()
        device_brand = data.get('device_brand', '').strip()
        device_model = data.get('device_model', '').strip()
        damage_description = data.get('damage_description', '').strip()

        if not customer_name or not customer_phone or not device_brand or not device_model or not damage_description:
            conn.close()
            return jsonify({'status': 'error', 'message': 'Nama pelanggan, No WA, Merk, Model, dan Keluhan wajib diisi'}), 400

        ticket_number = generate_ticket_number(conn)
        service_fee = float(data.get('service_fee', 0))
        discount = float(data.get('discount', 0))
        down_payment = float(data.get('down_payment', 0))
        total_cost = max(0, service_fee - discount)

        payment_status = 'belum_lunas'
        if down_payment > 0:
            payment_status = 'lunas' if down_payment >= total_cost and total_cost > 0 else 'dp'

        cursor.execute("""
            INSERT INTO service_orders (
                ticket_number, customer_name, customer_phone, customer_address,
                device_brand, device_model, device_color, imei_sn, screen_lock,
                physical_condition, damage_description, technician_id, status,
                service_fee, discount, total_cost, down_payment, payment_status,
                warranty_days, technician_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ticket_number,
            customer_name,
            customer_phone,
            data.get('customer_address', ''),
            device_brand,
            device_model,
            data.get('device_color', ''),
            data.get('imei_sn', ''),
            data.get('screen_lock', ''),
            data.get('physical_condition', ''),
            damage_description,
            data.get('technician_id') or None,
            data.get('status', 'antrean'),
            service_fee,
            discount,
            total_cost,
            down_payment,
            payment_status,
            int(data.get('warranty_days', 30)),
            data.get('technician_notes', '')
        ))
        service_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'status': 'success',
            'message': 'Tiket servis berhasil dibuat',
            'id': service_id,
            'ticket_number': ticket_number
        }), 201

@app.route('/api/services/<int:service_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_service(service_id):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute("""
            SELECT so.*, t.name as technician_name, t.phone as technician_phone
            FROM service_orders so
            LEFT JOIN technicians t ON so.technician_id = t.id
            WHERE so.id = ?
        """, (service_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return jsonify({'status': 'error', 'message': 'Tiket servis tidak ditemukan'}), 404

        # Ambil daftar sparepart yang terpasang
        cursor.execute("""
            SELECT sp.*, s.name as part_name, s.sku, s.location, s.stock as current_warehouse_stock
            FROM service_parts sp
            JOIN spareparts s ON sp.sparepart_id = s.id
            WHERE sp.service_id = ?
        """, (service_id,))
        parts = [dict_from_row(r) for r in cursor.fetchall()]

        # Ambil info setting toko
        cursor.execute("SELECT * FROM store_settings LIMIT 1")
        settings = dict_from_row(cursor.fetchone())

        conn.close()
        res_data = dict_from_row(order)
        res_data['parts'] = parts
        res_data['store'] = settings
        return jsonify({'status': 'success', 'data': res_data})

    elif request.method == 'PUT':
        data = request.json or {}
        service_fee = float(data.get('service_fee', 0))
        discount = float(data.get('discount', 0))
        down_payment = float(data.get('down_payment', 0))
        status = data.get('status', 'antrean')

        completed_at = None
        if status in ('selesai', 'diambil'):
            cursor.execute("SELECT completed_at FROM service_orders WHERE id = ?", (service_id,))
            current_completed = cursor.fetchone()['completed_at']
            completed_at = current_completed or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            UPDATE service_orders SET
                customer_name = ?,
                customer_phone = ?,
                customer_address = ?,
                device_brand = ?,
                device_model = ?,
                device_color = ?,
                imei_sn = ?,
                screen_lock = ?,
                physical_condition = ?,
                damage_description = ?,
                technician_id = ?,
                status = ?,
                service_fee = ?,
                discount = ?,
                down_payment = ?,
                payment_status = ?,
                warranty_days = ?,
                technician_notes = ?,
                completed_at = COALESCE(?, completed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            data.get('customer_name', '').strip(),
            data.get('customer_phone', '').strip(),
            data.get('customer_address', ''),
            data.get('device_brand', ''),
            data.get('device_model', ''),
            data.get('device_color', ''),
            data.get('imei_sn', ''),
            data.get('screen_lock', ''),
            data.get('physical_condition', ''),
            data.get('damage_description', ''),
            data.get('technician_id') or None,
            status,
            service_fee,
            discount,
            down_payment,
            data.get('payment_status', 'belum_lunas'),
            int(data.get('warranty_days', 30)),
            data.get('technician_notes', ''),
            completed_at,
            service_id
        ))

        recalculate_service_total(conn, service_id)
        conn.close()
        return jsonify({'status': 'success', 'message': 'Tiket servis berhasil diperbarui'})

    elif request.method == 'DELETE':
        # Kembalikan semua stok sparepart yang terpasang jika tiket dihapus
        cursor.execute("SELECT * FROM service_parts WHERE service_id = ?", (service_id,))
        parts = cursor.fetchall()
        for p in parts:
            cursor.execute("UPDATE spareparts SET stock = stock + ? WHERE id = ?", (p['quantity'], p['sparepart_id']))
            cursor.execute("""
                INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
                VALUES (?, 'in_service_cancel', ?, 0, 0, ?, 'Pengembalian stok dari tiket servis yang dihapus')
            """, (p['sparepart_id'], p['quantity'], f"SVC-{service_id}"))

        cursor.execute("DELETE FROM service_orders WHERE id = ?", (service_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'message': 'Tiket servis berhasil dihapus dan sparepart dikembalikan ke gudang'})

# Update status cepat untuk servis
@app.route('/api/services/<int:service_id>/status', methods=['PATCH'])
def update_service_status(service_id):
    data = request.json or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'status': 'error', 'message': 'Status baru harus disertakan'}), 400

    conn = get_db()
    cursor = conn.cursor()

    completed_at = None
    if new_status in ('selesai', 'diambil'):
        cursor.execute("SELECT completed_at FROM service_orders WHERE id = ?", (service_id,))
        curr = cursor.fetchone()
        completed_at = (curr['completed_at'] if curr and curr['completed_at'] else datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    payment_status_update = ""
    params = [new_status]
    if completed_at:
        params.append(completed_at)
    if new_status == 'diambil':
        # Jika sudah diambil, biasanya lunas
        payment_status_update = ", payment_status = 'lunas'"

    query = f"UPDATE service_orders SET status = ? {', completed_at = ?' if completed_at else ''} {payment_status_update}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    params.append(service_id)

    cursor.execute(query, params)
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'message': f'Status berhasil diubah menjadi {new_status}'})

# 4. Tambah & Hapus Sparepart di Servis (Otomatis potong / kembalikan stok gudang)
@app.route('/api/services/<int:service_id>/parts', methods=['POST'])
def add_part_to_service(service_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, ticket_number FROM service_orders WHERE id = ?", (service_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Tiket servis tidak ditemukan'}), 404

    data = request.json or {}
    part_id = data.get('sparepart_id')
    qty = int(data.get('quantity', 1))

    if not part_id or qty <= 0:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Sparepart dan kuantitas valid harus dipilih'}), 400

    # Ambil info sparepart & cek stok
    cursor.execute("SELECT id, name, stock, cost_price, sell_price FROM spareparts WHERE id = ?", (part_id,))
    part = cursor.fetchone()
    if not part:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Sparepart gudang tidak ditemukan'}), 404

    if part['stock'] < qty:
        conn.close()
        return jsonify({'status': 'error', 'message': f"Stok tidak cukup! Tersisa {part['stock']} unit di gudang."}), 400

    unit_cost = float(part['cost_price'])
    # Boleh override harga jual jika toko memberi harga khusus
    unit_sell = float(data.get('unit_sell_price', part['sell_price']))
    subtotal = qty * unit_sell

    # 1. Simpan ke service_parts
    cursor.execute("""
        INSERT INTO service_parts (service_id, sparepart_id, quantity, unit_cost_price, unit_sell_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (service_id, part_id, qty, unit_cost, unit_sell, subtotal))

    # 2. Potong stok sparepart di gudang
    new_stock = part['stock'] - qty
    cursor.execute("UPDATE spareparts SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_stock, part_id))

    # 3. Catat di log mutasi stok
    cursor.execute("""
        INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
        VALUES (?, 'out_service', ?, ?, ?, ?, ?)
    """, (part_id, qty, part['stock'], new_stock, order['ticket_number'], f"Terpasang pada servis {order['ticket_number']}"))

    conn.commit()

    # 4. Hitung ulang total biaya servis
    recalculate_service_total(conn, service_id)
    conn.close()

    return jsonify({'status': 'success', 'message': f"{qty}x {part['name']} berhasil ditambahkan ke servis & stok gudang otomatis terpotong."})

@app.route('/api/services/<int:service_id>/parts/<int:item_id>', methods=['DELETE'])
def remove_part_from_service(service_id, item_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, ticket_number FROM service_orders WHERE id = ?", (service_id,))
    order = cursor.fetchone()
    if not order:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Tiket servis tidak ditemukan'}), 404

    cursor.execute("SELECT * FROM service_parts WHERE id = ? AND service_id = ?", (item_id, service_id))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Item sparepart servis tidak ditemukan'}), 404

    part_id = item['sparepart_id']
    qty = item['quantity']

    # 1. Kembalikan stok ke gudang
    cursor.execute("SELECT stock FROM spareparts WHERE id = ?", (part_id,))
    sp = cursor.fetchone()
    if sp:
        new_stock = sp['stock'] + qty
        cursor.execute("UPDATE spareparts SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_stock, part_id))
        cursor.execute("""
            INSERT INTO stock_logs (sparepart_id, change_type, quantity, previous_stock, current_stock, reference_id, notes)
            VALUES (?, 'in_service_cancel', ?, ?, ?, ?, ?)
        """, (part_id, qty, sp['stock'], new_stock, order['ticket_number'], f"Dibatalkan dari servis {order['ticket_number']}"))

    # 2. Hapus baris service_parts
    cursor.execute("DELETE FROM service_parts WHERE id = ?", (item_id,))
    conn.commit()

    # 3. Hitung ulang total
    recalculate_service_total(conn, service_id)
    conn.close()

    return jsonify({'status': 'success', 'message': 'Item sparepart berhasil dihapus dan stok dikembalikan ke gudang'})

# 5. Stock Logs Endpoint
@app.route('/api/stock-logs', methods=['GET'])
def get_stock_logs():
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT sl.*, sp.name as part_name, sp.sku, sp.location
        FROM stock_logs sl
        JOIN spareparts sp ON sl.sparepart_id = sp.id
        WHERE 1=1
    """
    params = []

    part_id = request.args.get('sparepart_id')
    if part_id:
        query += " AND sl.sparepart_id = ?"
        params.append(part_id)

    change_type = request.args.get('change_type')
    if change_type:
        query += " AND sl.change_type = ?"
        params.append(change_type)

    query += " ORDER BY sl.id DESC LIMIT 100"
    cursor.execute(query, params)
    logs = [dict_from_row(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'status': 'success', 'data': logs})

# 6. Master Data Endpoint
@app.route('/api/master', methods=['GET'])
def get_master_data():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM categories ORDER BY name ASC")
    cats = [dict_from_row(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM brands ORDER BY name ASC")
    brands = [dict_from_row(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM technicians ORDER BY status ASC, name ASC")
    techs = [dict_from_row(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM store_settings LIMIT 1")
    settings = dict_from_row(cursor.fetchone())

    conn.close()
    return jsonify({
        'status': 'success',
        'categories': cats,
        'brands': brands,
        'technicians': techs,
        'settings': settings
    })

@app.route('/api/master/categories', methods=['POST'])
def add_category():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'status': 'error', 'message': 'Nama kategori wajib diisi'}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO categories (name, description) VALUES (?, ?)", (name, data.get('description', '')))
        conn.commit()
        cat_id = cursor.lastrowid
        conn.close()
        return jsonify({'status': 'success', 'message': 'Kategori berhasil ditambahkan', 'id': cat_id})
    except Exception as e:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Gagal menambah kategori: {str(e)}'}), 400

@app.route('/api/master/brands', methods=['POST'])
def add_brand():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'status': 'error', 'message': 'Nama brand wajib diisi'}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO brands (name) VALUES (?)", (name,))
        conn.commit()
        brand_id = cursor.lastrowid
        conn.close()
        return jsonify({'status': 'success', 'message': 'Merk HP berhasil ditambahkan', 'id': brand_id})
    except Exception as e:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Gagal menambah merk: {str(e)}'}), 400

@app.route('/api/master/technicians', methods=['POST'])
def add_technician():
    data = request.json or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'status': 'error', 'message': 'Nama teknisi wajib diisi'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO technicians (name, phone, specialty, status)
        VALUES (?, ?, ?, ?)
    """, (name, data.get('phone', ''), data.get('specialty', ''), data.get('status', 'active')))
    conn.commit()
    t_id = cursor.lastrowid
    conn.close()
    return jsonify({'status': 'success', 'message': 'Teknisi berhasil ditambahkan', 'id': t_id})

@app.route('/api/master/settings', methods=['PUT'])
def update_settings():
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE store_settings SET
            name = ?,
            tagline = ?,
            address = ?,
            phone = ?,
            whatsapp = ?,
            warranty_note = ?
        WHERE id = 1
    """, (
        data.get('name', 'Satria Celular'),
        data.get('tagline', ''),
        data.get('address', ''),
        data.get('phone', ''),
        data.get('whatsapp', ''),
        data.get('warranty_note', '')
    ))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'message': 'Pengaturan toko berhasil disimpan'})

# 7. Backup & Export JSON
@app.route('/api/export', methods=['GET'])
def export_database():
    conn = get_db()
    cursor = conn.cursor()

    tables = ['store_settings', 'categories', 'brands', 'technicians', 'spareparts', 'service_orders', 'service_parts', 'stock_logs']
    backup = {}
    for t in tables:
        cursor.execute(f"SELECT * FROM {t}")
        backup[t] = [dict_from_row(r) for r in cursor.fetchall()]

    conn.close()
    return jsonify({
        'status': 'success',
        'export_time': datetime.now().isoformat(),
        'app': 'Satria Celular Warehouse System',
        'data': backup
    })

if __name__ == '__main__':
    # Default port 5000
    port = int(os.environ.get('PORT', 5000))
    print(f"Server Satria Celular berjalan di http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
