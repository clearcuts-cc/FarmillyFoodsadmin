// --- Supabase Setup ---
const supabaseUrl = 'https://jztreusepxilnfqffwka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dHJldXNlcHhpbG5mcWZmd2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA5OTUsImV4cCI6MjA5MDQ0Njk5NX0.AXaOi_ax6esifM7DzwVjNXQrm3XLNPnzT_0yQWm6ahY';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Global State ---
let allProducts = [];
let allCategories = [];
let allOrders = [];

// --- Navigation Logic ---
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard', 'all-products': 'All Products', 'add-product': 'Add Product',
        'categories': 'Categories', 'inventory': 'Inventory', 'all-orders': 'All Orders',
        'customers': 'Customers', 'reports': 'Reports', 'coupons': 'Coupons',
        'banners': 'Banners', 'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titles[pageId] || 'Admin';

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

document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
        if(el.classList.contains('has-sub') && window.innerWidth > 768) return; 
        if(el.dataset.page) navigateTo(el.dataset.page);
    });
});

function toggleSubMenu(el) { el.classList.toggle('open'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- UI Helpers ---
function showToast(msg, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeft = isError ? '4px solid #ef4444' : '4px solid var(--primary)';
    toast.innerHTML = isError ? 
        `<i class="ph-fill ph-warning-circle" style="color:#ef4444;font-size:1.2rem;"></i> <span>${msg}</span>` :
        `<i class="ph-fill ph-check-circle" style="color:var(--success-text);font-size:1.2rem;"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if(el) el.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;">Loading...</td></tr>`;
}

function showEmpty(elementId, msg = "No data found") {
    const el = document.getElementById(elementId);
    if(el) el.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:gray">${msg}</td></tr>`;
}

// --- Data Fetching & Rendering ---

async function renderDashboard() {
    showLoading('dashboard-recent-orders');
    showLoading('dashboard-top-products');
    
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Orders
        const { data: rawOrders, error: oErr } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
            
        if(oErr) throw oErr;
        
        // Profiles (to resolve names without hard join)
        const { data: rawProfiles, error: pErr } = await supabaseClient.from('profiles').select('*');
        // If profile fetch fails, we can still show orders
        const profilesMap = (rawProfiles || []).reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {});

        // Products
        const { data: products, error: prodErr } = await supabaseClient.from('products').select('*');
        if(prodErr) throw prodErr;

        // Stats Calc
        let todayOrders = 0;
        let todayRev = 0;
        let totalRevForAvg = 0;
        let pipeline = { pending: 0, packed: 0, shipped: 0, deliveredToday: 0 };
        
        const orders = (rawOrders || []).map(o => ({
            ...o,
            profile: profilesMap[o.user_id]
        }));

        orders.forEach(o => {
            const isToday = o.created_at && o.created_at.startsWith(todayStr);
            if(isToday) {
                todayOrders++;
                if(o.status === 'delivered') pipeline.deliveredToday++;
            }
            if(o.payment_status === 'paid' || o.payment_status === 'PAID') {
                totalRevForAvg += (o.total || 0);
                if(isToday) todayRev += (o.total || 0);
            }
            if(o.status === 'pending') pipeline.pending++;
            if(o.status === 'packed') pipeline.packed++;
            if(o.status === 'shipped') pipeline.shipped++;
        });
        
        const avgOrder = orders.length > 0 ? (totalRevForAvg / orders.length).toFixed(0) : 0;

        // Update Stat Cards via DOM traversal
        const statCardsTop = document.querySelectorAll('#page-dashboard .grid-cards:nth-of-type(1) .stat-value');
        if(statCardsTop.length >= 4) {
            statCardsTop[0].innerText = `₹${todayRev}`;
            statCardsTop[1].innerText = `₹${todayRev}`; // Using today for week to prevent breaking UI
            statCardsTop[2].innerText = todayOrders;
            statCardsTop[3].innerText = `₹${avgOrder}`;
        }

        const statCardsPipe = document.querySelectorAll('#page-dashboard .grid-cards:nth-of-type(2) .stat-value');
        if(statCardsPipe.length >= 4) {
            statCardsPipe[0].innerText = pipeline.pending;
            statCardsPipe[1].innerText = pipeline.packed;
            statCardsPipe[2].innerText = pipeline.shipped;
            statCardsPipe[3].innerText = pipeline.deliveredToday;
        }

        // Recent Orders Table
        if(orders.length === 0) showEmpty('dashboard-recent-orders');
        else {
            document.getElementById('dashboard-recent-orders').innerHTML = orders.slice(0,5).map(o => `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td>${o.profile?.full_name || 'Guest'}</td>
                    <td>-</td>
                    <td>₹${o.total}</td>
                    <td><span class="badge ${o.status}">${o.status}</span></td>
                    <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `).join('');
        }

        // Top Selling Products (dummy calc using stock)
        document.getElementById('dashboard-top-products').innerHTML = products.slice(0,4).map(p => `
            <tr>
                <td style="display:flex;align-items:center;gap:10px">
                    <img src="${p.image_url || 'https://placehold.co/50'}" class="product-img"> <span>${p.name}</span>
                </td>
                <td>${p.stock_count || 0} stock</td>
            </tr>
        `).join('');

        // Low stock
        const lowStock = products.filter(p => p.stock_count > 0 && p.stock_count < 20);
        document.getElementById('dashboard-low-stock').innerHTML = lowStock.map(p => `
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.05);padding:5px 0">
                <span>${p.name}</span> <strong>${p.stock_count} left</strong>
            </div>
        `).join('');

    } catch(err) {
        showToast("Error loading dashboard data: " + (err.message || err), true);
        console.error(err);
    }
}

