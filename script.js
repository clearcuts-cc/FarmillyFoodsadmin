// --- Supabase Setup ---
const supabaseUrl = 'https://jztreusepxilnfqffwka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dHJldXNlcHhpbG5mcWZmd2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA5OTUsImV4cCI6MjA5MDQ0Njk5NX0.AXaOi_ax6esifM7DzwVjNXQrm3XLNPnzT_0yQWm6ahY';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Global State ---
let allProducts = [];
let allCategories = [];
let allOrders = [];
let currentOrderFilter = 'all';

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
    if(window.innerWidth <= 1024) document.getElementById('sidebar').classList.remove('show');
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
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ph-check-circle';
    if(type === 'error') icon = 'ph-warning-circle';
    if(type === 'warning') icon = 'ph-warning';

    toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirm(title, msg, btnText = "Continue", btnColor = "var(--primary)") {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-msg');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const iconWrapper = modal.querySelector('.confirm-icon-wrapper');

        titleEl.innerText = title;
        msgEl.innerText = msg;
        okBtn.innerText = btnText;
        okBtn.style.background = btnColor;
        
        // Dynamic icon color based on button color
        if(btnColor === '#ef4444' || btnColor === 'red') {
            iconWrapper.style.color = '#ef4444';
            iconWrapper.style.background = '#fee2e2';
        } else {
            iconWrapper.style.color = '#f59e0b';
            iconWrapper.style.background = '#fff7ed';
        }

        const onOk = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(true);
        };
        const onCancel = () => {
            modal.classList.remove('active');
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.classList.add('active');
    });
}

