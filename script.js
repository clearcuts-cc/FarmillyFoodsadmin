// --- Supabase Setup ---
const supabaseUrl = 'https://jztreusepxilnfqffwka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dHJldXNlcHhpbG5mcWZmd2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA5OTUsImV4cCI6MjA5MDQ0Njk5NX0.AXaOi_ax6esifM7DzwVjNXQrm3XLNPnzT_0yQWm6ahY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Dummy Data ---
const products = [
    { id: 1, name: "A2 Gir Cow Ghee", cat: "Ghee & Oils", price: 999, stock: 45, status: true, img: "https://placehold.co/50/3A6B35/FFF?text=Ghee" },
    { id: 2, name: "Wild Forest Honey", cat: "Honey & Jaggery", price: 450, stock: 15, status: true, img: "https://placehold.co/50/f59e0b/FFF?text=Hny" },
    { id: 3, name: "Organic Jaggery Powder", cat: "Honey & Jaggery", price: 120, stock: 120, status: true, img: "https://placehold.co/50/8b5cf6/FFF?text=Jag" },
    { id: 4, name: "Cold Pressed Mustard Oil", cat: "Ghee & Oils", price: 250, stock: 0, status: false, img: "https://placehold.co/50/3b82f6/FFF?text=Oil" },
    { id: 5, name: "Foxtail Millet", cat: "Millets", price: 180, stock: 80, status: true, img: "https://placehold.co/50/10b981/FFF?text=Mil" },
    { id: 6, name: "Turmeric Powder (Waigaon)", cat: "Spices", price: 150, stock: 5, status: true, img: "https://placehold.co/50/ef4444/FFF?text=Tur" }
];

let orders = [
    { id: "FM-1024531", customer: "Priya Sharma", phone: "9876543210", items: 2, amount: 1448, payment: "UPI", status: "delivered", date: "30 Mar 2026" },
    { id: "FM-1024532", customer: "Ravi Kumar", phone: "9812345678", items: 1, amount: 549, payment: "COD", status: "shipped", date: "30 Mar 2026" },
    { id: "FM-1024533", customer: "Anita Patel", phone: "9988776655", items: 3, amount: 1237, payment: "Card", status: "confirmed", date: "29 Mar 2026" },
    { id: "FM-1024534", customer: "Suresh Menon", phone: "9765432109", items: 1, amount: 899, payment: "UPI", status: "pending", date: "29 Mar 2026" },
    { id: "FM-1024535", customer: "Kavitha R", phone: "9654321098", items: 4, amount: 1666, payment: "COD", status: "packed", date: "28 Mar 2026" },
    { id: "FM-1024536", customer: "Deepak Singh", phone: "9543210987", items: 2, amount: 798, payment: "UPI", status: "cancelled", date: "28 Mar 2026" },
    { id: "FM-1024537", customer: "Meena Iyer", phone: "9432109876", items: 1, amount: 449, payment: "Card", status: "delivered", date: "27 Mar 2026" },
    { id: "FM-1024538", customer: "Arjun Nair", phone: "9321098765", items: 3, amount: 2097, payment: "UPI", status: "shipped", date: "27 Mar 2026" },
    { id: "FM-1024539", customer: "Lakshmi Devi", phone: "9210987654", items: 2, amount: 688, payment: "COD", status: "confirmed", date: "26 Mar 2026" },
    { id: "FM-1024540", customer: "Vikram Joshi", phone: "9109876543", items: 1, amount: 799, payment: "Card", status: "pending", date: "26 Mar 2026" }
];

const categories = [
    { name: "Ghee & Oils", slug: "ghee-oils", count: 12 },
    { name: "Honey & Jaggery", slug: "honey-jaggery", count: 8 },
    { name: "Millets", slug: "millets", count: 15 },
    { name: "Spices", slug: "spices", count: 24 }
];

const customers = [
    { name: "Priya Sharma", email: "priya@example.com", phone: "9876543210", orders: 5, spent: 4500 },
    { name: "Ravi Kumar", email: "ravi@example.com", phone: "9812345678", orders: 2, spent: 1200 },
    { name: "Anita Patel", email: "anita@example.com", phone: "9988776655", orders: 8, spent: 8900 }
];