async function renderReviews() {
    showLoading('reviews-tbody');
    try {
        const { data, error } = await supabaseClient.from('reviews').select(`*, products(name), profiles(full_name)`);
        if(error) throw error;
        if(data.length === 0) showEmpty('reviews-tbody');
        else {
            document.getElementById('reviews-tbody').innerHTML = data.map(r => `
                <tr>
                    <td><strong>${r.profiles?.full_name || 'Guest'}</strong></td>
                    <td>${r.products?.name || 'Deleted Product'}</td>
                    <td><span style="color:#f59e0b">★</span> ${r.rating}</td>
                    <td>${r.comment}</td>
                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    } catch(err) { showToast("Error loading reviews", true); }
}

async function renderProducts() {
    showLoading('products-tbody');
    try {
        const { data, error } = await supabaseClient.from('products').select(`*`);
        if(error) throw error;
        allProducts = data || [];
        
        if(data.length === 0) showEmpty('products-tbody');
        else buildProductsTable(data);
    } catch(err) {
        showToast("Error loading products", true);
    }
}

function buildProductsTable(products) {
    document.getElementById('products-tbody').innerHTML = products.map(p => {
        const cat = allCategories.find(c => c.id === p.category_id);
        return `
        <tr>
            <td><img src="${p.image_url || 'https://placehold.co/50'}" class="product-img"></td>
            <td><strong>${p.name}</strong></td>
            <td>${cat?.name || '-'}</td>
            <td>₹${p.price}</td>
            <td>${p.stock_count}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${p.in_stock ? 'checked' : ''} onchange="toggleProductStock('${p.id}', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <button class="action-btn" title="Edit" onclick="editProduct('${p.id}')"><i class="ph ph-pencil-simple"></i></button>
                <button class="action-btn" title="Delete" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `}).join('');
}

async function toggleProductStock(id, isStock) {
    const { error } = await supabaseClient.from('products').update({ in_stock: isStock }).eq('id', id);
    if(error) showToast("Error updating stock status", true);
    else {
        showToast("Status updated successfully ✅");
        renderProducts();
    }
}

async function deleteProduct(id) {
    if(!confirm("Are you sure you want to delete this product?")) return;
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if(error) showToast("Error deleting product", true);
    else {
        showToast("Product deleted successfully ✅");
        renderProducts();
    }
}

// Ensure category options are loaded when adding/editing
async function loadCategoryOptions() {
    const { data } = await supabaseClient.from('categories').select('*');
    if(data) {
        allCategories = data;
        // Wait, the HTML needs a select box for category. We'll populate it if it exists
        const selects = document.querySelectorAll('select[name="category_id"]');
        selects.forEach(s => {
            s.innerHTML = '<option value="">Select Category</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        });
    }
}

async function renderCategories() {
    showLoading('categories-tbody');
    try {
        const { data, error } = await supabaseClient.from('categories').select('*');
        if(error) throw error;
        if(data.length === 0) showEmpty('categories-tbody');
        else {
            document.getElementById('categories-tbody').innerHTML = data.map(c => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.slug}</td>
                    <td>-</td>
                    <td>
                        <button class="action-btn" title="Delete" onclick="deleteCategory('${c.id}')"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }
    } catch(err) {
        showToast("Error loading categories", true);
    }
}

async function deleteCategory(id) {
    if(!confirm("Are you sure?")) return;
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if(error) showToast("Error deleting category", true);
    else { showToast("Deleted successfully ✅"); renderCategories(); }
}

async function saveCategory() {
    const form = document.getElementById('category-form');
    const obj = {
        name: form.elements['name'].value,
        slug: form.elements['slug'].value,
        image_url: form.elements['image_url'].value
    };
    if(!obj.name || !obj.slug) { showToast("Name and Slug are required", true); return; }
    
    const { error } = await supabaseClient.from('categories').insert([obj]);
    if(error) showToast("Error saving category", true);
    else {
        showToast("Category added successfully ✅");
        closeModal('categoryModal');
        renderCategories();
        loadCategoryOptions();
    }
}

async function renderInventory() {
    showLoading('inventory-tbody');
    try {
        const { data: products, error: pErr } = await supabaseClient.from('products').select(`*`);
        const { data: categories, error: cErr } = await supabaseClient.from('categories').select('*');
        if(pErr) throw pErr;
        
        const catMap = (categories || []).reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {});

        if(products.length === 0) showEmpty('inventory-tbody');
        else {
            document.getElementById('inventory-tbody').innerHTML = products.map(p => {
                let count = p.stock_count || 0;
                let status = count > 20 ? 'Good' : (count > 0 ? 'Low' : 'Out');
                let colorClass = count > 20 ? 'green' : (count > 0 ? 'warning' : 'danger');
                return `
                <tr>
                    <td>${p.name}</td><td>${catMap[p.category_id] || ''}</td>
                    <td><strong>${count}</strong></td>
                    <td><span class="badge" style="background:var(--${colorClass});color:white">${status}</span></td>
                    <td style="display:flex;gap:5px">
                        <input type="number" class="form-control stock-input-${p.id}" style="width:70px;padding:4px" value="${count}">
                        <button class="btn btn-outline" style="padding:4px 8px" onclick="updateStock('${p.id}')">Update</button>
                    </td>
                </tr>
            `}).join('');
        }
    } catch(err) { showToast("Error loading inventory", true); }
}

async function updateStock(id) {
    const val = document.querySelector(`.stock-input-${id}`).value;
    const { error } = await supabaseClient.from('products').update({ stock_count: parseInt(val) }).eq('id', id);
    if(error) showToast("Error updating, try again", true);
    else { 
        showToast("Saved successfully ✅"); 
        renderInventory(); 
        renderDashboard(); // Update low stock alerts too
    }
}

async function renderOrders(filterText = '') {
    showLoading('orders-tbody');
    try {
        let query = supabaseClient.from('orders').select(`*`).order('created_at', { ascending: false });
        if(currentOrderFilter !== 'all') query = query.eq('status', currentOrderFilter);
        
        const { data: rawOrders, error } = await query;
        if(error) throw error;
        
        const { data: profiles } = await supabaseClient.from('profiles').select('*');
        const profilesMap = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

        allOrders = (rawOrders || []).map(o => ({ ...o, profile: profilesMap[o.user_id] }));
        
        let filtered = allOrders;
        if(filterText) {
            const lower = filterText.toLowerCase();
            filtered = filtered.filter(o => (o.order_number && o.order_number.toLowerCase().includes(lower)) || (o.profile?.full_name?.toLowerCase().includes(lower)));
        }

        if(filtered.length === 0) showEmpty('orders-tbody');
        else {
            document.getElementById('orders-tbody').innerHTML = filtered.map(o => `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td><div><strong>${o.profile?.full_name || 'Guest'}</strong><br><small style="color:var(--text-muted)">${o.profile?.phone || ''}</small></div></td>
                    <td>₹${o.total}</td>
                    <td>${o.payment_method || 'N/A'}</td>
                    <td><span class="badge ${o.status}">${o.status}</span></td>
                    <td>${o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                    <td><button class="btn btn-outline" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `).join('');
        }
    } catch(err) { showToast("Error loading orders data", true); }
}

async function renderCustomers() {
    showLoading('customers-tbody');
    try {
        // Load profiles
        const { data: profiles, error: pErr } = await supabaseClient.from('profiles').select('*');
        if(pErr) throw pErr;
        
        // Load Orders to sum
        const { data: orders, error: oErr } = await supabaseClient.from('orders').select('user_id, total');
        if(oErr) throw oErr;

        if(profiles.length === 0) showEmpty('customers-tbody');
        else {
            document.getElementById('customers-tbody').innerHTML = profiles.map(c => {
                const cOrders = orders.filter(o => o.user_id === c.id);
                const spent = cOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                return `
                <tr>
                    <td style="display:flex;align-items:center;gap:10px">
                        <img src="https://ui-avatars.com/api/?name=${c.full_name || 'User'}&background=random" class="customer-avatar">
                        <strong>${c.full_name || 'No Name'}</strong>
                    </td>
                    <td>${c.email || 'N/A'}</td><td>${c.phone || 'N/A'}</td>
                    <td>${cOrders.length}</td><td>₹${spent}</td>
                    <td><button class="btn btn-outline">View Orders</button></td>
                </tr>
            `}).join('');
        }
    } catch(err) { showToast("Error loading data", true); }
}

async function renderCoupons() {
    showLoading('coupons-tbody');
    try {
        const { data, error } = await supabaseClient.from('coupons').select('*');
        if(error) throw error;
        if(data.length === 0) showEmpty('coupons-tbody');
        else {
            document.getElementById('coupons-tbody').innerHTML = data.map(c => `
                <tr>
                    <td><strong>${c.code}</strong></td>
                    <td>${c.discount_type}</td><td>${c.discount_value}</td>
                    <td>₹${c.min_order_value}</td><td>${c.used_count}/${c.max_uses}</td>
                    <td>
                        <label class="switch"><input type="checkbox" ${c.active ? 'checked' : ''} onchange="toggleCoupon('${c.id}', this.checked)"><span class="slider"></span></label>
                    </td>
                    <td><button class="action-btn" title="Delete" onclick="deleteCoupon('${c.id}')"><i class="ph ph-trash"></i></button></td>
                </tr>
            `).join('');
        }
    } catch(err) { showToast("Error loading data", true); }
}

async function toggleCoupon(id, active) {
    const { error } = await supabaseClient.from('coupons').update({ active }).eq('id', id);
    if(error) showToast("Error updating, try again", true);
    else {
        showToast("Saved successfully ✅");
        renderCoupons();
    }
}

async function deleteCoupon(id) {
    if(!confirm("Are you sure?")) return;
    const { error } = await supabaseClient.from('coupons').delete().eq('id', id);
    if(error) showToast("Error deleting", true);
    else { showToast("Deleted successfully ✅"); renderCoupons(); }
}

async function saveCoupon() {
    const form = document.getElementById('coupon-form');
    const obj = {
        code: form.elements['code'].value.toUpperCase(),
        discount_type: form.elements['discount_type'].value,
        discount_value: parseFloat(form.elements['discount_value'].value),
        min_order_value: parseFloat(form.elements['min_order_value'].value || 0),
        active: true
    };
    if(!obj.code || !obj.discount_value) { showToast("Code and Value are required", true); return; }

    const { error } = await supabaseClient.from('coupons').insert([obj]);
    if(error) showToast("Error saving coupon", true);
    else {
        showToast("Coupon added successfully ✅");
        closeModal('couponModal');
        renderCoupons();
    }
}

// Banners (Using ID 'banners-tbody' wherever it's attached)
async function renderBanners() {
    const el = document.getElementById('banners-tbody');
    if(!el) return; // If page doesn't have tbody setup
    showLoading('banners-tbody');
    try {
        const { data, error } = await supabaseClient.from('banners').select('*').order('sort_order', { ascending: true });
        if(error) throw error;
        if(data.length === 0) showEmpty('banners-tbody');
        else {
            el.innerHTML = data.map(b => `
                <tr>
                    <td><img src="${b.image_url}" height="50"></td>
                    <td><strong>${b.title}</strong></td>
                    <td>${b.sort_order}</td>
                    <td><label class="switch"><input type="checkbox" ${b.active ? 'checked' : ''} onchange="toggleBanner('${b.id}', this.checked)"><span class="slider"></span></label></td>
                    <td><button class="action-btn" title="Delete" onclick="deleteBanner('${b.id}')"><i class="ph ph-trash"></i></button></td>
                </tr>
            `).join('');
        }
    } catch(err) { showToast("Error loading data", true); }
}

async function toggleBanner(id, active) {
    await supabaseClient.from('banners').update({ active }).eq('id', id);
    showToast("Saved successfully ✅");
    renderBanners();
}
async function deleteBanner(id) {
    if(!confirm("Are you sure?")) return;
    await supabaseClient.from('banners').delete().eq('id', id);
    showToast("Deleted successfully ✅");
    renderBanners();
}

async function saveBanner() {
    const form = document.getElementById('banner-form');
    const obj = {
        title: form.elements['title'].value,
        subtitle: form.elements['subtitle'].value,
        image_url: form.elements['image_url'].value,
        sort_order: parseInt(form.elements['sort_order'].value || 1),
        active: true
    };
    if(!obj.title || !obj.image_url) { showToast("Title and Image URL are required", true); return; }

    const { error } = await supabaseClient.from('banners').insert([obj]);
    if(error) showToast("Error saving banner", true);
    else {
        showToast("Banner added successfully ✅");
        closeModal('bannerModal');
        renderBanners();
    }
}


// --- Utils & Interactions ---
function filterTable(tableId, text) {
    if (tableId === 'products') {
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(text.toLowerCase()) || (p.categories?.name || '').toLowerCase().includes(text.toLowerCase()));
        buildProductsTable(filtered);
    }
}

function filterOrdersHandler(event) {
    renderOrders(event.target.value);
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

document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const tabId = link.dataset.tab;
        const topTab = document.querySelector(`#order-tabs .tab[data-filter="${tabId}"]`);
        if(topTab) topTab.click();
    });
});

let activeOrderId = null;
async function viewOrder(id) {
    const o = allOrders.find(x => x.id === id);
    if(!o) return;
    activeOrderId = id;
    document.getElementById('om-title').innerText = `Order ${o.order_number || o.id.toString().substring(0,8)}`;
    document.getElementById('om-customer').innerText = o.profiles?.full_name || 'Guest';
    document.getElementById('om-phone').innerText = o.profiles?.phone || '-';
    document.getElementById('om-date').innerText = new Date(o.created_at).toLocaleString();
    document.getElementById('om-payment').innerText = o.payment_method || 'N/A';
    document.getElementById('om-amount').innerText = `₹${o.total}`;
    document.getElementById('om-status-select').value = o.status;
    
    // Attempt to load order items if the view supports it:
    const itemsContainer = document.getElementById('om-items');
    if(itemsContainer) {
        itemsContainer.innerHTML = 'Loading items...';
        const { data: items } = await supabaseClient.from('order_items').select('*').eq('order_id', id);
        if(items) {
            itemsContainer.innerHTML = items.map(i => `<div>${i.quantity}x ${i.product_name} - ₹${i.total_price}</div>`).join('');
        }
    }

    openModal('orderModal');
}

async function updateOrderStatus() {
    const newStatus = document.getElementById('om-status-select').value;
    const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', activeOrderId);
    if(error) showToast("Error saving, try again", true);
    else {
        showToast("Saved successfully ✅");
        renderOrders();
        renderDashboard();
        closeModal('orderModal');
    }
}

function setupChart() {
    const chart = document.getElementById('sales-chart');
    if(!chart) return;
    const data = [12, 19, 8, 15, 22, 14, 25]; // heights in %
    chart.innerHTML = data.map(val => `
        <div class="bar" style="height: ${val * 3}%"><span>₹${val}k</span></div>
    `).join('');
}

// --- Add/Edit Product Logic ---
let editingProductId = null;
function editProduct(id) {
    const p = allProducts.find(x => x.id === id);
    if(!p) return;
    editingProductId = id;
    
    navigateTo('add-product');
    
    const form = document.getElementById('product-form');
    if(!form) return;
    
    form.elements['name'].value = p.name || '';
    form.elements['category_id'].value = p.category_id || '';
    form.elements['slug'].value = p.slug || '';
    form.elements['description'].value = p.description || '';
    form.elements['image_url'].value = p.image_url || '';
    form.elements['price'].value = p.price || '';
    form.elements['original_price'].value = p.original_price || '';
    form.elements['stock_count'].value = p.stock_count || 0;
    form.elements['weight'].value = p.weight || '';
    form.elements['in_stock'].checked = p.in_stock;

    document.getElementById('img-preview').src = p.image_url || 'https://placehold.co/100';
    document.getElementById('pm-title').innerText = "Edit Product: " + p.name;
    document.getElementById('save-product-btn').innerText = "Update Product";
}

async function saveProduct(event) {
    event.preventDefault();
    const form = document.getElementById('product-form');
    
    const obj = {
        name: form.elements['name'].value,
        category_id: form.elements['category_id'].value,
        slug: form.elements['slug'].value,
        description: form.elements['description'].value,
        image_url: form.elements['image_url'].value,
        price: parseFloat(form.elements['price'].value),
        original_price: parseFloat(form.elements['original_price'].value || 0),
        stock_count: parseInt(form.elements['stock_count'].value),
        weight: form.elements['weight'].value,
        in_stock: form.elements['in_stock'].checked
    };

    let result;
    if(editingProductId) {
        result = await supabaseClient.from('products').update(obj).eq('id', editingProductId);
    } else {
        result = await supabaseClient.from('products').insert([obj]);
    }

    if(result.error) {
        showToast("Error saving product: " + result.error.message, true);
    } else {
        showToast("Product saved successfully ✅");
        editingProductId = null;
        form.reset();
        document.getElementById('img-preview').src = 'https://placehold.co/100';
        navigateTo('all-products');
        renderProducts();
        renderInventory();
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadCategoryOptions();
    renderDashboard();
    renderProducts();
    renderCategories();
    renderInventory();
    renderOrders();
    renderCustomers();
    renderCoupons();
    renderReviews();
    renderBanners();
    setupChart();
});

// --- Auth Handling ---
function runAuthCheck() {
    if(localStorage.getItem('admin_logged_in') === 'true') {
        const body = document.body;
        const loginScreen = document.getElementById('login-screen');
        const sidebar = document.getElementById('sidebar');
        const mainWrapper = document.getElementById('main-wrapper');
        
        if (body && loginScreen && sidebar && mainWrapper) {
            body.classList.remove('show-login');
            loginScreen.style.display = 'none';
            sidebar.style.display = 'flex';
            mainWrapper.style.display = 'flex';
        }
    }
}
runAuthCheck(); // Run instantly when file is parsed.

function handleLogin() {
    localStorage.setItem('admin_logged_in', 'true');
    document.body.classList.remove('show-login');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main-wrapper').style.display = 'flex';
    showToast('Login successful! Welcome Admin.');
}

function handleLogout() {
    localStorage.removeItem('admin_logged_in');
    document.body.classList.add('show-login');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-wrapper').style.display = 'none';
    showToast('Logged out successfully.');
}