function showLoading(elementId) {
    const el = document.getElementById(elementId);
    if(el) {
        el.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px">
            <div class="spinner"></div>
        </td></tr>`;
    }
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
        
        allOrders = (rawOrders || []).map(o => ({
            ...o,
            profile: profilesMap[o.user_id]
        }));
        const orders = allOrders;

        orders.forEach(o => {
            const status = (o.status || '').toLowerCase();
            const isToday = o.created_at && o.created_at.startsWith(todayStr);
            
            if(isToday) {
                todayOrders++;
                if(status === 'delivered') pipeline.deliveredToday++;
            }

            if((o.payment_status || '').toLowerCase() === 'paid') {
                totalRevForAvg += (o.total || 0);
                if(isToday) todayRev += (o.total || 0);
            }

            // Map statuses to pipeline categories
            if(status === 'pending' || status === 'confirmed') pipeline.pending++;
            if(status === 'packed') pipeline.packed++;
            if(status === 'shipped' || status === 'out-for-delivery') pipeline.shipped++;
        });
        
        const avgOrder = orders.length > 0 ? (totalRevForAvg / orders.length).toFixed(0) : 0;

        // Update Stat Cards via DOM traversal
        const statCardsTop = document.querySelectorAll('#page-dashboard .grid-cards:nth-of-type(1) .stat-value');
        if(statCardsTop.length >= 4) {
            statCardsTop[0].innerText = `₹${todayRev.toLocaleString()}`;
            statCardsTop[1].innerText = `₹${totalRevForAvg.toLocaleString()}`; // Show actual total for week/total
            statCardsTop[2].innerText = todayOrders;
            statCardsTop[3].innerText = `₹${avgOrder.toLocaleString()}`;
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
                    <td>₹${(o.total || 0).toLocaleString()}</td>
                    <td><span class="badge ${o.status}">${o.status}</span></td>
                    <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `).join('');
        }

        // Top Selling Products (dummy calc using stock)
        const fallbacks = [
            'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=100', // Honey
            'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=100', // Ghee
            'https://images.unsplash.com/photo-1615485290382-441e4d019cb5?auto=format&fit=crop&q=80&w=100', // Turmeric
            'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=100'  // Millets
        ];
        
        document.getElementById('dashboard-top-products').innerHTML = products.slice(0,4).map((p, idx) => `
            <tr>
                <td style="display:flex;align-items:center;gap:10px">
                    <img src="${p.image_url || fallbacks[idx % 4]}" class="product-img"> <span>${p.name}</span>
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
        showToast("Error loading dashboard data: " + (err.message || err), 'error');
        console.error(err);
    }
}

async function renderReports() {
    setupChart();
    renderProductReport();
    renderCODReport();
}

function switchReport(type) {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.report-section').forEach(s => s.style.display = 'none');
    
    document.querySelector(`[onclick="switchReport('${type}')"]`).classList.add('active');
    document.getElementById(`report-${type}`).style.display = 'block';
}

async function renderProductReport() {
    const el = document.getElementById('product-report-tbody');
    if(!el) return;
    showLoading('product-report-tbody');
    try {
        const { data: items, error } = await supabaseClient.from('order_items').select('*');
        if(error) throw error;
        
        const summary = (items || []).reduce((acc, item) => {
            const name = item.product_name;
            if(!acc[name]) acc[name] = { sales: 0, revenue: 0 };
            acc[name].sales += (item.quantity || 0);
            acc[name].revenue += (parseFloat(item.total_price) || 0);
            return acc;
        }, {});

        const sorted = Object.entries(summary).sort((a,b) => b[1].revenue - a[1].revenue);
        
        if(sorted.length === 0) showEmpty('product-report-tbody');
        else {
            el.innerHTML = sorted.map(([name, vals]) => `
                <tr>
                    <td><strong>${name}</strong></td>
                    <td>Organic</td>
                    <td>${vals.sales} Units</td>
                    <td>₹${vals.revenue.toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch(err) { console.error(err); }
}

async function renderCODReport() {
    const el = document.getElementById('cod-report-tbody');
    if(!el) return;
    showLoading('cod-report-tbody');
    
    try {
        const { data: rawOrders, error } = await supabaseClient.from('orders')
            .select(`*`)
            .ilike('payment_method', 'cod')
            .order('created_at', { ascending: false });

        if(error) throw error;
        
        // Map addresses and profiles to COD orders
        const { data: profiles } = await supabaseClient.from('profiles').select('*');
        const profilesMap = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
        const { data: addresses } = await supabaseClient.from('addresses').select('*');
        const addrMap = (addresses || []).reduce((acc, a) => { acc[a.id] = a; return acc; }, {});

        const codOrders = (rawOrders || []).map(o => {
            const addr = addrMap[o.address_id];
            return {
                ...o,
                profile: profilesMap[o.user_id],
                address: addr,
                display_name: profilesMap[o.user_id]?.full_name || addr?.full_name || 'Guest'
            };
        });

        if(!codOrders || codOrders.length === 0) showEmpty('cod-report-tbody');
        else {
            el.innerHTML = codOrders.map(o => `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td><span class="status-badge status-${o.status}">${o.status}</span></td>
                    <td>₹${(o.total || 0).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch(err) { console.error(err); }
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
                    <td><strong>${r.profiles?.full_name || r.customer_name || 'Guest'}</strong></td>
                    <td>${r.products?.name || 'Deleted Product'}</td>
                    <td><span style="color:#f59e0b">★</span> ${r.rating}</td>
                    <td>${r.comment}</td>
                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                        <div style="display:flex;gap:5px">
                            <button class="action-btn" title="Edit" onclick="editReview('${r.id}')"><i class="ph ph-note-pencil"></i></button>
                            <button class="action-btn btn-delete" title="Delete" onclick="deleteReview('${r.id}')"><i class="ph ph-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch(err) { 
        showToast("Error loading reviews: " + (err.message || err), 'error'); 
        console.error(err);
    }
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
        showToast("Error loading products: " + (err.message || err), 'error');
        console.error(err);
    }
}

function buildProductsTable(products) {
    document.getElementById('products-tbody').innerHTML = products.map(p => {
        const cat = allCategories.find(c => c.id === p.category_id);
        return `
        <tr>
            <td><img src="${p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=100'}" class="product-img"></td>
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
                <button class="action-btn btn-delete" title="Delete" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
            </td>
        </tr>
    `}).join('');
}

async function toggleProductStock(id, isStock) {
    const { error } = await supabaseClient.from('products').update({ in_stock: isStock }).eq('id', id);
    if(error) showToast("Error updating stock status", 'error');
    else {
        showToast("Status updated successfully ✅");
        renderProducts();
    }
}

async function deleteProduct(id) {
    if(!await showConfirm("Delete Product?", "Are you sure you want to permanently delete this product? All reviews linked to it will also be affected.", "Delete", "#ef4444")) return;
    
    try {
        const { error } = await supabaseClient.from('products').delete().eq('id', id);
        if(error) {
            console.error("Delete product error:", error);
            if(error.code === '23503') {
                showToast("Cannot delete: This product has existing orders. Try hiding it from stock instead.", 'warning');
            } else {
                showToast("Error deleting product: " + error.message, 'error');
            }
        } else {
            showToast("Product deleted successfully ✅");
            renderProducts();
        }
    } catch (e) {
        showToast("Unexpected error during deletion", 'error');
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

async function toggleCategoryStatus(id, active) {
    const { error } = await supabaseClient.from('categories').update({ active }).eq('id', id);
    if(error) showToast("Error updating category status", 'error');
    else {
        showToast("Category status updated successfully ✅");
        renderCategories();
    }
}

async function renderCategories() {
    showLoading('categories-tbody');
    try {
        const { data: categories, error: catError } = await supabaseClient.from('categories').select('*');
        const { data: products, error: prodError } = await supabaseClient.from('products').select('id, category_id');
        
        if(catError) throw catError;
        allCategories = categories || [];
        
        // Calculate counts
        const counts = (products || []).reduce((acc, p) => {
            acc[p.category_id] = (acc[p.category_id] || 0) + 1;
            return acc;
        }, {});

        if(categories.length === 0) showEmpty('categories-tbody');
        else {
            document.getElementById('categories-tbody').innerHTML = categories.map(c => {
                const pCount = counts[c.id] || 0;
                return `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.slug}</td>
                    <td><span class="badge ${pCount > 0 ? 'info' : ''}" style="text-transform:none"> ${pCount} Products</span></td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" ${c.active ? 'checked' : ''} onchange="toggleCategoryStatus('${c.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td>
                        <div style="display:flex; gap:8px">
                            <button class="action-btn btn-delete" title="Delete" onclick="deleteCategory('${c.id}', ${pCount})"><i class="ph ph-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
    } catch(err) {
        showToast("Error loading categories: " + (err.message || err), 'error');
        console.error(err);
    }
}

async function deleteCategory(id, pCount = 0) {
    let confirmTitle = "Delete Category?";
    let confirmMsg = "Are you sure you want to delete this category? This cannot be undone.";
    
    if(pCount > 0) {
        confirmTitle = "Delete Category & Products?";
        confirmMsg = `This category contains ${pCount} products. Deleting it will also PERMANENTLY remove all those products. Continue?`;
    }

    if(!await showConfirm(confirmTitle, confirmMsg, "Delete All", "#ef4444")) return;
    
    try {
        // If there are products, try deleting them first
        if(pCount > 0) {
            const { error: pErr } = await supabaseClient.from('products').delete().eq('category_id', id);
            if(pErr) {
                if(pErr.code === '23503') {
                    showToast("Cannot delete: Some products in this category have existing orders and cannot be removed.", 'error');
                    return;
                }
                throw pErr;
            }
        }

        const { error } = await supabaseClient.from('categories').delete().eq('id', id);
        if(error) throw error;

        showToast("Category and related products deleted successfully ✅"); 
        renderCategories(); 
        loadCategoryOptions();
    } catch (err) {
        showToast("Error during deletion: " + err.message, 'error');
        console.error(err);
    }
}

async function saveCategory() {
    const form = document.getElementById('category-form');
    const obj = {
        name: form.elements['name'].value,
        slug: form.elements['slug'].value,
        image_url: document.getElementById('cat-image-url').value
    };
    if(!obj.name || !obj.slug) { showToast("Name and Slug are required", true); return; }
    
    const { error } = await supabaseClient.from('categories').insert([obj]);
    if(error) showToast("Error saving category", 'error');
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
    } catch(err) { 
        showToast("Error loading inventory: " + (err.message || err), 'error'); 
        console.error(err);
    }
}

async function updateStock(id) {
    const val = document.querySelector(`.stock-input-${id}`).value;
    const { error } = await supabaseClient.from('products').update({ stock_count: parseInt(val) }).eq('id', id);
    if(error) showToast("Error updating, try again", 'error');
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
        if(currentOrderFilter !== 'all') query = query.ilike('status', currentOrderFilter);
        
        const { data: rawOrders, error } = await query;
        if(error) throw error;
        
        // Fetch Addresses to handle Guest Checkouts
        const { data: rawAddresses } = await supabaseClient.from('addresses').select('*');
        const addrMap = (rawAddresses || []).reduce((acc, a) => { acc[a.id] = a; return acc; }, {});

        const { data: profiles } = await supabaseClient.from('profiles').select('*');
        const profilesMap = (profiles || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

        allOrders = (rawOrders || []).map(o => {
            const addr = addrMap[o.address_id];
            return {
                ...o,
                profile: profilesMap[o.user_id],
                address: addr,
                display_name: o.profile?.full_name || addr?.full_name || 'Guest'
            };
        });
        
        let filtered = allOrders;
        if(filterText && typeof filterText === 'string') {
            const lower = filterText.toLowerCase();
            filtered = filtered.filter(o => (o.order_number && o.order_number.toLowerCase().includes(lower)) || (o.profile?.full_name?.toLowerCase().includes(lower)));
        }

        if(filtered.length === 0) showEmpty('orders-tbody');
        else {
            document.getElementById('orders-tbody').innerHTML = filtered.map(o => `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td>₹${o.total}</td>
                    <td>${o.payment_method || 'N/A'}</td>
                    <td><span class="badge ${(o.status || '').toLowerCase()}">${o.status}</span></td>
                    <td>${o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
                    <td><button class="btn btn-outline" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `).join('');
        }
    } catch(err) { 
        showToast("Error loading orders data: " + (err.message || err), 'error'); 
        console.error(err);
    }
}

async function renderCustomers() {
    const el = document.getElementById('customers-tbody');
    if(!el) return;
    showLoading('customers-tbody');
    try {
        const { data: profiles } = await supabaseClient.from('profiles').select('*');
        const { data: addresses } = await supabaseClient.from('addresses').select('*');
        const { data: orders } = await supabaseClient.from('orders').select('user_id, total');

        // Combine unique customers by phone (Registered + Guest)
        const customersMap = {};

        (profiles || []).forEach(p => {
            if(!p.phone) return;
            const cOrders = (orders || []).filter(o => o.user_id === p.id);
            const spent = cOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
            customersMap[p.phone] = { 
                name: p.full_name, 
                phone: p.phone, 
                email: p.email, 
                spent, 
                count: cOrders.length,
                type: 'Registered' 
            };
        });

        (addresses || []).forEach(a => {
            if(!a.phone || customersMap[a.phone]) return;
            // For guests, we don't have a user_id to link orders easily, 
            // but we could match by phone if we wanted to be thorough.
            customersMap[a.phone] = { 
                name: a.full_name, 
                phone: a.phone, 
                email: 'Guest', 
                spent: 0, 
                count: 0, 
                type: 'Guest' 
            };
        });

        const data = Object.values(customersMap);

        if(data.length === 0) {
            showEmpty('customers-tbody');
        } else {
            el.innerHTML = data.map(c => `
                <tr>
                    <td style="display:flex;align-items:center;gap:10px">
                        <img src="https://ui-avatars.com/api/?name=${c.name || 'User'}&background=random" class="customer-avatar">
                        <strong>${c.name || 'Anonymous'}</strong>
                    </td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.email || '-'}</td>
                    <td><span class="badge ${c.type === 'Guest' ? 'gray' : 'green'}">${c.type}</span></td>
                    <td>${c.count}</td>
                    <td>₹${(c.spent || 0).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch(err) { 
        showToast("Error loading customers data: " + (err.message || err), 'error'); 
        console.error(err);
    }
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
    } catch(err) { 
        showToast("Error loading coupons data: " + (err.message || err), 'error'); 
        console.error(err);
    }
}

async function toggleCoupon(id, active) {
    const { error } = await supabaseClient.from('coupons').update({ active }).eq('id', id);
    if(error) showToast("Error updating, try again", 'error');
    else {
        showToast("Saved successfully ✅");
        renderCoupons();
    }
}

async function deleteCoupon(id) {
    if(!await showConfirm("Delete Coupon?", "Are you sure you want to delete this coupon code?", "Delete", "#ef4444")) return;
    const { error } = await supabaseClient.from('coupons').delete().eq('id', id);
    if(error) showToast("Error deleting: " + error.message, 'error');
    else { showToast("Coupon removed successfully ✅"); renderCoupons(); }
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
    if(!obj.code || !obj.discount_value) { showToast("Code and Value are required", 'warning'); return; }

    const { error } = await supabaseClient.from('coupons').insert([obj]);
    if(error) showToast("Error saving coupon", 'error');
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
    } catch(err) { 
        showToast("Error loading banners data: " + (err.message || err), 'error'); 
        console.error(err);
    }
}

async function toggleBanner(id, active) {
    await supabaseClient.from('banners').update({ active }).eq('id', id);
    showToast("Saved successfully ✅");
    renderBanners();
}
async function deleteBanner(id) {
    if(!await showConfirm("Delete Banner?", "Delete this promotional banner?", "Delete", "#ef4444")) return;
    const { error } = await supabaseClient.from('banners').delete().eq('id', id);
    if(error) showToast("Error deleting: " + error.message, 'error');
    else {
        showToast("Banner deleted successfully ✅");
        renderBanners();
    }
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
    if(!obj.title || !obj.image_url) { showToast("Title and Image URL are required", 'warning'); return; }

    const { error } = await supabaseClient.from('banners').insert([obj]);
    if(error) showToast("Error saving banner", 'error');
    else {
        showToast("Banner added successfully ✅");
        closeModal('bannerModal');
        renderBanners();
    }
}


// --- Utils & Interactions ---
function filterTable(tableId, text) {
    if (tableId === 'products-table') { // Match the ID used in index.html
        const filtered = allProducts.filter(p => {
            const cat = allCategories.find(c => c.id === p.category_id);
            const lower = text.toLowerCase();
            return p.name.toLowerCase().includes(lower) || (cat?.name || '').toLowerCase().includes(lower);
        });
        buildProductsTable(filtered);
    }
}

function filterOrders(text) {
    renderOrders(text);
}

async function searchByOrderId(id) {
    if(!id) return;
    id = id.trim();
    showToast(`Searching for ${id}...`, 'info');
    
    // First check local
    const localMatch = allOrders.find(o => (o.order_number && o.order_number === id) || o.id == id);
    if(localMatch) {
        viewOrder(localMatch.id);
        return;
    }

    // Direct Supabase Query
    try {
        let query = supabaseClient.from('orders').select('*');
        
        // If it's a number, search both. If string, search order_number only.
        if(!isNaN(id) && !id.includes('-')) {
            query = query.or(`id.eq.${id},order_number.eq.${id}`);
        } else {
            query = query.eq('order_number', id);
        }

        const { data, error } = await query.maybeSingle();

        if(error) throw error;
        if(!data) {
            showToast("Order ID not found in database", 'warning');
            return;
        }

        viewOrder(data.id);
    } catch(err) {
        console.error("Search error:", err);
        showToast("Error searching for order", 'error');
    }
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
    let o = allOrders.find(x => x.id == id);
    
    if(!o) {
        // Fetch from Supabase if not in local cache
        const { data, error } = await supabaseClient.from('orders').select('*').eq('id', id).single();
        if(error || !data) {
            // Try searching by order_number if id fails (human readable search)
            const { data: byNum, error: errNum } = await supabaseClient.from('orders').select('*').eq('order_number', id).single();
            if(errNum || !byNum) {
                showToast("Order not found", 'error');
                return;
            }
            o = byNum;
        } else {
            o = data;
        }
        
        // Resolve profile/address if missing
        if(!o.profile && o.user_id) {
            const { data: p } = await supabaseClient.from('profiles').select('*').eq('id', o.user_id).single();
            o.profile = p;
        }
        if(!o.address && o.address_id) {
            const { data: a } = await supabaseClient.from('addresses').select('*').eq('id', o.address_id).single();
            o.address = a;
        }
        o.display_name = o.profile?.full_name || o.address?.full_name || 'Guest';
    }
    activeOrderId = id;
    document.getElementById('om-title').innerText = `Order ${o.order_number || o.id.toString().substring(0,8)}`;
    document.getElementById('om-customer').innerText = o.display_name;
    document.getElementById('om-phone').innerText = o.profile?.phone || o.address?.phone || '-';
    
    // Show Full Shipping Address
    const addrDiv = document.getElementById('om-full-address');
    if(addrDiv) {
        if(o.address) {
            addrDiv.innerHTML = `
                ${o.address.address_line}<br>
                ${o.address.city}, ${o.address.state} - ${o.address.pincode}
            `;
        } else {
            addrDiv.innerText = 'No shipping address found';
        }
    }

    // Show Razorpay Details if available
    const rpDiv = document.getElementById('om-razorpay');
    if(rpDiv) {
        const { data: payments } = await supabaseClient.from('payments').select('*').eq('order_id', id).limit(1);
        const p = payments?.[0];
        if(p && p.razorpay_order_id) {
            rpDiv.innerHTML = `
                <div style="font-size:0.8rem; margin-top:10px; padding:10px; background:#eff6ff; border-radius:8px">
                    <div><strong>RP Order:</strong> ${p.razorpay_order_id}</div>
                    <div><strong>RP Payment:</strong> ${p.razorpay_payment_id || 'Pending'}</div>
                </div>
            `;
        } else {
            rpDiv.innerHTML = '';
        }
    }
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
            itemsContainer.innerHTML = items.map(i => `
                <div style="display:flex; align-items:center; gap:12px; padding:8px; background:white; border-radius:10px; border:1px solid var(--border-color)">
                    <img src="${i.product_image || 'https://placehold.co/50'}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                    <div style="flex:1">
                        <div style="font-weight:600; color:var(--text-main)">${i.product_name}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted)">${i.quantity} x ₹${i.unit_price}</div>
                    </div>
                    <div style="font-weight:700; color:var(--primary)">₹${i.total_price}</div>
                </div>
            `).join('');
        }
    }

    openModal('orderModal');
}

async function updateOrderStatus() {
    const newStatus = document.getElementById('om-status-select').value;
    const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', activeOrderId);
    if(error) showToast("Error saving, try again", 'error');
    else {
        showToast("Saved successfully ✅");
        renderOrders();
        renderDashboard();
        closeModal('orderModal');
    }
}

function setupChart() {
    const chart = document.getElementById('salesChart');
    if(!chart) return;
    
    // Calculate last 7 days sales from real orders
    const dayTotals = new Array(7).fill(0);
    const dayNames = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        d.setHours(0,0,0,0);
        
        const dayStr = d.toLocaleDateString('en-IN', { weekday: 'short' });
        dayNames.push(dayStr);
        
        // Sum orders for this day (exclude cancelled)
        const daySum = allOrders.reduce((sum, order) => {
            const orderDate = new Date(order.created_at);
            orderDate.setHours(0,0,0,0);
            if (orderDate.getTime() === d.getTime() && order.status !== 'cancelled') {
                return sum + (parseFloat(order.total) || 0);
            }
            return sum;
        }, 0);
        
        dayTotals[6-i] = daySum;
    }

    const maxVal = Math.max(...dayTotals, 1000); // at least 1k for scale
    
    chart.innerHTML = dayTotals.map((val, i) => {
        const height = (val / maxVal) * 80; // max 80% height
        const displayVal = val >= 1000 ? (val/1000).toFixed(1) + 'k' : val;
        return `
            <div class="bar" style="height: ${height + 10}%">
                <span>₹${displayVal}</span>
                <small style="position:absolute; bottom:-25px; font-size:10px; color:var(--text-muted); width:100%; text-align:center">${dayNames[i]}</small>
            </div>
        `;
    }).join('');
}

// --- Add/Edit Product Logic ---
let editingProductId = null;

function resetProductForm() {
    editingProductId = null;
    const form = document.getElementById('product-form');
    if(form) form.reset();
    const preview = document.getElementById('img-preview');
    if(preview) preview.src = 'https://placehold.co/100';
    const title = document.getElementById('pm-title');
    if(title) title.innerText = 'Add New Product';
    const btn = document.getElementById('save-product-btn');
    if(btn) btn.innerText = 'Save Product';
}

async function editProduct(id) {
    const p = allProducts.find(x => x.id == id);
    if(!p) { showToast('Product not found. Please refresh the page.', 'error'); return; }
    editingProductId = id;

    navigateTo('add-product');

    const form = document.getElementById('product-form');
    if(!form) return;

    // Ensure categories are loaded into the dropdown BEFORE setting value
    await loadCategoryOptions();

    form.elements['name'].value = p.name || '';
    form.elements['slug'].value = p.slug || '';
    form.elements['description'].value = p.description || '';
    form.elements['image_url'].value = p.image_url || '';
    form.elements['price'].value = p.price || '';
    form.elements['original_price'].value = p.original_price || '';
    form.elements['stock_count'].value = p.stock_count || 0;
    form.elements['weight'].value = p.weight || '';
    form.elements['in_stock'].checked = !!p.in_stock;

    // Set category after options are populated
    form.elements['category_id'].value = p.category_id || '';

    const preview = document.getElementById('img-preview');
    if(preview) preview.src = p.image_url || 'https://placehold.co/100';

    document.getElementById('pm-title').innerText = 'Edit Product: ' + p.name;
    document.getElementById('save-product-btn').innerText = 'Update Product';
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
        showToast("Error saving product: " + result.error.message, 'error');
    } else {
        showToast("Product saved successfully ✅");
        resetProductForm();
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
    renderProductReport();
    renderCODReport();
    
    // Check for order_id in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('order_id');
    if(orderIdParam) {
        setTimeout(() => searchByOrderId(orderIdParam), 1500); // Small delay to let admin auth/load finish
    }
    
    // --- Realtime Order Subscription ---
    supabaseClient
        .channel('order-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            console.log('New order detected:', payload.new);
            showToast('New Order Received! 🚀', 'success');
            
            // Refresh counts and views
            renderDashboard();
            renderOrders();
            renderCODReport();
        })
        .subscribe();

    const pnInput = document.getElementById('product-name-input');
    if(pnInput) {
        pnInput.addEventListener('input', (e) => {
            const slugInput = document.querySelector('#product-form input[name="slug"]');
            if(slugInput) {
                slugInput.value = e.target.value
                    .toLowerCase()
                    .trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }
        });
    }

    // Live Image Previews with Google Drive conversion
    function getDirectLink(url) {
        if(url.includes('drive.google.com')) {
            const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if(id && id[1]) return `https://lh3.googleusercontent.com/u/0/d/${id[1]}`;
        }
        return url;
    }

    const prodImgInput = document.querySelector('input[name="image_url"]');
    const prodImgPreview = document.getElementById('img-preview');
    if(prodImgInput && prodImgPreview) {
        prodImgInput.addEventListener('input', (e) => {
            const rawUrl = e.target.value.trim();
            const directUrl = getDirectLink(rawUrl);
            if(rawUrl !== directUrl) e.target.value = directUrl; // Auto-convert the input too
            prodImgPreview.src = directUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=100';
        });
    }

    const catImgInput = document.getElementById('cat-image-url');
    const catImgPreview = document.getElementById('cat-img-preview');
    if(catImgInput && catImgPreview) {
        catImgInput.addEventListener('input', (e) => {
            const rawUrl = e.target.value.trim();
            const directUrl = getDirectLink(rawUrl);
            if(rawUrl !== directUrl) e.target.value = directUrl; // Auto-convert the input too
            catImgPreview.src = directUrl || 'https://placehold.co/100';
        });
    }

    // Password Toggle Logic
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('login-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('ph-eye');
            togglePassword.classList.toggle('ph-eye-slash');
        });
    }
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
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error-msg');
    
    // Reset previous error
    if(errorMsg) errorMsg.style.display = 'none';

    // Trim values to remove any accidental leading/trailing spaces
    const enteredEmail = emailInput.value.trim().toLowerCase();
    const enteredPassword = passwordInput.value.trim();
    
    const correctEmail = 'admin@farmmily.com';
    const correctPassword = 'password123';

    if (enteredEmail === correctEmail && enteredPassword === correctPassword) {
        localStorage.setItem('admin_logged_in', 'true');
        document.body.classList.remove('show-login');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('main-wrapper').style.display = 'flex';
        showToast('Login successful! Welcome Admin.');
        
        // Trigger all manual loads so user doesn't have to refresh
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
    } else {
        if(errorMsg) errorMsg.style.display = 'block';
        showToast('Access Denied. Check credentials.', 'error');
        console.log("Login failed for:", enteredEmail);
    }
}