const coupons = [
    { code: "FARM10", type: "Percentage", val: "10%", min: 299, uses: 100, active: true },
    { code: "WELCOME50", type: "Flat", val: "₹50", min: 499, uses: 50, active: true },
    { code: "FREESHIP", type: "Shipping", val: "Free", min: 999, uses: 200, active: false }
];

// --- Navigation Logic ---
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    // Update Title
    const titles = {
        'dashboard': 'Dashboard', 'all-products': 'All Products', 'add-product': 'Add Product',
        'categories': 'Categories', 'inventory': 'Inventory', 'all-orders': 'All Orders',
        'customers': 'Customers', 'reports': 'Reports', 'coupons': 'Coupons',
        'banners': 'Banners', 'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titles[pageId] || 'Admin';

    // Active Menu State
    document.querySelectorAll('.nav-item, .sub-nav-item').forEach(el => el.classList.remove('active'));
    let targetEl = document.querySelector(`[data-page="${pageId}"]`);
    if(targetEl) {
        targetEl.classList.add('active');
        if(targetEl.classList.contains('sub-nav-item')) {
            targetEl.parentElement.previousElementSibling.classList.add('active');
        }
    }
    if(window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('show');
}

// Sidebar Navigation Setup
document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
        if(el.classList.contains('has-sub') && window.innerWidth > 768) return; // parent handles toggle
        if(el.dataset.page) navigateTo(el.dataset.page);
    });
});

function toggleSubMenu(el) {
    el.classList.toggle('open');
}

// --- Render Functions ---
function renderDashboard() {
    document.getElementById('dashboard-recent-orders').innerHTML = orders.slice(0,5).map(o => `
        <tr>
            <td>${o.id}</td><td>${o.customer}</td><td>${o.items}</td><td>₹${o.amount}</td>
            <td><span class="badge ${o.status}">${o.status}</span></td>
            <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="viewOrder('${o.id}')">View</button></td>
        </tr>
    `).join('');

    document.getElementById('dashboard-top-products').innerHTML = products.slice(0,4).map(p => `
        <tr>
            <td style="display:flex;align-items:center;gap:10px">
                <img src="${p.img}" class="product-img"> <span>${p.name}</span>
            </td>
            <td>${p.stock * 2} sold</td>
        </tr>
    `).join('');

    const lowStock = products.filter(p => p.stock > 0 && p.stock < 20);
    document.getElementById('dashboard-low-stock').innerHTML = lowStock.map(p => `
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding:5px 0">
            <span>${p.name}</span> <strong>${p.stock} left</strong>
        </div>
    `).join('');
}

