// Satria Celular - Sistem Warehouse & Servis HP
// Frontend Engine

const App = {
    state: {
        activeTab: 'dashboard',
        dashboard: null,
        spareparts: [],
        services: [],
        stockLogs: [],
        master: {
            categories: [],
            brands: [],
            technicians: [],
            settings: {}
        },
        selectedService: null,
        activeFilters: {
            spSearch: '',
            spCategory: '',
            spBrand: '',
            spLowStock: false,
            svcSearch: '',
            svcStatus: '',
            svcTech: ''
        }
    },

    // Formatters
    formatRupiah(num) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(num || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr.replace(' ', 'T'));
            return d.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    },

    getStatusBadge(status) {
        const badges = {
            'antrean': { label: 'Antrean Masuk', class: 'bg-amber-100 text-amber-800 border-amber-300' },
            'pengecekan': { label: 'Diagnosis / Cek', class: 'bg-blue-100 text-blue-800 border-blue-300' },
            'konfirmasi': { label: 'Tunggu Konfirmasi', class: 'bg-purple-100 text-purple-800 border-purple-300' },
            'menunggu_part': { label: 'Tunggu Sparepart', class: 'bg-orange-100 text-orange-800 border-orange-300' },
            'pengerjaan': { label: 'Sedang Dikerjakan', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
            'selesai': { label: 'Selesai (Siap Ambil)', class: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold' },
            'diambil': { label: 'Sudah Diambil (Lunas)', class: 'bg-gray-100 text-gray-800 border-gray-300' },
            'dibatalkan': { label: 'Dibatalkan', class: 'bg-rose-100 text-rose-800 border-rose-300' }
        };
        const item = badges[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.class}">${item.label}</span>`;
    },

    getPaymentBadge(status) {
        const badges = {
            'lunas': { label: 'Lunas', class: 'bg-emerald-100 text-emerald-800' },
            'dp': { label: 'Ada DP', class: 'bg-amber-100 text-amber-800' },
            'belum_lunas': { label: 'Belum Bayar', class: 'bg-rose-100 text-rose-800' }
        };
        const item = badges[status] || { label: status, class: 'bg-gray-100 text-gray-800' };
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${item.class}">${item.label}</span>`;
    },

    // Notifikasi Toast
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const bgColors = {
            'success': 'bg-emerald-600',
            'error': 'bg-rose-600',
            'info': 'bg-blue-600'
        };
        const color = bgColors[type] || 'bg-slate-800';

        toast.className = `${color} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 z-50 text-sm font-medium`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-auto text-white/80 hover:text-white">&times;</button>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Inisialisasi Aplikasi
    async init() {
        this.setupNavigation();
        await this.loadMasterData();
        await this.loadDashboard();
        this.setupForms();
    },

    // Setup Navigasi Tab
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-tab');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    },

    switchTab(tabName) {
        this.state.activeTab = tabName;

        // Update Nav Active state
        document.querySelectorAll('.nav-tab').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Sembunyikan semua section
        document.querySelectorAll('.tab-content').forEach(sec => {
            sec.classList.add('hidden');
        });

        // Tampilkan section yang dipilih
        const activeSection = document.getElementById(`tab-${tabName}`);
        if (activeSection) {
            activeSection.classList.remove('hidden');
        }

        // Muat data spesifik tab
        if (tabName === 'dashboard') this.loadDashboard();
        if (tabName === 'inventory') this.loadSpareparts();
        if (tabName === 'services') this.loadServices();
        if (tabName === 'stock-logs') this.loadStockLogs();
        if (tabName === 'settings') this.renderSettings();
        if (tabName === 'new-service') this.prepareNewServiceForm();
    },

    // 1. Data Loader
    async loadMasterData() {
        try {
            const res = await fetch('/api/master');
            const data = await res.json();
            if (data.status === 'success') {
                this.state.master = data;
                this.populateDropdowns();
            }
        } catch (e) {
            console.error('Error load master data:', e);
        }
    },

    populateDropdowns() {
        // Dropdown Kategori di Gudang & Modal
        const catSelects = document.querySelectorAll('.category-dropdown');
        catSelects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Semua Kategori</option>';
            this.state.master.categories.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
            select.value = currentVal;
        });

        // Dropdown Merk HP
        const brandSelects = document.querySelectorAll('.brand-dropdown');
        brandSelects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Semua Merk</option>';
            this.state.master.brands.forEach(b => {
                select.innerHTML += `<option value="${b.name}">${b.name}</option>`;
            });
            select.value = currentVal;
        });

        // Dropdown Teknisi
        const techSelects = document.querySelectorAll('.tech-dropdown');
        techSelects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">Pilih Teknisi</option>';
            this.state.master.technicians.forEach(t => {
                select.innerHTML += `<option value="${t.id}">${t.name} (${t.specialty || 'Teknisi'})</option>`;
            });
            select.value = currentVal;
        });

        // Header info toko
        const storeNameEl = document.getElementById('store-name-display');
        if (storeNameEl && this.state.master.settings.name) {
            storeNameEl.textContent = this.state.master.settings.name;
        }
    },

    async loadDashboard(month = null) {
        try {
            const url = month ? `/api/dashboard?month=${encodeURIComponent(month)}` : '/api/dashboard';
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            if (data.status === 'success') {
                this.state.dashboard = data;
                this.renderDashboard();
            } else {
                throw new Error(data.message || 'Gagal mengambil data dari server');
            }
        } catch (e) {
            console.error('Error loading dashboard:', e);
            this.showToast('Gagal memuat data dashboard: ' + (e.message || ''), 'error');
        }
    },

    renderDashboard() {
        const d = this.state.dashboard;
        if (!d) return;

        const safeSet = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // Metrik Utama
        safeSet('dash-total-parts', d.inventory?.total_items || 0);
        safeSet('dash-total-units', (d.inventory?.total_units || 0) + ' pcs');
        safeSet('dash-inventory-val', this.formatRupiah(d.inventory?.total_inventory_value));

        safeSet('dash-low-stock', d.low_stock_count || 0);
        safeSet('dash-out-stock', d.out_of_stock_count || 0);

        safeSet('dash-active-services', d.active_services || 0);
        safeSet('dash-ready-services', d.ready_services || 0);

        // Judul & Selector Bulan Omzet
        safeSet('dash-revenue-title', `Omzet (${d.month_label || 'Bulan Ini'})`);
        safeSet('dash-revenue', this.formatRupiah(d.monthly_revenue?.revenue));
        safeSet('dash-service-fees', this.formatRupiah(d.monthly_revenue?.total_service_fees));
        safeSet('dash-completed-count', (d.monthly_revenue?.completed_count || 0) + ' Unit Diambil');

        // Render Opsi Bulan pada Dropdown
        const monthSelect = document.getElementById('dash-month-select');
        if (monthSelect && d.available_months && d.available_months.length > 0) {
            const currentSelected = d.selected_month;
            monthSelect.innerHTML = d.available_months.map(m => `
                <option value="${m.value}" ${m.value === currentSelected ? 'selected' : ''}>
                    ${m.label}
                </option>
            `).join('');
        }

        // Render List Stok Kritis
        const critTbody = document.getElementById('dash-critical-items');
        if (critTbody) {
            if (!d.critical_items || d.critical_items.length === 0) {
                critTbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500 text-sm">Semua stok sparepart aman terkendali!</td></tr>`;
            } else {
                critTbody.innerHTML = d.critical_items.map(item => `
                    <tr class="hover:bg-slate-50 transition border-b">
                        <td class="py-2.5 px-3">
                            <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">${item.sku}</span>
                        </td>
                        <td class="py-2.5 px-3">
                            <div class="font-semibold text-slate-800 text-sm">${item.name}</div>
                            <div class="text-xs text-slate-500">${item.brand_name || '-'} | ${item.compatible_models || '-'}</div>
                        </td>
                        <td class="py-2.5 px-3">
                            <span class="text-xs px-2 py-0.5 rounded-full ${item.stock === 0 ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-amber-100 text-amber-700 font-medium'}">
                                ${item.stock} / min ${item.min_stock}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 text-xs text-slate-600 font-medium">${item.location || 'Gudang'}</td>
                        <td class="py-2.5 px-3 text-right">
                            <button onclick="App.openQuickRestock(${item.id}, '${item.sku}', '${encodeURIComponent(item.name)}', ${item.stock})" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition font-medium">
                                + Restok
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // Render 5 Servis Terbaru
        const svcTbody = document.getElementById('dash-recent-services');
        if (svcTbody) {
            if (!d.recent_services || d.recent_services.length === 0) {
                svcTbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-gray-500 text-sm">Belum ada antrean servis</td></tr>`;
            } else {
                svcTbody.innerHTML = d.recent_services.map(s => `
                    <tr class="hover:bg-slate-50 transition border-b cursor-pointer" onclick="App.viewServiceDetail(${s.id})">
                        <td class="py-2.5 px-3">
                            <span class="font-mono text-xs font-bold text-blue-600 hover:underline">${s.ticket_number}</span>
                            <div class="text-xs text-slate-400">${this.formatDate(s.created_at)}</div>
                        </td>
                        <td class="py-2.5 px-3">
                            <div class="font-semibold text-slate-800 text-sm">${s.customer_name}</div>
                            <div class="text-xs text-slate-500">${s.customer_phone}</div>
                        </td>
                        <td class="py-2.5 px-3">
                            <div class="font-medium text-slate-800 text-xs">${s.device_brand} ${s.device_model}</div>
                            <div class="text-xs text-rose-500 truncate max-w-xs">${s.damage_description}</div>
                        </td>
                        <td class="py-2.5 px-3">
                            ${this.getStatusBadge(s.status)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-semibold text-xs text-slate-700">
                            ${this.formatRupiah(s.total_cost)}
                        </td>
                    </tr>
                `).join('');
            }
        }
    },

    // 2. Spareparts Inventory Management
    async loadSpareparts() {
        const { spSearch, spCategory, spBrand, spLowStock } = this.state.activeFilters;
        let url = `/api/spareparts?search=${encodeURIComponent(spSearch)}&low_stock=${spLowStock}`;
        if (spCategory) url += `&category_id=${spCategory}`;
        if (spBrand) url += `&brand_id=${spBrand}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') {
                this.state.spareparts = data.data;
                this.renderSparepartsTable();
            }
        } catch (e) {
            this.showToast('Gagal memuat data gudang sparepart', 'error');
        }
    },

    renderSparepartsTable() {
        const tbody = document.getElementById('spareparts-tbody');
        const countEl = document.getElementById('sparepart-count-badge');
        if (!tbody) return;

        if (countEl) countEl.textContent = `${this.state.spareparts.length} item`;

        if (this.state.spareparts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-12 text-slate-400">
                        <div class="text-3xl mb-2">📦</div>
                        <p class="font-medium">Tidak ada sparepart yang sesuai pencarian / filter.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.state.spareparts.map(sp => {
            const isLow = sp.stock <= sp.min_stock;
            const isOut = sp.stock === 0;

            let stockBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">${sp.stock} unit</span>`;
            if (isOut) {
                stockBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">HABIS (0)</span>`;
            } else if (isLow) {
                stockBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Menipis (${sp.stock})</span>`;
            }

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="py-3 px-4">
                        <span class="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-700">${sp.sku}</span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-semibold text-slate-800 text-sm">${sp.name}</div>
                        <div class="text-xs text-slate-500">${sp.brand_name || 'Universal'} - ${sp.compatible_models || 'Semua Tipe'}</div>
                    </td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-600">
                        ${sp.category_name || '-'}
                    </td>
                    <td class="py-3 px-4">
                        ${stockBadge}
                        <div class="text-xs text-slate-400 mt-0.5">Min: ${sp.min_stock}</div>
                    </td>
                    <td class="py-3 px-4 text-xs">
                        <div class="text-slate-500">Beli: ${this.formatRupiah(sp.cost_price)}</div>
                        <div class="font-semibold text-slate-800">Jual: ${this.formatRupiah(sp.sell_price)}</div>
                    </td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-600">
                        <span class="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                            📍 ${sp.location || 'Gudang'}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right space-x-1">
                        <button onclick="App.openQuickRestock(${sp.id}, '${sp.sku}', '${encodeURIComponent(sp.name)}', ${sp.stock})" title="Tambah Stok Masuk" class="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-xs font-medium transition">
                            + Stok
                        </button>
                        <button onclick="App.openEditSparepart(${sp.id})" title="Edit Data" class="px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-xs font-medium transition">
                            ✏️
                        </button>
                        <button onclick="App.deleteSparepart(${sp.id}, '${encodeURIComponent(sp.name)}')" title="Hapus" class="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded text-xs font-medium transition">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 3. Service Orders Management
    async loadServices() {
        const { svcSearch, svcStatus, svcTech } = this.state.activeFilters;
        let url = `/api/services?search=${encodeURIComponent(svcSearch)}`;
        if (svcStatus) url += `&status=${svcStatus}`;
        if (svcTech) url += `&technician_id=${svcTech}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'success') {
                this.state.services = data.data;
                this.renderServicesTable();
            }
        } catch (e) {
            this.showToast('Gagal memuat antrean servis', 'error');
        }
    },

    renderServicesTable() {
        const tbody = document.getElementById('services-tbody');
        const countEl = document.getElementById('services-count-badge');
        if (!tbody) return;

        if (countEl) countEl.textContent = `${this.state.services.length} tiket`;

        if (this.state.services.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-12 text-slate-400">
                        <div class="text-3xl mb-2">🔧</div>
                        <p class="font-medium">Tidak ada data servis yang sesuai filter.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.state.services.map(s => {
            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition cursor-pointer" onclick="App.viewServiceDetail(${s.id})">
                    <td class="py-3 px-4">
                        <span class="font-mono text-xs font-bold text-blue-600 hover:underline block">${s.ticket_number}</span>
                        <span class="text-xs text-slate-400">${this.formatDate(s.created_at)}</span>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-semibold text-slate-800 text-sm">${s.customer_name}</div>
                        <div class="text-xs text-slate-500 flex items-center gap-1">
                            <span>📞 ${s.customer_phone}</span>
                            <button onclick="event.stopPropagation(); App.openWhatsAppPrompt('${s.customer_phone}', '${s.customer_name}', '${s.ticket_number}', '${s.device_brand} ${s.device_model}', '${s.status}', ${s.total_cost})" class="text-emerald-600 hover:text-emerald-700 text-xs ml-1" title="Kirim WhatsApp">
                                💬
                            </button>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-medium text-slate-900 text-sm">${s.device_brand} ${s.device_model}</div>
                        <div class="text-xs text-slate-500">IMEI: ${s.imei_sn || '-'} | Kunci: <span class="font-mono text-amber-700">${s.screen_lock || 'Tidak Ada'}</span></div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="text-xs font-medium text-rose-600 line-clamp-2 max-w-xs">${s.damage_description}</div>
                    </td>
                    <td class="py-3 px-4">
                        ${this.getStatusBadge(s.status)}
                        <div class="text-xs text-slate-500 mt-1">Teknisi: <span class="font-medium text-slate-700">${s.technician_name || 'Belum Ditentukan'}</span></div>
                    </td>
                    <td class="py-3 px-4 text-xs">
                        <div class="font-bold text-slate-900">${this.formatRupiah(s.total_cost)}</div>
                        <div class="mt-0.5">${this.getPaymentBadge(s.payment_status)}</div>
                    </td>
                    <td class="py-3 px-4 text-right space-x-1" onclick="event.stopPropagation()">
                        <button onclick="App.viewServiceDetail(${s.id})" title="Kelola Servis & Part" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition shadow-sm">
                            Buka Tiket
                        </button>
                        <button onclick="App.openPrintModal(${s.id})" title="Cetak Nota / Struk" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition">
                            🖨️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 4. Detail Servis & Manajemen Sparepart yang Terpasang
    async viewServiceDetail(serviceId) {
        try {
            const res = await fetch(`/api/services/${serviceId}`);
            const data = await res.json();
            if (data.status === 'success') {
                this.state.selectedService = data.data;
                this.renderServiceDetailModal();
                this.openModal('modal-service-detail');
            } else {
                this.showToast(data.message || 'Gagal memuat detail servis', 'error');
            }
        } catch (e) {
            this.showToast('Gagal terhubung ke server', 'error');
        }
    },

    renderServiceDetailModal() {
        const s = this.state.selectedService;
        if (!s) return;

        document.getElementById('dtl-ticket').textContent = s.ticket_number;
        document.getElementById('dtl-customer').textContent = `${s.customer_name} (${s.customer_phone})`;
        document.getElementById('dtl-customer-address').textContent = s.customer_address || '-';
        document.getElementById('dtl-device').textContent = `${s.device_brand} ${s.device_model} ${s.device_color ? `(${s.device_color})` : ''}`;
        document.getElementById('dtl-imei').textContent = s.imei_sn || '-';
        document.getElementById('dtl-screen-lock').textContent = s.screen_lock || 'Tidak Ada Kunci Layar';
        document.getElementById('dtl-physical').textContent = s.physical_condition || '-';
        document.getElementById('dtl-damage').textContent = s.damage_description;
        document.getElementById('dtl-created-at').textContent = this.formatDate(s.created_at);

        // Status Select
        const statusSelect = document.getElementById('dtl-status-select');
        if (statusSelect) statusSelect.value = s.status;

        // Technician Select
        const techSelect = document.getElementById('dtl-tech-select');
        if (techSelect) techSelect.value = s.technician_id || '';

        // Fee & Discount Inputs
        document.getElementById('dtl-service-fee').value = s.service_fee || 0;
        document.getElementById('dtl-discount').value = s.discount || 0;
        document.getElementById('dtl-down-payment').value = s.down_payment || 0;
        document.getElementById('dtl-payment-status').value = s.payment_status || 'belum_lunas';
        document.getElementById('dtl-warranty').value = s.warranty_days || 30;
        document.getElementById('dtl-tech-notes').value = s.technician_notes || '';

        // Render Attached Spareparts
        const partsContainer = document.getElementById('dtl-parts-list');
        const partsSumEl = document.getElementById('dtl-parts-sum');
        let partsTotal = 0;

        if (s.parts.length === 0) {
            partsContainer.innerHTML = `
                <div class="py-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded border border-dashed border-slate-200">
                    Belum ada sparepart gudang yang dialokasikan untuk unit servis ini.
                </div>
            `;
        } else {
            partsContainer.innerHTML = `
                <table class="w-full text-xs">
                    <thead>
                        <tr class="text-slate-500 border-b border-slate-200 text-left">
                            <th class="py-1">Part</th>
                            <th class="py-1 text-center">Qty</th>
                            <th class="py-1 text-right">Harga Satuan</th>
                            <th class="py-1 text-right">Subtotal</th>
                            <th class="py-1 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${s.parts.map(p => {
                            partsTotal += p.subtotal;
                            return `
                                <tr>
                                    <td class="py-2">
                                        <div class="font-semibold text-slate-800">${p.part_name}</div>
                                        <div class="text-[10px] text-slate-400 font-mono">${p.sku} | ${p.location || 'Gudang'}</div>
                                    </td>
                                    <td class="py-2 text-center font-bold">${p.quantity}</td>
                                    <td class="py-2 text-right">${this.formatRupiah(p.unit_sell_price)}</td>
                                    <td class="py-2 text-right font-semibold text-slate-900">${this.formatRupiah(p.subtotal)}</td>
                                    <td class="py-2 text-center">
                                        <button onclick="App.removePartFromService(${p.id})" title="Kembalikan sparepart ke gudang" class="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50">
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        partsSumEl.textContent = this.formatRupiah(partsTotal);

        // Kalkulasi Total Biaya Real-time
        this.updateServiceDetailTotals();
    },

    updateServiceDetailTotals() {
        const s = this.state.selectedService;
        if (!s) return;

        const fee = parseFloat(document.getElementById('dtl-service-fee').value) || 0;
        const discount = parseFloat(document.getElementById('dtl-discount').value) || 0;
        const dp = parseFloat(document.getElementById('dtl-down-payment').value) || 0;

        let partsTotal = 0;
        s.parts.forEach(p => partsTotal += p.subtotal);

        const grandTotal = Math.max(0, (fee + partsTotal) - discount);
        const sisaBayar = Math.max(0, grandTotal - dp);

        document.getElementById('dtl-grand-total').textContent = this.formatRupiah(grandTotal);
        document.getElementById('dtl-remaining-pay').textContent = this.formatRupiah(sisaBayar);
    },

    // Tambah Sparepart ke Servis Saat Ini (Otomatis potong stok gudang)
    async addPartToCurrentService() {
        const s = this.state.selectedService;
        if (!s) return;

        const select = document.getElementById('add-part-select');
        const qtyInput = document.getElementById('add-part-qty');
        const partId = select.value;
        const qty = parseInt(qtyInput.value) || 1;

        if (!partId) {
            this.showToast('Pilih sparepart gudang terlebih dahulu', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/services/${s.id}/parts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sparepart_id: parseInt(partId), quantity: qty })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message);
                qtyInput.value = 1;
                // Reload servis detail & reload sparepart dropdown options
                await this.viewServiceDetail(s.id);
                this.populatePartSelectOptions();
                this.loadDashboard();
            } else {
                this.showToast(data.message || 'Gagal menambahkan part', 'error');
            }
        } catch (e) {
            this.showToast('Gagal memproses penambahan sparepart', 'error');
        }
    },

    async removePartFromService(servicePartId) {
        const s = this.state.selectedService;
        if (!s) return;

        if (!confirm('Yakin ingin membatalkan penggunaan sparepart ini? Stok akan otomatis dikembalikan ke gudang.')) {
            return;
        }

        try {
            const res = await fetch(`/api/services/${s.id}/parts/${servicePartId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message);
                await this.viewServiceDetail(s.id);
                this.populatePartSelectOptions();
                this.loadDashboard();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal membatalkan part', 'error');
        }
    },

    async saveServiceDetailChanges() {
        const s = this.state.selectedService;
        if (!s) return;

        const payload = {
            customer_name: s.customer_name,
            customer_phone: s.customer_phone,
            customer_address: s.customer_address,
            device_brand: s.device_brand,
            device_model: s.device_model,
            device_color: s.device_color,
            imei_sn: s.imei_sn,
            screen_lock: s.screen_lock,
            physical_condition: s.physical_condition,
            damage_description: s.damage_description,
            technician_id: document.getElementById('dtl-tech-select').value || null,
            status: document.getElementById('dtl-status-select').value,
            service_fee: parseFloat(document.getElementById('dtl-service-fee').value) || 0,
            discount: parseFloat(document.getElementById('dtl-discount').value) || 0,
            down_payment: parseFloat(document.getElementById('dtl-down-payment').value) || 0,
            payment_status: document.getElementById('dtl-payment-status').value,
            warranty_days: parseInt(document.getElementById('dtl-warranty').value) || 30,
            technician_notes: document.getElementById('dtl-tech-notes').value
        };

        try {
            const res = await fetch(`/api/services/${s.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('Tiket servis berhasil diperbarui');
                this.closeModal('modal-service-detail');
                this.loadServices();
                this.loadDashboard();
            } else {
                this.showToast(data.message || 'Gagal menyimpan perubahan', 'error');
            }
        } catch (e) {
            this.showToast('Gagal terhubung ke server', 'error');
        }
    },

    // 5. WhatsApp Message Integration
    openWhatsAppPrompt(phone, customerName, ticketNo, device, status, totalCost) {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.slice(1);
        }

        const store = this.state.master.settings;
        const storeName = store.name || 'Satria Celular';

        let defaultMsg = '';
        if (status === 'antrean' || status === 'pengecekan') {
            defaultMsg = `Halo Kak ${customerName},\n\nTerima kasih telah mempercayakan perbaikan HP Anda di *${storeName}*.\n\n📌 *Nomor Tanda Terima:* ${ticketNo}\n📱 *Unit:* ${device}\n📋 *Status:* Unit sedang dalam proses antrean & pengecekan oleh teknisi kami.\n\nKami akan segera menginformasikan estimasi biaya dan kelanjutan pengerjaan. Terima kasih! 🙏`;
        } else if (status === 'selesai') {
            defaultMsg = `Halo Kak ${customerName},\n\nKabar gembira! Perbaikan unit Anda di *${storeName}* telah *SELESAI* dan lulus uji kelayakan fungsi: ✨\n\n📌 *Nomor Tiket:* ${ticketNo}\n📱 *Unit:* ${device}\n💰 *Total Biaya:* ${this.formatRupiah(totalCost)}\n🛡️ *Garansi:* Sesuai ketentuan nota\n\nUnit sudah dapat diambil di toko kami pada jam operasional. Harap membawa nota tanda terima fisik/digital saat pengambilan. Terima kasih! 🙏`;
        } else {
            defaultMsg = `Halo Kak ${customerName},\n\nUpdate status servis HP Anda di *${storeName}*:\n📌 *Nomor Tiket:* ${ticketNo}\n📱 *Unit:* ${device}\n📋 *Status Terkini:* ${status.toUpperCase()}\n\nJika ada pertanyaan mengenai proses perbaikan, silakan balas pesan ini. Terima kasih! 🙏`;
        }

        document.getElementById('wa-target-phone').value = cleanPhone;
        document.getElementById('wa-message-content').value = defaultMsg;
        this.openModal('modal-whatsapp');
    },

    sendWhatsAppDirect() {
        const phone = document.getElementById('wa-target-phone').value;
        const msg = document.getElementById('wa-message-content').value;

        if (!phone) {
            this.showToast('Nomor WhatsApp tidak valid', 'error');
            return;
        }

        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        this.closeModal('modal-whatsapp');
    },

    // 6. Cetak Nota & Label Stiker (Thermal 80mm / Invoice A4 / Label HP)
    async openPrintModal(serviceId) {
        try {
            const res = await fetch(`/api/services/${serviceId}`);
            const data = await res.json();
            if (data.status === 'success') {
                this.state.selectedService = data.data;
                this.renderPrintPreview('thermal'); // Default preview thermal
                this.openModal('modal-print');
            }
        } catch (e) {
            this.showToast('Gagal memuat data cetak', 'error');
        }
    },

    renderPrintPreview(format = 'thermal') {
        const s = this.state.selectedService;
        if (!s) return;

        const store = s.store || this.state.master.settings;
        const printArea = document.getElementById('print-container');
        const previewArea = document.getElementById('print-preview-content');

        let html = '';

        if (format === 'thermal') {
            // Nota Struk Thermal 80mm
            html = `
                <div class="print-thermal font-mono text-[11px] leading-tight text-black p-4 border border-dashed border-slate-300 mx-auto max-w-[340px] bg-white">
                    <div class="text-center mb-2">
                        <div class="font-bold text-sm uppercase">${store.name || 'SATRIA CELULAR'}</div>
                        <div class="text-[10px]">${store.tagline || 'Pusat Servis HP & Sparepart'}</div>
                        <div class="text-[9px]">${store.address || '-'}</div>
                        <div class="text-[9px]">WA: ${store.phone || '-'}</div>
                    </div>
                    <hr class="border-t border-dashed my-1">
                    <div class="flex justify-between text-[10px]">
                        <span>No: ${s.ticket_number}</span>
                        <span>${this.formatDate(s.created_at)}</span>
                    </div>
                    <div class="text-[10px]">Pelanggan: <b>${s.customer_name}</b> (${s.customer_phone})</div>
                    <div class="text-[10px]">Unit: <b>${s.device_brand} ${s.device_model}</b></div>
                    <div class="text-[10px]">IMEI: ${s.imei_sn || '-'} | Kunci: ${s.screen_lock || '-'}</div>
                    <div class="text-[10px] text-slate-700">Kerusakan: ${s.damage_description}</div>
                    <hr class="border-t border-dashed my-1">
                    
                    <div class="font-bold text-[10px] mb-1">RINCIAN PERBAIKAN:</div>
                    ${s.parts.map(p => `
                        <div class="flex justify-between text-[10px]">
                            <span>${p.quantity}x ${p.part_name}</span>
                            <span>${this.formatRupiah(p.subtotal)}</span>
                        </div>
                    `).join('')}
                    <div class="flex justify-between text-[10px]">
                        <span>Jasa Teknisi (${s.technician_name || 'Teknisi'})</span>
                        <span>${this.formatRupiah(s.service_fee)}</span>
                    </div>
                    ${s.discount > 0 ? `
                        <div class="flex justify-between text-[10px] text-slate-600">
                            <span>Diskon</span>
                            <span>-${this.formatRupiah(s.discount)}</span>
                        </div>
                    ` : ''}

                    <hr class="border-t border-dashed my-1">
                    <div class="flex justify-between font-bold text-xs">
                        <span>TOTAL BIAYA:</span>
                        <span>${this.formatRupiah(s.total_cost)}</span>
                    </div>
                    <div class="flex justify-between text-[10px]">
                        <span>Uang Muka / DP:</span>
                        <span>${this.formatRupiah(s.down_payment)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-[11px] mt-0.5">
                        <span>SISA BAYAR:</span>
                        <span>${this.formatRupiah(Math.max(0, s.total_cost - s.down_payment))}</span>
                    </div>
                    <div class="flex justify-between text-[10px]">
                        <span>Status Pembayaran:</span>
                        <span class="uppercase">${s.payment_status}</span>
                    </div>
                    <hr class="border-t border-dashed my-1">
                    
                    <div class="text-[9px] text-center my-2 leading-tight">
                        * Garansi sparepart ${s.warranty_days} hari sejak unit diambil.<br>
                        * Segel baut wajib utuh, tidak terkena air/jatuh pecah.<br>
                        * Harap simpan bukti nota ini untuk klaim garansi.
                    </div>
                    <div class="text-center font-bold text-[10px] mt-2">TERIMA KASIH ATAS KUNJUNGAN ANDA</div>
                </div>
            `;
        } else if (format === 'invoice') {
            // Nota Faktur Invoice Standar A4 / A5
            html = `
                <div class="print-invoice bg-white p-6 border border-slate-300 max-w-2xl mx-auto text-slate-900 text-xs">
                    <div class="flex justify-between items-start border-b pb-4 mb-4">
                        <div>
                            <h2 class="text-xl font-black text-blue-700 uppercase tracking-tight">${store.name || 'SATRIA CELULAR'}</h2>
                            <p class="text-slate-500 font-medium">${store.tagline || 'Pusat Servis HP & Sparepart Terpercaya'}</p>
                            <p class="text-slate-600 mt-1">${store.address || '-'}</p>
                            <p class="text-slate-600">WhatsApp / Telp: <b>${store.phone || '-'}</b></p>
                        </div>
                        <div class="text-right">
                            <div class="inline-block bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded text-sm mb-1">
                                TANDA TERIMA SERVIS
                            </div>
                            <div class="font-mono font-bold text-base text-slate-800">${s.ticket_number}</div>
                            <div class="text-slate-500 text-[11px]">Tanggal: ${this.formatDate(s.created_at)}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg mb-4 text-xs">
                        <div>
                            <div class="text-slate-400 font-bold uppercase text-[10px]">Data Pelanggan</div>
                            <div class="font-bold text-slate-800 text-sm mt-0.5">${s.customer_name}</div>
                            <div class="text-slate-600">No. WhatsApp: ${s.customer_phone}</div>
                            <div class="text-slate-600">Alamat: ${s.customer_address || '-'}</div>
                        </div>
                        <div>
                            <div class="text-slate-400 font-bold uppercase text-[10px]">Data Unit HP</div>
                            <div class="font-bold text-slate-800 text-sm mt-0.5">${s.device_brand} ${s.device_model}</div>
                            <div class="text-slate-600">Warna / IMEI: ${s.device_color || '-'} / ${s.imei_sn || '-'}</div>
                            <div class="text-slate-600">Pola / Kunci: <span class="font-mono text-amber-800 font-bold">${s.screen_lock || 'Tidak Ada'}</span></div>
                        </div>
                    </div>

                    <div class="mb-4">
                        <div class="text-slate-500 font-semibold mb-1 text-[11px]">Keluhan / Kerusakan Awal:</div>
                        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 font-medium text-xs">
                            ${s.damage_description}
                        </div>
                    </div>

                    <div class="mb-4">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold text-left">
                                    <th class="py-2 px-3">Item / Uraian Servis</th>
                                    <th class="py-2 px-3 text-center">Qty</th>
                                    <th class="py-2 px-3 text-right">Harga Satuan</th>
                                    <th class="py-2 px-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr>
                                    <td class="py-2.5 px-3">
                                        <div class="font-semibold text-slate-800">Jasa Servis & Analisis Mesin</div>
                                        <div class="text-[10px] text-slate-400">Teknisi PIC: ${s.technician_name || 'Satria Celular Team'}</div>
                                    </td>
                                    <td class="py-2.5 px-3 text-center">1</td>
                                    <td class="py-2.5 px-3 text-right">${this.formatRupiah(s.service_fee)}</td>
                                    <td class="py-2.5 px-3 text-right font-medium">${this.formatRupiah(s.service_fee)}</td>
                                </tr>
                                ${s.parts.map(p => `
                                    <tr>
                                        <td class="py-2.5 px-3">
                                            <div class="font-semibold text-slate-800">${p.part_name}</div>
                                            <div class="text-[10px] text-slate-400 font-mono">SKU: ${p.sku}</div>
                                        </td>
                                        <td class="py-2.5 px-3 text-center">${p.quantity}</td>
                                        <td class="py-2.5 px-3 text-right">${this.formatRupiah(p.unit_sell_price)}</td>
                                        <td class="py-2.5 px-3 text-right font-medium">${this.formatRupiah(p.subtotal)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="flex justify-end mb-6">
                        <div class="w-64 space-y-1.5 text-xs">
                            <div class="flex justify-between text-slate-600">
                                <span>Total Tagihan:</span>
                                <span class="font-semibold">${this.formatRupiah(s.total_cost + s.discount)}</span>
                            </div>
                            ${s.discount > 0 ? `
                                <div class="flex justify-between text-emerald-600">
                                    <span>Diskon:</span>
                                    <span>-${this.formatRupiah(s.discount)}</span>
                                </div>
                            ` : ''}
                            <div class="flex justify-between text-slate-900 font-bold border-t pt-1 text-sm">
                                <span>Grand Total:</span>
                                <span class="text-blue-700">${this.formatRupiah(s.total_cost)}</span>
                            </div>
                            <div class="flex justify-between text-slate-600">
                                <span>DP / Uang Muka:</span>
                                <span>${this.formatRupiah(s.down_payment)}</span>
                            </div>
                            <div class="flex justify-between font-bold text-slate-800 border-t pt-1">
                                <span>Sisa Pembayaran:</span>
                                <span>${this.formatRupiah(Math.max(0, s.total_cost - s.down_payment))}</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 border-t pt-4 text-[10px] text-slate-500">
                        <div>
                            <b>Syarat & Ketentuan Garansi:</b>
                            <p class="mt-1">${store.warranty_note || 'Garansi berlaku sesuai part yang diganti. Segel utuh, tidak jatuh dan tidak terkena air.'}</p>
                            <p class="mt-1">Masa Garansi: <b>${s.warranty_days} Hari</b> sejak barang diambil.</p>
                        </div>
                        <div class="flex justify-around text-center pt-2">
                            <div>
                                <p class="text-slate-400">Pemilik HP</p>
                                <div class="h-10"></div>
                                <p class="font-semibold text-slate-800">(${s.customer_name})</p>
                            </div>
                            <div>
                                <p class="text-slate-400">Hormat Kami,</p>
                                <div class="h-10"></div>
                                <p class="font-semibold text-slate-800">(Satria Celular)</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (format === 'label') {
            // Stiker Label Casing HP (Ukuran Tempel Punggung HP)
            html = `
                <div class="print-label border-2 border-black p-2 max-w-[240px] mx-auto bg-white font-mono text-[9px] leading-tight text-black">
                    <div class="text-center font-bold text-xs uppercase border-b pb-0.5 mb-1">SATRIA CELULAR</div>
                    <div class="flex justify-between font-bold text-[11px] mb-0.5">
                        <span>NO:</span>
                        <span>${s.ticket_number}</span>
                    </div>
                    <div>Nama: <b>${s.customer_name}</b></div>
                    <div>Unit: ${s.device_brand} ${s.device_model}</div>
                    <div>Tgl: ${this.formatDate(s.created_at)}</div>
                    <div>Kunci: <b>${s.screen_lock || 'Tidak Ada'}</b></div>
                    <div class="mt-1 text-[8px] italic text-slate-600 border-t pt-0.5">Kerusakan: ${s.damage_description.slice(0, 40)}...</div>
                </div>
            `;
        }

        previewArea.innerHTML = html;
        printArea.innerHTML = html;
    },

    executePrint() {
        const previewEl = document.getElementById('print-preview-content');
        if (!previewEl || !previewEl.innerHTML) {
            window.print();
            return;
        }

        const printHtml = previewEl.innerHTML;

        // Buat iframe terisolasi di luar viewport dengan ukuran nyata
        let iframe = document.getElementById('receipt-isolated-frame');
        if (iframe) iframe.remove(); // Hapus iframe lama agar selalu segar

        iframe = document.createElement('iframe');
        iframe.id = 'receipt-isolated-frame';
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '800px';
        iframe.style.height = '1000px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Cetak Nota - Satria Celular</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    }
                    @page {
                        margin: 2mm;
                    }
                    /* Styling Struk Kasir Thermal (80mm) */
                    .print-thermal {
                        display: block !important;
                        width: 76mm;
                        margin: 0 auto;
                        padding: 4px;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 11px;
                        line-height: 1.35;
                        color: #000000;
                    }
                    .print-thermal hr {
                        border: none;
                        border-top: 1px dashed #000000;
                        margin: 5px 0;
                    }

                    /* Styling Invoice A4 / A5 */
                    .print-invoice {
                        display: block !important;
                        max-width: 190mm;
                        margin: 0 auto;
                        padding: 10px;
                        font-size: 12px;
                        line-height: 1.5;
                        color: #111827;
                    }

                    /* Styling Label Casing HP */
                    .print-label {
                        display: block !important;
                        width: 58mm;
                        margin: 0 auto;
                        padding: 4px;
                        border: 1px dashed #000000;
                        font-family: monospace;
                        font-size: 9px;
                        line-height: 1.2;
                    }

                    /* Utility CSS Classes */
                    .flex { display: flex; }
                    .justify-between { justify-content: space-between; }
                    .items-center { align-items: center; }
                    .items-start { align-items: flex-start; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: bold; }
                    .font-semibold { font-weight: 600; }
                    .font-black { font-weight: 900; }
                    .font-mono { font-family: monospace; }
                    .uppercase { text-transform: uppercase; }
                    .italic { font-style: italic; }
                    .text-xs { font-size: 11px; }
                    .text-sm { font-size: 13px; }
                    .text-base { font-size: 14px; }
                    .text-xl { font-size: 18px; }
                    .text-\\[8px\\] { font-size: 8px; }
                    .text-\\[9px\\] { font-size: 9px; }
                    .text-\\[10px\\] { font-size: 10px; }
                    .text-\\[11px\\] { font-size: 11px; }
                    .leading-tight { line-height: 1.25; }
                    .my-1 { margin-top: 4px; margin-bottom: 4px; }
                    .my-2 { margin-top: 8px; margin-bottom: 8px; }
                    .mb-1 { margin-bottom: 4px; }
                    .mb-2 { margin-bottom: 8px; }
                    .mb-4 { margin-bottom: 16px; }
                    .mb-6 { margin-bottom: 24px; }
                    .mt-0\\.5 { margin-top: 2px; }
                    .mt-1 { margin-top: 4px; }
                    .mt-2 { margin-top: 8px; }
                    .p-2 { padding: 8px; }
                    .p-2\\.5 { padding: 10px; }
                    .p-3 { padding: 12px; }
                    .p-4 { padding: 16px; }
                    .p-6 { padding: 20px; }
                    .py-1 { padding-top: 4px; padding-bottom: 4px; }
                    .py-2 { padding-top: 8px; padding-bottom: 8px; }
                    .py-2\\.5 { padding-top: 10px; padding-bottom: 10px; }
                    .px-3 { padding-left: 12px; padding-right: 12px; }
                    .border { border: 1px solid #d1d5db; }
                    .border-2 { border: 2px solid #000; }
                    .border-t { border-top: 1px solid #e5e7eb; }
                    .border-b { border-bottom: 1px solid #e5e7eb; }
                    .border-dashed { border-style: dashed; }
                    .border-black { border-color: #000; }
                    .rounded { border-radius: 4px; }
                    .rounded-lg { border-radius: 8px; }
                    .grid { display: grid; }
                    .grid-cols-2 { display: grid; grid-template-columns: 1fr 1fr; }
                    .gap-4 { gap: 16px; }
                    .space-y-1\\.5 > * + * { margin-top: 6px; }
                    .w-full { width: 100%; }
                    .w-64 { width: 250px; }
                    .max-w-2xl { max-width: 650px; }
                    .mx-auto { margin-left: auto; margin-right: auto; }
                    .bg-white { background: #fff; }
                    .bg-slate-50 { background: #f8fafc; }
                    .bg-slate-100 { background: #f1f5f9; }
                    .bg-blue-100 { background: #dbeafe; }
                    .bg-rose-50 { background: #fff1f2; }
                    .text-blue-700 { color: #1d4ed8; }
                    .text-blue-800 { color: #1e40af; }
                    .text-slate-400 { color: #94a3b8; }
                    .text-slate-500 { color: #64748b; }
                    .text-slate-600 { color: #475569; }
                    .text-slate-700 { color: #334155; }
                    .text-slate-800 { color: #1e293b; }
                    .text-slate-900 { color: #0f172a; }
                    .text-rose-600, .text-rose-800 { color: #dc2626; }
                    .text-emerald-600 { color: #059669; }
                    .text-amber-800 { color: #92400e; }
                    .h-10 { height: 40px; }
                    table { width: 100%; border-collapse: collapse; }
                    .divide-y > * + * { border-top: 1px solid #e5e7eb; }
                </style>
            </head>
            <body>
                ${printHtml}
            </body>
            </html>
        `);
        iframeDoc.close();

        // Print segera (150ms) tanpa dependensi eksternal
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 150);
    },

    // 7. Modals Helper
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // Quick Restock Dialog
    openQuickRestock(id, sku, nameEnc, currentStock) {
        const name = decodeURIComponent(nameEnc);
        document.getElementById('restock-part-id').value = id;
        document.getElementById('restock-part-name').textContent = `${name} (${sku})`;
        document.getElementById('restock-current-stock').textContent = `${currentStock} unit`;
        document.getElementById('restock-qty').value = 5;
        document.getElementById('restock-notes').value = 'Restok barang masuk dari supplier';
        this.openModal('modal-quick-restock');
    },

    async submitQuickRestock() {
        const id = document.getElementById('restock-part-id').value;
        const qty = parseInt(document.getElementById('restock-qty').value) || 0;
        const notes = document.getElementById('restock-notes').value;

        if (qty <= 0) {
            this.showToast('Jumlah restok harus lebih dari 0', 'error');
            return;
        }

        try {
            const res = await fetch(`/api/spareparts/${id}/adjust-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    change_type: 'in_purchase',
                    quantity: qty,
                    notes: notes
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message);
                this.closeModal('modal-quick-restock');
                this.loadSpareparts();
                this.loadDashboard();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal memproses restok', 'error');
        }
    },

    // Form Tambah/Edit Sparepart
    openAddSparepart() {
        document.getElementById('sp-form-title').textContent = 'Tambah Sparepart Baru ke Gudang';
        document.getElementById('sp-form-id').value = '';
        document.getElementById('sp-form-sku').value = '';
        document.getElementById('sp-form-name').value = '';
        document.getElementById('sp-form-category').value = '';
        document.getElementById('sp-form-brand').value = '';
        document.getElementById('sp-form-models').value = '';
        document.getElementById('sp-form-stock').value = 1;
        document.getElementById('sp-form-min-stock').value = 2;
        document.getElementById('sp-form-cost').value = 0;
        document.getElementById('sp-form-sell').value = 0;
        document.getElementById('sp-form-location').value = 'Rak A-01';
        document.getElementById('sp-form-notes').value = '';
        this.openModal('modal-sparepart-form');
    },

    async openEditSparepart(partId) {
        try {
            const res = await fetch(`/api/spareparts/${partId}`);
            const data = await res.json();
            if (data.status === 'success') {
                const sp = data.data;
                document.getElementById('sp-form-title').textContent = 'Edit Data Sparepart';
                document.getElementById('sp-form-id').value = sp.id;
                document.getElementById('sp-form-sku').value = sp.sku;
                document.getElementById('sp-form-name').value = sp.name;
                document.getElementById('sp-form-category').value = sp.category_id || '';
                document.getElementById('sp-form-brand').value = sp.brand_id || '';
                document.getElementById('sp-form-models').value = sp.compatible_models || '';
                document.getElementById('sp-form-stock').value = sp.stock;
                document.getElementById('sp-form-stock').disabled = true; // stok diubah lewat menu restok
                document.getElementById('sp-form-min-stock').value = sp.min_stock;
                document.getElementById('sp-form-cost').value = sp.cost_price;
                document.getElementById('sp-form-sell').value = sp.sell_price;
                document.getElementById('sp-form-location').value = sp.location || '';
                document.getElementById('sp-form-notes').value = sp.notes || '';
                this.openModal('modal-sparepart-form');
            }
        } catch (e) {
            this.showToast('Gagal mengambil data sparepart', 'error');
        }
    },

    async submitSparepartForm() {
        const id = document.getElementById('sp-form-id').value;
        const payload = {
            sku: document.getElementById('sp-form-sku').value.trim(),
            name: document.getElementById('sp-form-name').value.trim(),
            category_id: document.getElementById('sp-form-category').value || null,
            brand_id: document.getElementById('sp-form-brand').value || null,
            compatible_models: document.getElementById('sp-form-models').value.trim(),
            stock: parseInt(document.getElementById('sp-form-stock').value) || 0,
            min_stock: parseInt(document.getElementById('sp-form-min-stock').value) || 2,
            cost_price: parseFloat(document.getElementById('sp-form-cost').value) || 0,
            sell_price: parseFloat(document.getElementById('sp-form-sell').value) || 0,
            location: document.getElementById('sp-form-location').value.trim(),
            notes: document.getElementById('sp-form-notes').value.trim()
        };

        if (!payload.sku || !payload.name) {
            this.showToast('SKU dan Nama Sparepart wajib diisi!', 'error');
            return;
        }

        const isEdit = !!id;
        const url = isEdit ? `/api/spareparts/${id}` : '/api/spareparts';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message);
                this.closeModal('modal-sparepart-form');
                this.loadSpareparts();
                this.loadDashboard();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal menyimpan sparepart', 'error');
        }
    },

    async deleteSparepart(id, nameEnc) {
        const name = decodeURIComponent(nameEnc);
        if (!confirm(`Hapus sparepart "${name}" dari gudang?`)) return;

        try {
            const res = await fetch(`/api/spareparts/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(data.message);
                this.loadSpareparts();
                this.loadDashboard();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal menghapus sparepart', 'error');
        }
    },

    // Populate opsi sparepart di modal tiket servis
    async populatePartSelectOptions() {
        const select = document.getElementById('add-part-select');
        if (!select) return;

        try {
            const res = await fetch('/api/spareparts');
            const data = await res.json();
            if (data.status === 'success') {
                select.innerHTML = '<option value="">-- Pilih Sparepart Gudang --</option>';
                data.data.forEach(p => {
                    const disabled = p.stock <= 0 ? 'disabled' : '';
                    select.innerHTML += `
                        <option value="${p.id}" ${disabled}>
                            ${p.name} [Stok: ${p.stock}] - ${this.formatRupiah(p.sell_price)} (${p.location || 'Gudang'})
                        </option>
                    `;
                });
            }
        } catch (e) {
            console.error('Failed to populate parts select', e);
        }
    },

    // Form Penerimaan Servis Baru
    prepareNewServiceForm() {
        document.getElementById('new-customer-name').value = '';
        document.getElementById('new-customer-phone').value = '';
        document.getElementById('new-customer-address').value = '';
        document.getElementById('new-device-brand').value = '';
        document.getElementById('new-device-model').value = '';
        document.getElementById('new-device-color').value = '';
        document.getElementById('new-imei-sn').value = '';
        document.getElementById('new-screen-lock').value = '';
        document.getElementById('new-physical-condition').value = 'Unit Only, Layar Mulus, Bodi Pemakaian Wajar';
        document.getElementById('new-damage-desc').value = '';
        document.getElementById('new-tech-id').value = '';
        document.getElementById('new-service-fee').value = 50000;
        document.getElementById('new-down-payment').value = 0;
        document.getElementById('new-warranty-days').value = 30;
        document.getElementById('new-tech-notes').value = '';
    },

    async submitNewService() {
        const payload = {
            customer_name: document.getElementById('new-customer-name').value.trim(),
            customer_phone: document.getElementById('new-customer-phone').value.trim(),
            customer_address: document.getElementById('new-customer-address').value.trim(),
            device_brand: document.getElementById('new-device-brand').value.trim(),
            device_model: document.getElementById('new-device-model').value.trim(),
            device_color: document.getElementById('new-device-color').value.trim(),
            imei_sn: document.getElementById('new-imei-sn').value.trim(),
            screen_lock: document.getElementById('new-screen-lock').value.trim(),
            physical_condition: document.getElementById('new-physical-condition').value.trim(),
            damage_description: document.getElementById('new-damage-desc').value.trim(),
            technician_id: document.getElementById('new-tech-id').value || null,
            service_fee: parseFloat(document.getElementById('new-service-fee').value) || 0,
            discount: 0,
            down_payment: parseFloat(document.getElementById('new-down-payment').value) || 0,
            warranty_days: parseInt(document.getElementById('new-warranty-days').value) || 30,
            technician_notes: document.getElementById('new-tech-notes').value.trim(),
            status: 'antrean'
        };

        if (!payload.customer_name || !payload.customer_phone || !payload.device_brand || !payload.device_model || !payload.damage_description) {
            this.showToast('Mohon lengkapi Nama Pelanggan, No WA, Merk, Model, dan Keluhan HP!', 'error');
            return;
        }

        try {
            const res = await fetch('/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast(`Tiket servis ${data.ticket_number} berhasil dibuat!`);
                // Buka dialog cetak otomatis atau buka detail
                this.switchTab('services');
                this.viewServiceDetail(data.id);
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal membuat tiket servis', 'error');
        }
    },

    // 8. Stock Logs
    async loadStockLogs() {
        try {
            const res = await fetch('/api/stock-logs');
            const data = await res.json();
            if (data.status === 'success') {
                this.state.stockLogs = data.data;
                this.renderStockLogs();
            }
        } catch (e) {
            this.showToast('Gagal memuat log mutasi', 'error');
        }
    },

    renderStockLogs() {
        const tbody = document.getElementById('stock-logs-tbody');
        if (!tbody) return;

        if (this.state.stockLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Belum ada riwayat mutasi stok</td></tr>`;
            return;
        }

        const typeLabels = {
            'in_initial': { label: 'Stok Awal', class: 'bg-blue-100 text-blue-700' },
            'in_purchase': { label: 'Barang Masuk / Beli', class: 'bg-emerald-100 text-emerald-700 font-semibold' },
            'out_service': { label: 'Terpakai Servis', class: 'bg-purple-100 text-purple-700 font-semibold' },
            'in_service_cancel': { label: 'Batal Servis (Kembali)', class: 'bg-amber-100 text-amber-700' },
            'out_waste': { label: 'Rusak / Afkir', class: 'bg-rose-100 text-rose-700' },
            'adjustment': { label: 'Stok Opname', class: 'bg-slate-100 text-slate-700' }
        };

        tbody.innerHTML = this.state.stockLogs.map(l => {
            const t = typeLabels[l.change_type] || { label: l.change_type, class: 'bg-gray-100 text-gray-700' };
            const isPlus = l.change_type.startsWith('in_');

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition">
                    <td class="py-2.5 px-3 text-slate-400">${this.formatDate(l.created_at)}</td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-800">${l.part_name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${l.sku}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        <span class="inline-flex px-2 py-0.5 rounded text-[11px] ${t.class}">${t.label}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center font-bold ${isPlus ? 'text-emerald-600' : 'text-rose-600'}">
                        ${isPlus ? `+${l.quantity}` : `-${l.quantity}`}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500">
                        ${l.previous_stock} &rarr; <b class="text-slate-800">${l.current_stock}</b>
                    </td>
                    <td class="py-2.5 px-3 font-mono text-slate-600">${l.reference_id || '-'}</td>
                    <td class="py-2.5 px-3 text-slate-500">${l.notes || '-'}</td>
                </tr>
            `;
        }).join('');
    },

    // 9. Pengaturan & Master Data Toko
    renderSettings() {
        const s = this.state.master.settings;
        document.getElementById('set-name').value = s.name || '';
        document.getElementById('set-tagline').value = s.tagline || '';
        document.getElementById('set-address').value = s.address || '';
        document.getElementById('set-phone').value = s.phone || '';
        document.getElementById('set-whatsapp').value = s.whatsapp || '';
        document.getElementById('set-warranty').value = s.warranty_note || '';

        // Render List Kategori
        const catList = document.getElementById('settings-cat-list');
        catList.innerHTML = this.state.master.categories.map(c => `
            <div class="flex justify-between items-center py-1.5 px-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <span class="font-semibold text-slate-800">${c.name}</span>
                <span class="text-slate-400">${c.description || ''}</span>
            </div>
        `).join('');

        // Render List Merk
        const brandList = document.getElementById('settings-brand-list');
        brandList.innerHTML = this.state.master.brands.map(b => `
            <div class="py-1 px-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-medium text-slate-700">
                ${b.name}
            </div>
        `).join('');

        // Render List Teknisi
        const techList = document.getElementById('settings-tech-list');
        techList.innerHTML = this.state.master.technicians.map(t => `
            <div class="flex justify-between items-center py-2 px-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div>
                    <div class="font-bold text-slate-800">${t.name}</div>
                    <div class="text-[10px] text-slate-500">${t.specialty || 'Teknisi Servis'} - 📞 ${t.phone || '-'}</div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}">
                    ${t.status.toUpperCase()}
                </span>
            </div>
        `).join('');
    },

    async saveSettings() {
        const payload = {
            name: document.getElementById('set-name').value.trim(),
            tagline: document.getElementById('set-tagline').value.trim(),
            address: document.getElementById('set-address').value.trim(),
            phone: document.getElementById('set-phone').value.trim(),
            whatsapp: document.getElementById('set-whatsapp').value.trim(),
            warranty_note: document.getElementById('set-warranty').value.trim()
        };

        try {
            const res = await fetch('/api/master/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('Pengaturan toko Satria Celular berhasil disimpan!');
                await this.loadMasterData();
            }
        } catch (e) {
            this.showToast('Gagal menyimpan pengaturan', 'error');
        }
    },

    async addNewCategory() {
        const name = prompt('Masukkan nama kategori baru (misal: Konektor Cas, Kaca Kamera):');
        if (!name) return;

        try {
            const res = await fetch('/api/master/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('Kategori berhasil ditambahkan');
                await this.loadMasterData();
                this.renderSettings();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal menambah kategori', 'error');
        }
    },

    async addNewBrand() {
        const name = prompt('Masukkan nama merk HP baru (misal: Motorola, Google Pixel, OnePlus):');
        if (!name) return;

        try {
            const res = await fetch('/api/master/brands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('Merk berhasil ditambahkan');
                await this.loadMasterData();
                this.renderSettings();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (e) {
            this.showToast('Gagal menambah merk', 'error');
        }
    },

    async addNewTechnician() {
        const name = prompt('Nama Teknisi:');
        if (!name) return;
        const specialty = prompt('Keahlian (misal: Hardware IC / Ganti Kaca OCA / Software):') || 'Teknisi Servis';
        const phone = prompt('Nomor HP / WhatsApp:') || '';

        try {
            const res = await fetch('/api/master/technicians', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, specialty, phone })
            });
            const data = await res.json();
            if (data.status === 'success') {
                this.showToast('Teknisi berhasil ditambahkan');
                await this.loadMasterData();
                this.renderSettings();
            }
        } catch (e) {
            this.showToast('Gagal menambah teknisi', 'error');
        }
    },

    async exportDataBackup() {
        window.open('/api/export', '_blank');
    },

    // Setup Event Listeners Filter & Form
    setupForms() {
        // Filter Gudang Sparepart
        const spSearchInput = document.getElementById('sp-search-input');
        if (spSearchInput) {
            spSearchInput.addEventListener('input', (e) => {
                this.state.activeFilters.spSearch = e.target.value;
                this.loadSpareparts();
            });
        }

        const spCatSelect = document.getElementById('sp-cat-filter');
        if (spCatSelect) {
            spCatSelect.addEventListener('change', (e) => {
                this.state.activeFilters.spCategory = e.target.value;
                this.loadSpareparts();
            });
        }

        const spBrandSelect = document.getElementById('sp-brand-filter');
        if (spBrandSelect) {
            spBrandSelect.addEventListener('change', (e) => {
                this.state.activeFilters.spBrand = e.target.value;
                this.loadSpareparts();
            });
        }

        const spLowStockCheck = document.getElementById('sp-low-stock-check');
        if (spLowStockCheck) {
            spLowStockCheck.addEventListener('change', (e) => {
                this.state.activeFilters.spLowStock = e.target.checked;
                this.loadSpareparts();
            });
        }

        // Filter Servis
        const svcSearchInput = document.getElementById('svc-search-input');
        if (svcSearchInput) {
            svcSearchInput.addEventListener('input', (e) => {
                this.state.activeFilters.svcSearch = e.target.value;
                this.loadServices();
            });
        }

        const svcStatusSelect = document.getElementById('svc-status-filter');
        if (svcStatusSelect) {
            svcStatusSelect.addEventListener('change', (e) => {
                this.state.activeFilters.svcStatus = e.target.value;
                this.loadServices();
            });
        }

        const svcTechSelect = document.getElementById('svc-tech-filter');
        if (svcTechSelect) {
            svcTechSelect.addEventListener('change', (e) => {
                this.state.activeFilters.svcTech = e.target.value;
                this.loadServices();
            });
        }
    }
};

// Start application when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
