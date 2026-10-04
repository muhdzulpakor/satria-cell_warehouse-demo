# Satria Celular - Sistem Warehouse & Manajemen Servis HP

Sistem informasi terintegrasi untuk toko dan bengkel servis handphone **Satria Celular**. Menggabungkan pengelolaan stok sparepart gudang dengan pelacakan antrean unit servis pelanggan, pemotongan stok otomatis, cetak nota tanda terima/faktur, dan integrasi notifikasi WhatsApp.

---

## 🚀 Fitur Utama

1. **Dashboard Operasional Real-Time**
   - Ringkasan total sparepart & valuasi aset gudang.
   - Peringatan stok kritis (sparepart menipis / habis).
   - Jumlah servis aktif & servis selesai siap diambil.
   - Rekap omzet bulanan dan jumlah unit terselesaikan.

2. **Gudang & Manajemen Stok Sparepart (Warehouse)**
   - Pencarian real-time berdasarkan SKU, Nama Part, Merk, Tipe HP yang cocok, dan Lokasi Rak.
   - Filter berdasarkan Kategori (LCD, Baterai, Fleksibel, IC, Kamera, dll.) dan Merk HP.
   - Peringatan batas minimum stok (Low Stock Alert).
   - Fitur **Quick Restock** untuk penambahan barang masuk secara cepat dari distributor.
   - Lokasi penyimpanan rak/box untuk kemudahan teknisi mencari barang.

3. **Pelacakan Antrean Unit Servis HP (Service Orders)**
   - Formulir penerimaan cepat di meja kasir/counter:
     - Data pelanggan (Nama, WhatsApp, Alamat).
     - Data unit (Merk, Model, Warna, IMEI/Serial Number).
     - **Kunci Layar (Pola / PIN / Sandi)** untuk pengujian teknisi setelah perbaikan.
     - Kelengkapan fisik saat masuk (mencegah komplain).
     - Keluhan kerusakan.
   - Alur status servis berjenjang:
     - *Antrean Masuk* &rarr; *Diagnosis/Cek* &rarr; *Tunggu Konfirmasi Biaya* &rarr; *Tunggu Sparepart* &rarr; *Sedang Dikerjakan* &rarr; *Selesai (Siap Diambil)* &rarr; *Sudah Diambil (Lunas)*.

4. **Integrasi Pemotongan Stok Otomatis (Auto-Deduct)**
   - Teknisi dapat memilih sparepart langsung dari gudang untuk dipasangkan ke tiket servis.
   - Stok gudang **langsung terpotong otomatis** dan tercatat di riwayat mutasi.
   - Jika sparepart dibatalkan/dicopot, stok akan **otomatis dikembalikan** ke gudang.
   - Perhitungan otomatis total biaya: `Jasa Teknisi + Total Sparepart - Diskon`.

5. **Cetak Nota & Dokumen Servis**
   - **Struk Kasir Thermal (80mm)**: Cocok untuk printer kasir mini/POS.
   - **Nota Faktur Standar (A4 / A5)**: Dilengkapi kop toko Satria Celular, rincian biaya, ketentuan garansi, dan tanda tangan pelanggan.
   - **Label Stiker Casing HP**: Stiker ukuran kecil untuk ditempel di casing belakang unit agar tidak tertukar.

6. **Notifikasi WhatsApp Instan**
   - Tombol 1-klik untuk mengirim pesan ke nomor WhatsApp pelanggan:
     - Notifikasi tanda terima masuk.
     - Konfirmasi rincian biaya perbaikan.
     - Notifikasi unit selesai dan siap diambil di toko.

7. **Log Mutasi Stok (Audit Trail)**
   - Riwayat lengkap barang masuk, pemakaian ke unit servis, stok opname, dan retur.

8. **Pengaturan & Master Data**
   - Profil toko (Nama, Alamat, No WhatsApp, Ketentuan Garansi).
   - Manajemen Merk HP, Kategori Sparepart, dan Tim Teknisi.
   - Backup database dalam format JSON.

---

## 🛠️ Cara Menjalankan Aplikasi

### Cara 1: Menggunakan Launcher `run.bat` (Termudah di Windows)
Cukup klik dua kali (double click) pada file **`run.bat`**. Browser akan otomatis terbuka ke `http://localhost:5000`.

## 📂 Struktur File

```
satria-celular-warehouse/
├── app.py                # Server backend Flask & REST API
├── database.py           # Inisialisasi SQLite database & data awal (seed data)
├── warehouse.db          # Database SQLite lokal
├── requirements.txt      # Dependensi Python (Flask)
├── run.bat               # Windows batch launcher otomatis
├── templates/
│   └── index.html        # Antarmuka web modern responsif (Tailwind CSS)
├── static/
│   ├── css/
│   │   └── custom.css    # Gaya CSS khusus & template cetak nota
│   └── js/
│       └── app.js        # Engine logika aplikasi frontend
└── README.md             # Dokumentasi sistem
```