function renderProducts() {
    document.getElementById('products-tbody').innerHTML = products.map(p => `
        <tr>
            <td><img src="${p.img}" class="product-img"></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.cat}</td>
            <td>₹${p.price}</td>
            <td>${p.stock}</td>
            <td>
                <label class="switch"><input type="checkbox" ${p.status ? 'checked' : ''} onchange="showToast('Status updated')"><span class="slider"></span></label>
            </td>
            <td>
                <button class="action-btn" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                <button class="action-btn" title="Delete" onclick="showToast('Deleted'); this.closest('tr').remove();"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderCategories() {
    document.getElementById('categories-tbody').innerHTML = categories.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.slug}</td>
            <td>${c.count}</td>
            <td>
                <button class="action-btn" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                <button class="action-btn" title="Delete"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderInventory() {
    document.getElementById('inventory-tbody').innerHTML = products.map(p => {
        let status = p.stock > 20 ? 'Good' : (p.stock > 0 ? 'Low' : 'Out');
        let colorClass = p.stock > 20 ? 'green' : (p.stock > 0 ? 'warning' : 'danger');
        return `
        <tr>
            <td>${p.name}</td><td>${p.cat}</td>
            <td><strong>${p.stock}</strong></td>
            <td><span class="badge" style="background:var(--${colorClass});color:white">${status}</span></td>
            <td style="display:flex;gap:5px">
                <input type="number" class="form-control" style="width:70px;padding:4px" value="${p.stock}">
                <button class="btn btn-outline" style="padding:4px 8px" onclick="showToast('Stock Updated')">Update</button>
            </td>
        </tr>
    `}).join('');
}

let currentOrderFilter = 'all';
function renderOrders(filterText = '') {
    let filtered = orders;
    if (currentOrderFilter !== 'all') {
        filtered = filtered.filter(o => o.status === currentOrderFilter);
    }
    if (filterText) {
        const lower = filterText.toLowerCase();
        filtered = filtered.filter(o => o.id.toLowerCase().includes(lower) || o.customer.toLowerCase().includes(lower));
    }

    document.getElementById('orders-tbody').innerHTML = filtered.map(o => `
        <tr>
            <td>${o.id}</td>
            <td><div><strong>${o.customer}</strong><br><small style="color:var(--text-muted)">${o.phone}</small></div></td>
            <td>₹${o.amount}</td>
            <td>${o.payment}</td>
            <td><span class="badge ${o.status}">${o.status}</span></td>
            <td>${o.date}</td>
            <td><button class="btn btn-outline" onclick="viewOrder('${o.id}')">View</button></td>
        </tr>
    `).join('');
}

function renderCustomers() {
    document.getElementById('customers-tbody').innerHTML = customers.map(c => `
        <tr>
            <td style="display:flex;align-items:center;gap:10px">
                <img src="https://ui-avatars.com/api/?name=${c.name}&background=random" class="customer-avatar">
                <strong>${c.name}</strong>
            </td>
            <td>${c.email}</td><td>${c.phone}</td>
            <td>${c.orders}</td><td>₹${c.spent}</td>
            <td><button class="btn btn-outline">View Orders</button></td>
        </tr>
    `).join('');
}

function renderCoupons() {
    document.getElementById('coupons-tbody').innerHTML = coupons.map(c => `
        <tr>
            <td><strong>${c.code}</strong></td>
            <td>${c.type}</td><td>${c.val}</td>
            <td>₹${c.min}</td><td>${c.uses}</td>
            <td>
                <label class="switch"><input type="checkbox" ${c.active ? 'checked' : ''}><span class="slider"></span></label>
            </td>
            <td><button class="action-btn" title="Delete"><i class="ph ph-trash"></i></button></td>
        </tr>
    `).join('');
}

function setupChart() {
    const chart = document.getElementById('sales-chart');
    const data = [12, 19, 8, 15, 22, 14, 25]; // heights in %
    chart.innerHTML = data.map(val => `
        <div class="bar" style="height: ${val * 3}%"><span>₹${val}k</span></div>
    `).join('');
}

// --- Utils & Interactions ---
function filterTable(tableId, text) {
    const lower = text.toLowerCase();
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(lower) ? '' : 'none';
    });
}

function filterOrders(text) {
    renderOrders(text);
}

// Order Tabs
document.querySelectorAll('#order-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#order-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentOrderFilter = tab.dataset.filter;
        renderOrders();
    });
});

// Sidebar Sub-nav acting as tabs for orders
document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const tabId = link.dataset.tab;
        const topTab = document.querySelector(`#order-tabs .tab[data-filter="${tabId}"]`);
        if(topTab) topTab.click();
    });
});

// Modals
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

let activeOrderId = null;
function viewOrder(id) {
    const o = orders.find(x => x.id === id);
    if(!o) return;
    activeOrderId = id;
    document.getElementById('om-title').innerText = `Order ${o.id}`;
    document.getElementById('om-customer').innerText = o.customer;
    document.getElementById('om-phone').innerText = o.phone;
    document.getElementById('om-date').innerText = o.date;
    document.getElementById('om-payment').innerText = o.payment;
    document.getElementById('om-amount').innerText = `₹${o.amount}`;
    document.getElementById('om-status-select').value = o.status;
    openModal('orderModal');
}

function updateOrderStatus() {
    const newStatus = document.getElementById('om-status-select').value;
    const o = orders.find(x => x.id === activeOrderId);
    if(o) {
        o.status = newStatus;
        renderDashboard();
        renderOrders();
        closeModal('orderModal');
        showToast(`Order status updated to ${newStatus}`);
    }
}

// Toasts
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="ph-fill ph-check-circle" style="color:var(--success-text);font-size:1.2rem;"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 300);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    renderProducts();
    renderCategories();
    renderInventory();
    renderOrders();
    renderCustomers();
    renderCoupons();
    setupChart();
});

// --- Auth Handling ---
function handleLogin() {
    document.body.classList.remove('show-login');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main-wrapper').style.display = 'flex';
    showToast('Login successful! Welcome Admin.');
}

function handleLogout() {
    document.body.classList.add('show-login');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-wrapper').style.display = 'none';
    showToast('Logged out successfully.');
}