function handleLogout() {
    localStorage.removeItem('admin_logged_in');
    document.body.classList.add('show-login');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-wrapper').style.display = 'none';
    showToast('Logged out successfully.');
}

// --- Reviews CRUD ---
function openReviewModal() {
    document.getElementById('reviewModalTitle').innerText = 'Add New Review';
    const form = document.getElementById('review-form');
    form.reset();
    document.getElementById('edit-review-id').value = '';
    
    // Populate products select
    const sel = document.getElementById('review-product-select');
    if(sel) {
        sel.innerHTML = allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    
    openModal('reviewModal');
}

async function editReview(id) {
    const { data, error } = await supabaseClient.from('reviews').select('*').eq('id', id).single();
    if(error || !data) { showToast("Error loading review", 'error'); return; }
    
    document.getElementById('reviewModalTitle').innerText = 'Edit Review';
    const form = document.getElementById('review-form');
    document.getElementById('edit-review-id').value = id;
    
    form.elements['customer_name'].value = data.customer_name || '';
    form.elements['rating'].value = data.rating;
    form.elements['comment'].value = data.comment;
    
    // Populate products and select current
    const sel = document.getElementById('review-product-select');
    if(sel) {
        sel.innerHTML = allProducts.map(p => `<option value="${p.id}" ${p.id == data.product_id ? 'selected' : ''}>${p.name}</option>`).join('');
    }
    
    openModal('reviewModal');
}

async function deleteReview(id) {
    if(!await showConfirm("Delete Review?", "Are you sure? This will remove the feedback from your site permanently.", "Delete", "#ef4444")) return;
    const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
    if(error) showToast("Error deleting: " + error.message, 'error');
    else { showToast("Review deleted successfully 🗑️"); renderReviews(); }
}

const reviewForm = document.getElementById('review-form');
if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-review-id').value;
        const obj = {
            customer_name: reviewForm.elements['customer_name'].value,
            product_id: parseInt(reviewForm.elements['product_id'].value),
            rating: parseInt(reviewForm.elements['rating'].value),
            comment: reviewForm.elements['comment'].value,
        };
        
        let res;
        if(id) res = await supabaseClient.from('reviews').update(obj).eq('id', id);
        else res = await supabaseClient.from('reviews').insert([obj]);
        
        if(res.error) showToast("Error saving review: " + res.error.message, 'error');
        else {
            showToast("Review saved successfully ✅");
            closeModal('reviewModal');
            renderReviews();
        }
    });
}

// --- Image Upload & Compression ---
function handleFileUpload(input, targetInputNameOrId, previewId) {
    const file = input.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Compress using Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Get compressed Base64
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
            
            // Update inputs
            const target = document.querySelector(`input[name="${targetInputNameOrId}"]`) || document.getElementById(targetInputNameOrId);
            if(target) {
                target.value = dataUrl;
                // Dispatch input event to trigger any listeners (like the preview one)
                target.dispatchEvent(new Event('input'));
            }
            
            const preview = document.getElementById(previewId);
            if(preview) preview.src = dataUrl;
            
            showToast("Image compressed and loaded 🚀");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}
