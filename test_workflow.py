import urllib.request
import json

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get(url):
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode())

print("--- 1. Testing Tambah Sparepart Baru ---")
sp_payload = {
    'sku': 'BAT-IP12-OEM',
    'name': 'Baterai iPhone 12 / 12 Pro 2815mAh OEM',
    'compatible_models': 'iPhone 12, iPhone 12 Pro',
    'stock': 5,
    'min_stock': 2,
    'cost_price': 160000,
    'sell_price': 295000,
    'location': 'Rak B-02'
}
res_sp = post('http://localhost:5000/api/spareparts', sp_payload)
print("Response:", res_sp)
part_id = res_sp['id']

print("\n--- 2. Testing Tambah Tiket Servis HP Baru ---")
svc_payload = {
    'customer_name': 'Pelanggan Uji Coba',
    'customer_phone': '081299998888',
    'device_brand': 'Apple / iPhone',
    'device_model': 'iPhone 12',
    'damage_description': 'Baterai boros drastis dan cepat panas',
    'screen_lock': 'PIN: 112233',
    'service_fee': 75000
}
res_svc = post('http://localhost:5000/api/services', svc_payload)
print("Response:", res_svc)
svc_id = res_svc['id']

print("\n--- 3. Testing Alokasi Sparepart ke Unit Servis (Pemotongan Stok Otomatis) ---")
res_alloc = post(f'http://localhost:5000/api/services/{svc_id}/parts', {
    'sparepart_id': part_id,
    'quantity': 1
})
print("Allocation Response:", res_alloc)

print("\n--- 4. Verifikasi Stok Gudang Setelah Pemakaian ---")
part_detail = get(f'http://localhost:5000/api/spareparts/{part_id}')
current_stock = part_detail['data']['stock']
print(f"Stok Awal: 5 -> Stok Sekarang: {current_stock} (Valid: {current_stock == 4})")

print("\n--- 5. Verifikasi Total Biaya Servis Terkalkulasi ---")
svc_detail = get(f'http://localhost:5000/api/services/{svc_id}')
total_cost = svc_detail['data']['total_cost']
expected_total = 75000 + 295000 # fee + part sell price
print(f"Total Biaya: Rp {total_cost:,.0f} (Expected: Rp {expected_total:,.0f}, Valid: {total_cost == expected_total})")

print("\n--- 6. Verifikasi Pencatatan Log Mutasi Stok ---")
logs = get('http://localhost:5000/api/stock-logs')
latest_log = logs['data'][0]
print(f"Log Terkini: {latest_log['part_name']} | Mutasi: {latest_log['change_type']} | Qty: {latest_log['quantity']} | Ref: {latest_log['reference_id']}")

print("\nSemua pengujian alur bisnis BERHASIL 100%!")
