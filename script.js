// --- Supabase Setup ---
const supabaseUrl = 'https://jztreusepxilnfqffwka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dHJldXNlcHhpbG5mcWZmd2thIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA5OTUsImV4cCI6MjA5MDQ0Njk5NX0.AXaOi_ax6esifM7DzwVjNXQrm3XLNPnzT_0yQWm6ahY';
let supabaseClient = null;

function initSupabase() {
    if (supabaseClient) return true;
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase initialized successfully');
        return true;
    }
    return false;
}

// Try immediately
initSupabase();

// --- Global State ---
let allProducts = [];
let allCategories = [];
let allOrders = [];
let currentOrderFilter = 'all';
let notifications = [];
let currentModalOrder = null;

// --- Boot: wait for Supabase then load data ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 DOMContentLoaded fired');
    function bootAdmin() {
        console.log('🔧 bootAdmin: attempting initSupabase...');
        if (!initSupabase()) {
            console.log('⏳ Supabase CDN not ready, retrying in 300ms...');
            setTimeout(bootAdmin, 300);
            return;
        }
        console.log('✅ bootAdmin: Supabase ready! adminLoggedIn:', localStorage.getItem('adminLoggedIn'));
        
        // Handle routing based on URL
        handleRouting();

        // Supabase is ready — if logged in, load dashboard
        if (localStorage.getItem('adminLoggedIn') === 'true') {
            showAdminContent();
        }
    }
    bootAdmin();
});


function showAdminContent() {
    console.log('🏠 showAdminContent called, supabaseClient:', supabaseClient ? 'ready' : 'NULL');
    
    const loginScreen = document.getElementById('login-screen');
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('main-wrapper');

    if (loginScreen) loginScreen.style.display = 'none';
    if (sidebar) sidebar.style.display = 'flex';
    if (mainWrapper) mainWrapper.style.display = 'flex';
    
    document.body.classList.remove('show-login');
    
    if (supabaseClient) {
        console.log('📊 Calling renderDashboard, fetchDeliveryConfig, loadCategoryOptions...');
        renderDashboard();
        fetchDeliveryConfig();
        loadCategoryOptions();
    } else {
        console.error('❌ showAdminContent: supabaseClient is NULL, data will not load!');
    }
}

function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error-msg');

    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value : '';

    if (email === 'admin@farmmily.com' && pass === 'Admin#123') {
        localStorage.setItem('adminLoggedIn', 'true');
        showAdminContent();
        
        const next = sessionStorage.getItem('redirectAfterLogin');
        if (next) {
            sessionStorage.removeItem('redirectAfterLogin');
            navigateTo(next);
        } else {
            navigateTo('dashboard');
        }
        
        if (typeof showToast === 'function') showToast('Welcome back, Admin!');
    } else {
        if (errorEl) {
            errorEl.style.display = 'block';
            setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
        }
    }
}

function handleLogout() {
    localStorage.removeItem('adminLoggedIn');
    location.reload();
}



// --- Navigation Logic ---
function navigateTo(pageId, push = true) {
    console.log(`🚀 Navigating to: ${pageId} (push: ${push})`);
    
    const pageEl = document.getElementById(`page-${pageId}`);
    if (!pageEl) {
        console.warn(`⚠️ Page not found: ${pageId}`);
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    pageEl.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard | Farmmily Admin', 
        'all-products': 'All Products | Farmmily Admin', 
        'add-product': 'Add Product | Farmmily Admin',
        'categories': 'Categories | Farmmily Admin', 
        'inventory': 'Inventory | Farmmily Admin', 
        'all-orders': 'All Orders | Farmmily Admin',
        'delivery': 'Delivery & Logistics | Farmmily Admin',
        'customers': 'Customers | Farmmily Admin', 
        'reports': 'Reports | Farmmily Admin', 
        'coupons': 'Coupons | Farmmily Admin',
        'banners': 'Banners | Farmmily Admin', 
        'reviews': 'Reviews | Farmmily Admin', 
        'corporate': 'Corporate Orders | Farmmily Admin', 
        'settings': 'Settings | Farmmily Admin'
    };
    
    document.title = titles[pageId] || 'Farmmily Admin';
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[pageId]?.split('|')[0].trim() || 'Admin';


    // Sidebar active state
    document.querySelectorAll('.nav-item, .sub-nav-item').forEach(el => el.classList.remove('active'));
    let targetEl = document.querySelector(`[data-page="${pageId}"]`);
    if(targetEl) {
        targetEl.classList.add('active');
        if(targetEl.classList.contains('sub-nav-item')) {
            const parentNav = targetEl.closest('.sub-nav').previousElementSibling;
            if (parentNav) parentNav.classList.add('active');
        }
    }
    
    if(window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('show');
    }

    // URL Synchronization
    if (push) {
        syncUrl(pageId);
    }

    // Page Specific Refresh
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'all-products') renderProducts();
    if (pageId === 'categories') renderCategories();
    if (pageId === 'inventory') renderInventory();
    if (pageId === 'all-orders') renderOrders();
    if (pageId === 'delivery') renderDelivery();
}

function syncUrl(pageId) {
    const currentPath = window.location.pathname;
    let targetPath = pageId === 'dashboard' ? '/' : '/' + pageId;
    let newUrl = targetPath;
    
    // Support index.html and file protocols
    if (currentPath.includes('index.html')) {
        const base = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        newUrl = base + (pageId === 'dashboard' ? 'index.html' : 'index.html?page=' + pageId);
    } else if (window.location.protocol === 'file:') {
        newUrl = currentPath + (pageId === 'dashboard' ? '' : '?page=' + pageId);
    }
    
    if (window.location.pathname + window.location.search !== newUrl) {
        try {
            window.history.pushState({ pageId: pageId }, '', newUrl);
        } catch(e) { console.error('Router failed:', e); }
    }
}

function handleRouting() {
    console.log('🔗 handleRouting triggered');
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const path = window.location.pathname;

    let targetPage = 'dashboard';

    if (pageParam) {
        targetPage = pageParam;
    } else {
        // Try to infer from path if using clean URLs
        const lastPart = path.split('/').pop();
        if (lastPart && lastPart !== 'index.html' && lastPart !== '') {
            targetPage = lastPart;
        }
    }

    if (localStorage.getItem('adminLoggedIn') === 'true') {
        navigateTo(targetPage, false);
    } else {
        // If not logged in, keep login screen but maybe track where they wanted to go
        if (targetPage !== 'dashboard') {
            sessionStorage.setItem('redirectAfterLogin', targetPage);
        }
    }
}

window.onpopstate = function(event) {
    if (event.state && event.state.pageId) {
        navigateTo(event.state.pageId, false);
    } else {
        handleRouting();
    }
};

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

// --- Utils ---
function getUnitPrice(price, wt) {
    const pVal = parseFloat(price || 0);
    const w = (wt || '').toLowerCase();
    const nm = w.match(/[\d.]+/);
    const nVal = nm ? parseFloat(nm[0]) : 0;
    
    if (nVal > 0) {
        if (w.includes('ml')) return { rate: Math.round((pVal / nVal) * 1000), unit: 'L' };
        if (w.includes('kg') || (w.includes('l') && !w.includes('ml'))) return { rate: Math.round(pVal / nVal), unit: w.includes('l') ? 'L' : 'kg' };
        if (w.includes('g') && !w.includes('kg')) return { rate: Math.round((pVal / nVal) * 1000), unit: 'kg' };
    }
    return { rate: Math.round(pVal), unit: (w.includes('l') || w.includes('ml')) ? 'L' : 'kg' };
}

function parseVariantQuantities(rawValue) {
    const values = String(rawValue || '')
        .split(',')
        .map(v => parseFloat(v.trim()))
        .filter(v => Number.isFinite(v) && v > 0);
    return [...new Set(values)].sort((a, b) => a - b);
}

function getBasePricePerKg(product) {
    if (!product) return 0;
    const lowerName = (product.name || '').toLowerCase();
    if (lowerName.includes('custom heritage')) {
        const keys = ['imam', 'alph', 'bang', 'sent'];
        const rates = keys.map(k => getProductRateByKeyword(k)).filter(r => r > 0);
        return rates.length ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0;
    }
    if (product.base_price_per_kg != null && product.base_price_per_kg !== '') {
        return parseFloat(product.base_price_per_kg) || 0;
    }

    const legacy = getUnitPrice(product?.price || 0, product?.weight || '1kg');
    return parseFloat(legacy.rate || 0);
}

function calculateVariantPrice(basePricePerKg, quantityKg) {
    return Math.round((parseFloat(basePricePerKg || 0) * parseFloat(quantityKg || 0)) * 100) / 100;
}

function getProductRateByKeyword(keyword) {
    const needle = String(keyword || '').toLowerCase();
    const product = (allProducts || []).find(item => {
        const haystack = `${item?.name || ''} ${item?.rawName || ''}`.toLowerCase();
        return haystack.includes(needle);
    });
    return product ? getBasePricePerKg(product) : 0;
}

function calculateCorporateOrderAmount(order = {}) {
    const rates = {
        imam: getProductRateByKeyword('imam'),
        alph: getProductRateByKeyword('alph'),
        bang: getProductRateByKeyword('bang'),
        sent: getProductRateByKeyword('sent')
    };

    const mix = {
        imam: parseInt(order.imam_qty, 10) || 0,
        alph: parseInt(order.alph_qty, 10) || 0,
        bang: parseInt(order.bang_qty, 10) || 0,
        sent: parseInt(order.sent_qty, 10) || 0
    };

    const pricePerCrate = Object.entries(mix).reduce((total, [key, qty]) => total + (qty * (rates[key] || 0)), 0);
    const totalKg = Object.values(mix).reduce((total, qty) => total + qty, 0);
    const totalUnits = parseInt(order.total_units, 10) || 15;

    return {
        rates,
        totalKg,
        totalUnits,
        pricePerCrate,
        totalAmount: pricePerCrate * totalUnits
    };
}

function formatCurrency(value) {
    return `₹${(parseFloat(value || 0)).toFixed(2).replace(/\.00$/, '')}`;
}

function getProductVariantQuantities(product) {
    if (Array.isArray(product?.variants) && product.variants.length > 0) {
        return product.variants
            .map(v => parseFloat(v.quantity_kg))
            .filter(v => Number.isFinite(v) && v > 0)
            .sort((a, b) => a - b);
    }

    if (product?.variant_quantities) {
        if (Array.isArray(product.variant_quantities)) return parseVariantQuantities(product.variant_quantities.join(','));
        return parseVariantQuantities(product.variant_quantities);
    }

    return [];
}

function buildVariantPreviewHtml(basePricePerKg, quantities) {
    if (!quantities.length) {
        return `<span style="font-size:0.8rem; color:var(--text-muted);">Add quantities like 3,5,7,10,15</span>`;
    }

    return quantities.map(qty => `
        <span class="variant-pill">${qty}kg <span>${formatCurrency(calculateVariantPrice(basePricePerKg, qty))}</span></span>
    `).join('');
}

function refreshVariantPreview() {
    const preview = document.getElementById('variant-preview');
    const basePriceInput = document.querySelector('#product-form input[name="base_price_per_kg"]');
    const variantInput = document.querySelector('#product-form input[name="variant_quantities"]');
    if (!preview || !basePriceInput || !variantInput) return;

    preview.innerHTML = buildVariantPreviewHtml(
        parseFloat(basePriceInput.value || 0),
        parseVariantQuantities(variantInput.value)
    );
}

function getMissingColumnName(error) {
    const message = String(error?.message || error?.details || '');
    const match = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i);
    return match ? match[1] : null;
}

async function upsertVariantsWithFallback(payload) {
    let sanitizedPayload = payload.map(row => ({ ...row }));

    while (sanitizedPayload.length > 0 && Object.keys(sanitizedPayload[0]).length > 0) {
        const { error } = await supabaseClient
            .from('product_variants')
            .upsert(sanitizedPayload, { onConflict: 'product_id,label' });

        if (!error) return;

        const missingColumn = getMissingColumnName(error);
        if (!missingColumn || !(missingColumn in sanitizedPayload[0])) {
            throw error;
        }

        sanitizedPayload = sanitizedPayload.map(row => {
            const nextRow = { ...row };
            delete nextRow[missingColumn];
            return nextRow;
        });
    }

    throw new Error('Unable to save product variants because no supported columns were found.');
}

async function saveProductVariants(productId, rawQuantities, pricing = {}) {
    const quantities = parseVariantQuantities(rawQuantities);
    const labels = quantities.map(qty => (typeof qty === 'object') ? qty.label : `${qty}kg`);
    const basePricePerKg = parseFloat(pricing.basePricePerKg || 0);
    const compareAtPerKg = parseFloat(pricing.compareAtPerKg || 0);

    const payload = quantities.map((v, index) => {
        // If v is a custom object (for Custom Size types)
        if (typeof v === 'object' && v !== null) {
            return {
                product_id: productId,
                label: v.label,
                quantity_kg: parseFloat(v.label) || 0,
                is_default: index === 0,
                price: parseFloat(v.price) || 0,
                sku: v.sku || null,
                updated_at: new Date().toISOString()
            };
        }

        // Standard auto-calculation
        const qtyNum = parseFloat(v) || 0;
        return {
            product_id: productId,
            label: `${qtyNum}kg`,
            quantity_kg: qtyNum,
            is_default: index === 0,
            price: calculateVariantPrice(basePricePerKg, qtyNum),
            compare_at_price: compareAtPerKg > 0 ? calculateVariantPrice(compareAtPerKg, qtyNum) : null,
            updated_at: new Date().toISOString()
        };
    });

    if (payload.length > 0) {
        await upsertVariantsWithFallback(payload);
    }

    // Cleaning up stale variants
    const { data: existingVariants, error: fetchError } = await supabaseClient
        .from('product_variants')
        .select('id, label')
        .eq('product_id', productId);
    if (fetchError) throw fetchError;

    const staleIds = (existingVariants || [])
        .filter(variant => !labels.includes(variant.label))
        .map(variant => variant.id);

    if (staleIds.length > 0) {
        await supabaseClient.from('product_variants').delete().in('id', staleIds);
    }
}

async function touchProductCatalogSync(productId = null) {
    const timestamp = new Date().toISOString();

    const updates = [
        () => supabaseClient
            .from('store_settings')
            .upsert({
                key: 'product_catalog_sync',
                value: {
                    product_id: productId,
                    synced_at: timestamp
                },
                updated_at: timestamp
            }, { onConflict: 'key' })
    ];

    if (productId) {
        updates.push(
            () => supabaseClient
                .from('products')
                .update({ updated_at: timestamp })
                .eq('id', productId)
        );
    }

    for (const runUpdate of updates) {
        try {
            const { error } = await runUpdate();
            if (error) {
                const missingColumn = getMissingColumnName(error);
                if (missingColumn === 'updated_at') continue;
                throw error;
            }
        } catch (error) {
            const missingColumn = getMissingColumnName(error);
            if (missingColumn === 'updated_at') continue;
            throw error;
        }
    }
}

async function saveProductRecordWithFallback(productPayload, productId = null) {
    let sanitizedPayload = { ...productPayload };

    while (Object.keys(sanitizedPayload).length > 0) {
        const query = productId
            ? supabaseClient.from('products').update(sanitizedPayload).eq('id', productId).select()
            : supabaseClient.from('products').insert([sanitizedPayload]).select();

        const result = await query;
        if (!result.error) return result;

        const missingColumn = getMissingColumnName(result.error);
        if (!missingColumn || !(missingColumn in sanitizedPayload)) {
            return result;
        }

        delete sanitizedPayload[missingColumn];
    }

    return {
        data: null,
        error: new Error('Could not save product because none of the submitted columns were accepted by the database.')
    };
}

async function fetchDeliveryConfig() {
    try {
        const { data } = await supabaseClient.from('store_settings').select('value').eq('key', 'delivery_config').maybeSingle();
        if (data && data.value) {
            const config = data.value;
            
            // Sync all delivery input fields across the app
            const chargeInputs = ['del-charge-input', 'settings-del-charge-input'];
            const thresholdInputs = ['del-free-threshold', 'settings-del-free-threshold'];

            chargeInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = (config.charge !== undefined && config.charge !== null) ? config.charge : 50;
            });

            thresholdInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = (config.free_above !== undefined && config.free_above !== null) ? config.free_above : 999;
            });
        }
    } catch (err) { console.error("Error fetching delivery config:", err); }
}

async function updateDeliveryConfig(source = 'delivery') {
    let chargeInp, thresholdInp;
    
    if (source === 'settings') {
        chargeInp = document.getElementById('settings-del-charge-input');
        thresholdInp = document.getElementById('settings-del-free-threshold');
    } else {
        chargeInp = document.getElementById('del-charge-input');
        thresholdInp = document.getElementById('del-free-threshold');
    }

    if (!chargeInp || !thresholdInp) return;

    const charge = parseInt(chargeInp.value) || 0;
    const threshold = parseInt(thresholdInp.value) || 0;
    
    try {
        const { error } = await supabaseClient.from('store_settings').upsert({
            key: 'delivery_config',
            value: { charge: charge, free_above: threshold },
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        
        if (error) throw error;
        showToast("Delivery policy updated successfully ✅");
        
        // Update the other inputs and UI
        await fetchDeliveryConfig();
        if (typeof renderDelivery === 'function') renderDelivery();
    } catch (err) {
        showToast("Error updating policy: " + err.message, 'error');
    }
}

async function renderDelivery() {
    const tbody = document.getElementById('delivery-history-tbody');
    if (!tbody) return;
    showLoading('delivery-history-tbody');
    
    await fetchDeliveryConfig();
    
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*, order_items(count)')
            .eq('status', 'delivered')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const todayDelivered = (orders || []).filter(o => o.created_at.startsWith(todayStr)).length;
        const countEl = document.getElementById('del-summary-count');
        if (countEl) countEl.innerText = todayDelivered;

        if (!orders || orders.length === 0) {
            showEmpty('delivery-history-tbody', 'No delivery history found');
        } else {
            tbody.innerHTML = orders.map(o => `
                <tr>
                    <td><strong>#${o.order_number || o.id}</strong></td>
                    <td>${o.customer_name || 'Guest'}</td>
                    <td>${o.order_items?.[0]?.count || 0} items</td>
                    <td><strong>₹${o.total}</strong></td>
                    <td>${new Date(o.created_at).toLocaleDateString()}</td>
                    <td><span class="status-badge status-delivered">Verified ✅</span></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error(err);
        showEmpty('delivery-history-tbody', 'Error loading history');
    }
}

async function renderDashboard() {
    console.log('🔄 renderDashboard called, supabaseClient:', supabaseClient ? 'ready' : 'NULL');
    
    // Ensure supabase is initialized
    if (!supabaseClient) {
        initSupabase();
        if (!supabaseClient) {
            console.error('❌ Cannot render dashboard: supabaseClient is still null');
            return;
        }
    }
    
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

        // Corporate Orders (to include in stats)
        const { data: rawCorp, error: cErr } = await supabaseClient.from('corporate_orders').select('*');
        if(cErr) throw cErr;

        // Products for stock stats
        const { data: rawProducts, error: prErr } = await supabaseClient.from('products').select('*');
        if(prErr) throw prErr;
        allProducts = rawProducts || [];
        const products = allProducts;

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

        // Add Corporate Orders to stats
        (rawCorp || []).forEach(c => {
            const status = (c.status || '').toLowerCase();
            const isToday = c.created_at && c.created_at.startsWith(todayStr);
            if(isToday) todayOrders++;
            if(status === 'new' || status === 'confirmed') pipeline.pending++;
            if(status === 'fulfilled' && isToday) pipeline.deliveredToday++;
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

        const lowStockCount = products.filter(p => p.stock_count > 0 && p.stock_count < 20).length;
        if(lowStockCount > 0) {
            showToast(`${lowStockCount} items are running low on stock!`, 'warning');
        }

        // Recent Orders Table
        if(orders.length === 0) showEmpty('dashboard-recent-orders');
        else {
            document.getElementById('dashboard-recent-orders').innerHTML = orders.slice(0,5).map(o => `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td>${o.customer_name || o.display_name || 'Guest'}</td>
                    <td>₹${(o.total || 0).toLocaleString()}</td>
                    <td><span class="badge ${o.status}">${o.status}</span></td>
                    <td><button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `).join('');
        }

        // Top Selling Products (calculated from order_items)
        const { data: topItems } = await supabaseClient.from('order_items').select('product_name, product_id, quantity');
        const topCounts = (topItems || []).reduce((acc, item) => {
            acc[item.product_name] = (acc[item.product_name] || 0) + (item.quantity || 1);
            return acc;
        }, {});
        const sortedTop = Object.entries(topCounts).sort((a,b) => b[1] - a[1]).slice(0,4);
        
        const fallbacks = [
            'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=100', // Honey
            'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=100', // Ghee
            'https://images.unsplash.com/photo-1615485290382-441e4d019cb5?auto=format&fit=crop&q=80&w=100', // Turmeric
            'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=100'  // Millets
        ];
        
        document.getElementById('dashboard-top-products').innerHTML = sortedTop.length > 0 ? sortedTop.map(([name, sales], idx) => `
            <tr>
                <td style="display:flex;align-items:center;gap:10px">
                    <div style="width:30px;height:30px;background:#f3f4f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--primary-dark)">${idx+1}</div>
                    <span>${name}</span>
                </td>
                <td><span style="font-weight:700;color:var(--primary)">${sales}</span> sold</td>
            </tr>
        `).join('') : '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:10px">No sales yet</td></tr>';

        // Low stock (now including out of stock)
        const lowStock = products.filter(p => p.stock_count < 20).sort((a,b) => a.stock_count - b.stock_count);
        document.getElementById('dashboard-low-stock').innerHTML = lowStock.map(p => {
            const isOut = p.stock_count <= 0;
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,0,0,0.05); padding:8px 0;">
                <span style="font-weight:600; font-size:0.85rem">${p.name}</span> 
                <span class="badge ${isOut ? 'danger' : 'warning'}" style="font-size:0.65rem; padding:2px 8px;">
                    ${isOut ? 'OUT' : p.stock_count + ' LEFT'}
                </span>
            </div>
        `}).join('');

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
        const { data: products, error: prodError } = await supabaseClient
            .from('products')
            .select('*')
            .order('priority', { ascending: true })
            .order('name', { ascending: true });
        if (prodError) throw prodError;

        const { data: variants, error: variantsError } = await supabaseClient
            .from('product_variants')
            .select('*')
            .order('quantity_kg', { ascending: true });
        if (variantsError) throw variantsError;

        const variantMap = (variants || []).reduce((acc, variant) => {
            const key = String(variant.product_id);
            if (!acc[key]) acc[key] = [];
            acc[key].push(variant);
            return acc;
        }, {});

        allProducts = (products || []).map(product => ({
            ...product,
            variants: variantMap[String(product.id)] || []
        }));
        
        if (allProducts.length === 0) {
            if (products.length > 0) {
                document.getElementById('products-tbody').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:#64748b">All products have been ordered and are now hidden.</td></tr>`;
            } else {
                showEmpty('products-tbody');
            }
        } else {
            buildProductsTable(allProducts);
        }
    } catch(err) {
        showToast("Error loading products: " + (err.message || err), 'error');
        console.error(err);
    }
}


function buildProductsTable(products) {
    document.getElementById('products-tbody').innerHTML = products.map(p => {
        const cat = allCategories.find(c => c.id === p.category_id);
        const isOutOfStock = p.in_stock === false;
        const basePrice = getBasePricePerKg(p);
        const variantQuantities = getProductVariantQuantities(p);
        
        let variantSummary = '';
        if (p.variants && p.variants.length > 0) {
            variantSummary = p.variants.map(v => `<span class="ap-variant-pill">${v.label} - ${formatCurrency(v.price || calculateVariantPrice(basePrice, v.quantity_kg))}</span>`).join('');
        } else if (variantQuantities.length) {
            variantSummary = variantQuantities.map(qty => `<span class="ap-variant-pill">${qty}kg - ${formatCurrency(calculateVariantPrice(basePrice, qty))}</span>`).join('');
        } else {
            variantSummary = '<span class="ap-variant-pill" style="opacity:0.6">No variants</span>';
        }

        const reviewCount = p.review_count ?? p.rating_count ?? 0;
        const averageRating = Number(p.avg_rating ?? p.rating ?? 0);
        const ratingLabel = reviewCount > 0 ? `${averageRating.toFixed(1)} (${reviewCount})` : 'No ratings';

        return `
        <tr>
            <!-- Product Details -->
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=100'}" class="product-img" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
                    <div>
                        <div style="font-weight:700; color:var(--text-main); font-size:14px; margin-bottom:2px;">${p.name}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px; display:flex; gap:6px; align-items:center;">
                            <span style="font-family:monospace; font-weight:600; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${p.sku || 'No SKU'}</span>
                            <span>•</span>
                            <span style="color:#f59e0b;">★ ${ratingLabel}</span>
                        </div>
                        <div style="display:flex; gap:6px; margin-top:6px; flex-wrap: wrap;">
                            <span class="ap-badge-sm" style="background:#e0f2fe; color:#0369a1">${cat?.name || 'Uncategorized'}</span>
                            <span class="ap-badge-sm" style="background:#f3f4f6; color:#4b5563">${(p.product_type || 'standard').replace(/_/g, ' ')}</span>
                            <span class="ap-badge-sm" style="background:#fef3c7; color:#92400e; font-weight:700;">PRIO: ${p.priority ?? 100}</span>
                            ${variantQuantities.map(qty => `<span class="ap-badge-sm" style="background:#ecfdf5; color:#065f46; font-weight:600;">${qty}${qty.toString().match(/[a-zA-Z]/) ? '' : 'kg'}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </td>

            <!-- Pricing & Variants -->
            <td>
                <div style="font-weight:700; color:var(--text-main); margin-bottom:4px">
                    ${formatCurrency(basePrice)}<span style="font-size:0.75rem; color:#64748b; font-weight:500;">/kg base</span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; max-width: 250px;">
                    ${variantSummary}
                </div>
            </td>

            <!-- Stock & Priority -->
            <td>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" class="form-control" value="${p.stock_count}" min="0" style="width:60px; padding:4px 8px; font-size:0.85rem; height:auto;" title="Stock Count">
                        <span style="font-size:0.8rem; color:#64748b;">units in stock</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="switch" style="transform:scale(0.85); transform-origin:left center;">
                            <input type="checkbox" ${isOutOfStock ? 'checked' : ''} onchange="toggleProductStock('${p.id}', !this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span style="font-size:0.75rem; font-weight:600; color:${isOutOfStock ? '#ef4444' : '#10b981'};">
                            ${isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" class="form-control" value="${p.priority ?? 100}" min="1" style="width:60px; padding:4px 8px; font-size:0.85rem; height:auto; border-color:#f59e0b;" onchange="updateProductPriority('${p.id}', this.value)" title="Priority">
                        <span style="font-size:0.8rem; color:#b45309; font-weight:600;">priority</span>
                    </div>
                </div>
            </td>

            <!-- Display Settings -->
            <td>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="switch" style="transform:scale(0.8); transform-origin:left center;">
                            <input type="checkbox" ${p.is_active ? 'checked' : ''} onchange="toggleProductVisibility('${p.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span style="font-size:0.75rem; font-weight:600; color:${p.is_active ? '#3b82f6' : '#94a3b8'}; width:50px;">Store</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="switch" style="transform:scale(0.8); transform-origin:left center;">
                            <input type="checkbox" ${p.show_on_home ? 'checked' : ''} onchange="toggleProductPlacement('${p.id}', 'show_on_home', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span style="font-size:0.75rem; font-weight:600; color:${p.show_on_home ? '#8b5cf6' : '#94a3b8'}">Home</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="switch" style="transform:scale(0.8); transform-origin:left center;">
                            <input type="checkbox" ${p.show_on_shop !== false ? 'checked' : ''} onchange="toggleProductPlacement('${p.id}', 'show_on_shop', this.checked)">
                            <span class="slider"></span>
                        </label>
                        <span style="font-size:0.75rem; font-weight:600; color:${p.show_on_shop !== false ? '#ec4899' : '#94a3b8'}">Shop Page</span>
                    </div>
                </div>
            </td>

            <!-- Actions -->
            <td style="text-align:right">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="action-btn" title="Edit Product" onclick="editProduct('${p.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="action-btn btn-delete" title="Delete Product" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </td>
        </tr>
    `}).join('');
}

async function toggleProductStock(id, isStock) {
    const { error } = await supabaseClient.from('products').update({ in_stock: isStock }).eq('id', id);
    if(error) showToast("Error updating stock status", 'error');
    else {
        showToast("Stock status updated ✅");
        renderProducts();
    }
}

async function toggleProductVisibility(id, isActive) {
    const { error } = await supabaseClient.from('products').update({ is_active: isActive }).eq('id', id);
    if(error) showToast("Error updating visibility", 'error');
    else {
        showToast("Product visibility updated ✅");
        renderProducts();
    }
}

async function updateProductPriority(id, value) {
    const priority = parseInt(value, 10);
    if (!Number.isFinite(priority) || priority < 1) {
        showToast("Priority must be 1 or more", 'warning');
        renderProducts();
        return;
    }

    const { error } = await supabaseClient.from('products').update({ priority }).eq('id', id);
    if(error) {
        showToast("Error updating product priority", 'error');
        renderProducts();
    } else {
        showToast("Product priority updated ✅");
        renderProducts();
    }
}

async function toggleProductPlacement(id, field, value) {
    if (!['show_on_home', 'show_on_shop'].includes(field)) {
        showToast("Invalid placement field", 'error');
        return;
    }

    const { error } = await supabaseClient.from('products').update({ [field]: value }).eq('id', id);
    if(error) {
        showToast("Error updating product placement", 'error');
        renderProducts();
    } else {
        showToast(`${field === 'show_on_home' ? 'Home' : 'Shop'} visibility updated ✅`);
        renderProducts();
    }
}

async function syncProductRatingSummary(productId) {
    if (!productId) return;

    const { data: reviews, error: reviewsError } = await supabaseClient
        .from('reviews')
        .select('rating')
        .eq('product_id', productId);

    if (reviewsError) throw reviewsError;

    const reviewCount = (reviews || []).length;
    const averageRating = reviewCount
        ? Number((reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviewCount).toFixed(2))
        : 0;

    const { error: updateError } = await supabaseClient
        .from('products')
        .update({
            rating: averageRating,
            avg_rating: averageRating,
            review_count: reviewCount,
            rating_count: reviewCount
        })
        .eq('id', productId);

    if (updateError) throw updateError;
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
        const selects = document.querySelectorAll('select[name="category_id"]');
        selects.forEach(s => {
            s.innerHTML = '<option value="">Select Category</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        });

        // Populate Category Filter on All Products Page
        const filterSelect = document.getElementById('product-category-filter');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">All Categories</option>' + 
                data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }
}

function filterProductsByCategory(catId) {
    if (!catId) { buildProductsTable(allProducts); return; }
    const filtered = allProducts.filter(p => String(p.category_id) === String(catId));
    buildProductsTable(filtered);
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
                const lowName = (c.name || '').toLowerCase();
                let iconHtml = '';
                if (lowName.includes('ghee')) iconHtml = '🍯';
                else if (lowName.includes('honey')) iconHtml = '🍯';
                else if (lowName.includes('mango')) iconHtml = '🥭';
                else if (lowName.includes('spice')) iconHtml = '🌶️';
                else if (lowName.includes('oil')) iconHtml = '🧴';
                else if (lowName.includes('beverage')) iconHtml = '🥤';

                const catImg = c.image_url || '';

                return `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            ${catImg ? `<img src="${catImg}" class="product-img" style="width:40px; height:40px;">` : `<span style="font-size:1.5rem; width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; border-radius:8px;">${iconHtml || '📁'}</span>`}
                            <strong>${c.name}</strong>
                        </div>
                    </td>
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
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;
    showLoading('inventory-tbody');
    
    try {
        const { data: products, error: pErr } = await supabaseClient.from('products').select('*').order('name');
        const { data: categories, error: cErr } = await supabaseClient.from('categories').select('*');
        if(pErr) throw pErr;
        
        const catMap = (categories || []).reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {});

        if(!products || products.length === 0) {
            showEmpty('inventory-tbody');
        } else {
            tbody.innerHTML = products.map(p => {
                const count = p.stock_count || 0;
                let statusLabel, colorClass;
                
                if (count > 20) {
                    statusLabel = 'In Stock';
                    colorClass = 'success';
                } else if (count > 0) {
                    statusLabel = 'Low Stock';
                    colorClass = 'warning';
                } else {
                    statusLabel = 'Out of Stock';
                    colorClass = 'danger';
                }

                const img = p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=100';

                return `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${img}" class="product-img" style="width:48px; height:48px;">
                            <div style="display:flex; flex-direction:column;">
                                <strong style="color:var(--text-main)">${p.name}</strong>
                                <span style="font-size:0.75rem; color:var(--text-muted)">SKU: ${p.sku || 'N/A'}</span>
                            </div>
                        </div>
                    </td>
                    <td><span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">${catMap[p.category_id] || 'Uncategorized'}</span></td>
                    <td>
                        <div style="font-size:1.1rem; font-weight:800; color:var(--text-main)">${count}</div>
                        <span style="font-size:0.7rem; color:var(--text-muted)">units available</span>
                    </td>
                    <td>
                        <div style="margin-bottom:8px">
                            <span class="badge ${colorClass}" style="font-size:0.7rem; padding:4px 10px; min-width:95px; text-align:center;">
                                ${statusLabel}
                            </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label class="switch" style="width:36px; height:20px;">
                                <input type="checkbox" ${!p.in_stock ? 'checked' : ''} onchange="toggleProductStock('${p.id}', !this.checked)">
                                <span class="slider" style="border-radius:20px;"></span>
                            </label>
                            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700;">HIDDEN STOCK</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="stock-ctrl" style="display:flex; border:1px solid var(--border-color); border-radius: var(--radius-sm); overflow:hidden; background:white;">
                                <button onclick="adjustStockValue('${p.id}', -1)" style="border:none; background:none; padding:8px 10px; cursor:pointer; color:var(--text-muted);"><i class="ph ph-minus"></i></button>
                                <input type="number" class="stock-input-${p.id}" value="${count}" 
                                    style="width:50px; border:none; border-left:1px solid var(--border-color); border-right:1px solid var(--border-color); text-align:center; font-weight:700; font-size:0.9rem;">
                                <button onclick="adjustStockValue('${p.id}', 1)" style="border:none; background:none; padding:8px 10px; cursor:pointer; color:var(--text-muted);"><i class="ph ph-plus"></i></button>
                            </div>
                            <button class="btn btn-primary" style="padding:8px 12px; font-size:0.8rem;" onclick="updateStock('${p.id}')">
                                <i class="ph ph-arrows-clockwise"></i> Update
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
    } catch(err) { 
        showToast("Error loading inventory: " + (err.message || err), 'error'); 
        console.error(err);
    }
}

function adjustStockValue(id, delta) {
    const input = document.querySelector(`.stock-input-${id}`);
    if (input) {
        input.value = Math.max(0, parseInt(input.value || 0) + delta);
    }
}

async function updateStock(id) {
    const input = document.querySelector(`.stock-input-${id}`);
    const btn = input.parentElement.nextElementSibling;
    const oldHtml = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-circle-notch spinner-sm"></i>';
    
    const val = parseInt(input.value || 0);
    
    try {
        const { error } = await supabaseClient.from('products').update({ stock_count: val }).eq('id', id);
        if(error) throw error;
        
        showToast("Stock updated successfully ✅"); 
        
        // Update local state if it exists
        const p = allProducts.find(x => x.id == id);
        if(p) p.stock_count = val;
        
        renderInventory(); 
        renderDashboard(); 
    } catch(error) {
        showToast("Error updating stock", 'error');
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

function filterInventory(q) {
    q = (q || '').toLowerCase();
    const rows = document.querySelectorAll('#inventory-tbody tr');
    rows.forEach(row => {
        const name = row.querySelector('strong').innerText.toLowerCase();
        row.style.display = name.includes(q) ? '' : 'none';
    });
}

function filterInventoryByStatus(status) {
    const rows = document.querySelectorAll('#inventory-tbody tr');
    rows.forEach(row => {
        if(status === 'all') {
            row.style.display = '';
            return;
        }
        const badge = row.querySelector('.badge');
        const badgeText = badge.innerText.toLowerCase();
        
        let match = false;
        if(status === 'good' && badgeText.includes('in stock')) match = true;
        if(status === 'low' && badgeText.includes('low stock')) match = true;
        if(status === 'out' && badgeText.includes('out of stock')) match = true;
        
        row.style.display = match ? '' : 'none';
    });
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
            document.getElementById('orders-tbody').innerHTML = filtered.map(o => {
                const payStatus = (o.payment_status || 'pending').toLowerCase();
                const payBadgeColor = payStatus === 'paid' ? '#10b981' : '#f59e0b';
                
                return `
                <tr>
                    <td>${o.order_number || o.id.toString().substring(0,8)}</td>
                    <td>₹${(o.total || 0).toLocaleString()}</td>
                    <td>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:0.85rem; font-weight:700;">${o.payment_method || 'Online'}</span>
                            <span style="font-size:0.7rem; color:${payBadgeColor}; font-weight:800; text-transform:uppercase;">● ${payStatus}</span>
                        </div>
                    </td>
                    <td><span class="badge ${(o.status || '').toLowerCase()}">${o.status}</span></td>
                    <td>${o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short'}) : '-'}</td>
                    <td><button class="btn btn-outline" style="padding:4px 10px;" onclick="viewOrder('${o.id}')">View</button></td>
                </tr>
            `}).join('');
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
                    <td><img src="${b.image_url}" class="product-img" style="width:120px; height:60px; object-fit:cover;"></td>
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
    if (tableId === 'products-table') { 
        const lower = text.toLowerCase();
        const filtered = allProducts.filter(p => {
            const cat = allCategories.find(c => c.id === p.category_id);
            return (p.name || '').toLowerCase().includes(lower) || 
                   (p.sku || '').toLowerCase().includes(lower) || 
                   (cat?.name || '').toLowerCase().includes(lower);
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

window.currentModalOrder = null;
let activeOrderId = null;
async function viewOrder(id) {
    let o = allOrders.find(x => x.id == id);
    currentModalOrder = o;
    
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
        if((!o.address || typeof o.address !== 'object') && o.address_id) {
            const { data: a } = await supabaseClient.from('addresses').select('*').eq('id', o.address_id).single();
            if (a) o.address = a;
        }
        o.display_name = o.profile?.full_name || o.address?.full_name || 'Guest';
    }
    activeOrderId = id;
    document.getElementById('om-title').innerText = `Order ${o.order_number || o.id.toString().substring(0,8)}`;
    document.getElementById('om-customer').innerText = o.display_name || o.customer_name || 'Guest';
    document.getElementById('om-phone').innerText = o.phone || o.profile?.phone || o.address?.phone || '-';
    
    // Show Full Shipping Address
    const addrDiv = document.getElementById('om-full-address');
    if(addrDiv) {
        let addrData = o.address;
        if(!addrData && o.address_id) {
             const { data: a } = await supabaseClient.from('addresses').select('*').eq('id', o.address_id).single();
             addrData = a;
        }

        if(addrData && (addrData.address_line || addrData.city)) {
            const city = addrData.city || '';
            const state = addrData.state || '';
            const pin = addrData.pincode || '';
            const mapLink = addrData.map_link || '';
            
            // Extract map link from string if it exists in legacy format
            let extractedMap = mapLink;
            if(!extractedMap && addrData.address_line && addrData.address_line.includes('(Map:')) {
                const match = addrData.address_line.match(/\(Map: (.*?)\)/);
                if(match) extractedMap = match[1];
            }
            if(!extractedMap && o.address && typeof o.address === 'string' && o.address.includes('(Map:')) {
                const match = o.address.match(/\(Map: (.*?)\)/);
                if(match) extractedMap = match[1];
            }

            // Hide placeholders like "Guest", "Order", or "000000"
            const showCityState = (city && city.toLowerCase() !== 'guest' && city.toLowerCase() !== 'order');
            const showPin = pin && pin !== '000000' && pin !== '';

            // Formatting address line: remove Map link part if we are showing it separately
            let displayLine = addrData.address_line || '';
            if(displayLine.includes('(Map:')) displayLine = displayLine.split('(Map:')[0].trim().replace(/,$/, '');

            addrDiv.innerHTML = `
                <div style="color:var(--text-main); font-weight:700; margin-bottom:10px; display:flex; justify-content:space-between; align-items:flex-start;">
                    <span>Shipping Address:</span>
                    ${extractedMap ? `<a href="${extractedMap}" target="_blank" class="btn btn-primary" style="padding:4px 10px; font-size:0.7rem; display:flex; align-items:center; gap:5px; border-radius:30px;"><i class="ph ph-map-pin"></i> Open Maps</a>` : ''}
                </div>
                <div style="font-size:1rem; line-height:1.6; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                    <div style="font-weight:700; color:var(--primary-dark); margin-bottom:4px;">${addrData.full_name || o.customer_name || o.display_name || 'Guest'}</div>
                    <div style="color:#475569;">${displayLine}</div>
                    <div style="font-weight:600; color:#1e293b; margin-top:2px;">
                        ${showCityState ? (city + (state ? ', ' + state : '')) : ''}${showPin ? (showCityState ? ' - ' : '') + pin : ''}
                    </div>
                </div>
            `;
        } else {
            // Fallback to order-level address string
            const directAddr = o.address_text || o.address_line || (typeof o.address === 'string' ? o.address : '') || 'No address provided';
            addrDiv.innerHTML = `
                <div style="color:var(--text-main); font-weight:700; margin-bottom:4px">Shipping Address:</div>
                <div style="font-size:1rem; line-height:1.5; background:#f8fafc; padding:12px; border-radius:12px; border:1px dashed #cbd5e1;">${directAddr}</div>
            `;
        }
    }

    // Show Razorpay Details if available
    const rpDiv = document.getElementById('om-razorpay');
    if(rpDiv) {
        const { data: payments } = await supabaseClient.from('payments').select('*').eq('order_id', id).limit(1);
        const p = payments?.[0];
        if(p && p.razorpay_payment_id) {
            rpDiv.innerHTML = `
                <div style="margin-top:15px; padding:12px; background:#f0f9ff; border-radius:12px; border:1px solid #bae6fd;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:0.75rem; font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.5px;">Razorpay Live Payment</span>
                        <span style="background:#0ea5e9; color:white; font-size:0.65rem; padding:2px 8px; border-radius:20px; font-weight:800;">Captured</span>
                    </div>
                    <div style="font-size:0.85rem; color:#0c4a6e;">
                        <div style="margin-bottom:4px;"><strong>Payment ID:</strong> <span style="font-family:monospace;">${p.razorpay_payment_id}</span></div>
                        <div style="margin-bottom:4px;"><strong>Method:</strong> ${p.method || 'Online'}</div>
                        <div><strong>Amount:</strong> ₹${p.amount}</div>
                    </div>
                </div>
            `;
        } else if (o.payment_method === 'cod') {
            rpDiv.innerHTML = `
                <div style="margin-top:15px; padding:12px; background:#fefce8; border-radius:12px; border:1px solid #fef08a;">
                    <span style="font-size:0.75rem; font-weight:800; color:#854d0e; text-transform:uppercase;">Cash on Delivery</span>
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
        itemsContainer.innerHTML = '<div style="padding:10px; text-align:center;"><i class="ph ph-circle-notch spinner"></i> Loading harvest...</div>';
        
        try {
            const { data: items, error: itemsErr } = await supabaseClient.from('order_items').select('*').eq('order_id', id);
            
            if(itemsErr) throw itemsErr;
            
                const itemsHtml = items.map(i => {
                    // Use stored image if available, fallback to product search
                    let img = i.product_image || 'https://placehold.co/100?text=Farmmily';
                    if (!i.product_image && i.product_id) {
                        const lp = allProducts.find(x => x.id == i.product_id);
                        if (lp && lp.image_url) img = lp.image_url;
                    }

                    return `
                        <div style="display:flex; align-items:center; gap:12px; padding:12px; background:white; border-radius:12px; border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.02)">
                            <img src="${img}" class="product-img" style="width:50px; height:50px;">
                            <div style="flex:1">
                                <div style="font-weight:700; color:var(--text-main); font-size:0.95rem">${i.product_name}</div>
                                <div style="font-size:0.8rem; color:#6b7280; font-weight:500; margin-top:2px;">
                                    ${i.quantity} x ₹${i.unit_price} 
                                    ${i.weight ? `(${i.weight})` : ''}
                                </div>
                                ${i.description ? `<div style="font-size:0.8rem; color:#059669; font-weight:600; margin-top:4px; padding:4px 8px; background:#ecfdf5; border-radius:6px; display:inline-block;">${i.description}</div>` : ''}
                            </div>
                            <div style="font-weight:800; color:var(--primary); font-size:1rem">₹${i.total_price}</div>
                        </div>
                    `;
                }).join('');

                // Calculate Delivery Fee if not explicitly stored
                const subtotal = items.reduce((acc, curr) => acc + parseFloat(curr.total_price || 0), 0);
                const deliveryFee = o.total - subtotal;
                
                let deliveryHtml = '';
                if (deliveryFee > 0) {
                    deliveryHtml = `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; margin-top:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="ph ph-truck" style="font-size:1.2rem; color:#64748b;"></i>
                                <span style="font-size:0.9rem; font-weight:600; color:#475569;">Delivery Charge</span>
                            </div>
                            <div style="font-weight:700; color:#475569; font-size:1rem">₹${Math.round(deliveryFee)}</div>
                        </div>
                    `;
                } else if (subtotal > 0) {
                     deliveryHtml = `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f0fdf4; border-radius:12px; border:1px dashed #bbf7d0; margin-top:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="ph ph-seal-check" style="font-size:1.2rem; color:#22c55e;"></i>
                                <span style="font-size:0.9rem; font-weight:600; color:#166534;">Free Delivery</span>
                            </div>
                            <div style="font-weight:800; color:#22c55e; font-size:0.8rem; text-transform:uppercase;">Applied</div>
                        </div>
                    `;
                }

                itemsContainer.innerHTML = itemsHtml + deliveryHtml;

        } catch (err) {
            console.error("Items load error:", err);
            itemsContainer.innerHTML = '<div style="padding:10px; color:#ef4444; font-size:0.8rem;">Error loading items.</div>';
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
    if (form) form.reset();

    // Reset main image preview
    const preview = document.getElementById('img-preview');
    if (preview) preview.src = 'https://placehold.co/200x200/f1f5f9/94a3b8?text=Upload';

    // Reset extra image slots
    ['img-preview-2', 'img-preview-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.src = ''; el.style.display = 'none'; }
        const slot = el?.closest('.ap-img-slot');
        if (slot) {
            const placeholder = slot.querySelector('.ap-img-placeholder');
            if (placeholder) placeholder.style.display = 'flex';
        }
    });

    const title = document.getElementById('pm-title');
    if (title) title.innerText = 'Add New Product';

    const btn = document.getElementById('save-product-btn');
    if (btn) btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save Product';

    // Reset Crate Builder Slots
    const container = document.getElementById('crate-slots-container');
    if (container) {
        // Keep only first 4 slots, remove the rest
        const slots = container.querySelectorAll('.crate-slot');
        slots.forEach((slot, i) => {
            if (i >= 4) {
                slot.remove();
            } else {
                const idInput = slot.querySelector('.custom-var-id');
                const sizeInput = slot.querySelector('.custom-var-size');
                const priceInput = slot.querySelector('.custom-var-price');
                
                if (idInput) idInput.value = '';
                if (sizeInput) sizeInput.value = (i < 2) ? '3Kg' : '5Kg';
                if (priceInput) priceInput.value = '';
            }
        });
    }

    if (form?.elements['product_type']) {
        form.elements['product_type'].value = 'standard';
        handleProductTypeChange('standard');
    }
    if (form?.elements['priority']) form.elements['priority'].value = '100';
    if (form?.elements['variant_quantities']) form.elements['variant_quantities'].value = '3,5,7,10,15';
    if (form?.elements['show_on_shop']) form.elements['show_on_shop'].checked = true;
    
    // Set default values for ratings
    if (form?.elements['rating']) form.elements['rating'].value = '5.0';
    if (form?.elements['review_count']) form.elements['review_count'].value = '0';
    
    refreshVariantPreview();
}

/**
 * Handles switching between product types (Custom Size / Multi Product / etc.)
 * Shows/hides relevant form sections.
 */
function handleProductTypeChange(type) {
    const crateBuilder = document.getElementById('section-crate-builder');
    if (crateBuilder) crateBuilder.style.display = (type === 'custom_box') ? 'block' : 'none';
    
    // Hide standard base price section if custom box
    const standardPricing = document.getElementById('standard-pricing-section');
    if (standardPricing) standardPricing.style.display = (type === 'custom_box') ? 'none' : 'block';
}

function addCrateSlot() {
    const container = document.getElementById('crate-slots-container');
    if (!container) return;
    const slotCount = container.querySelectorAll('.crate-slot').length + 1;
    const slot = document.createElement('div');
    slot.className = 'crate-slot';
    slot.style.cssText = 'background:white; padding:10px; border-radius:8px; border:1px solid #cbd5e1;';
    slot.innerHTML = `
        <span style="font-size:10px; font-weight:800; color:#94a3b8; display:block; margin-bottom:6px; text-transform:uppercase;">Variety ${slotCount}</span>
        <input type="text" class="form-control custom-var-id" placeholder="ID" style="margin-bottom:8px; font-size:12px; padding:6px;">
        <div style="display:flex; gap:6px;">
            <input type="text" class="form-control custom-var-size" placeholder="Size" style="flex:1; font-size:11px; padding:4px;">
            <input type="number" class="form-control custom-var-price" placeholder="Price" style="flex:1; font-size:11px; padding:4px;">
        </div>
    `;
    container.appendChild(slot);
}

function addCustomSizePair() {
    const leftList = document.getElementById('custom-size-left-list');
    const rightList = document.getElementById('custom-size-right-list');

    if (!leftList || !rightList) return;

    // Add exactly one empty row to left side
    const lInput = document.createElement('input');
    lInput.type = 'text';
    lInput.className = 'form-control custom-var-size';
    lInput.placeholder = 'e.g. 10Kg';
    leftList.appendChild(lInput);

    // Add corresponding row to right side
    const rDiv = document.createElement('div');
    rDiv.style.display = 'flex';
    rDiv.style.gap = '12px';
    rDiv.className = 'custom-var-row';
    rDiv.innerHTML = `
        <input type="text" class="form-control custom-var-id" placeholder="ID (e.g. BANG-10)">
        <input type="number" class="form-control custom-var-price" placeholder="Price (₹)">
    `;
    rightList.appendChild(rDiv);
}

/**
 * Handles uploading extra (2nd and 3rd) product images to the slot preview.
 */
function handleExtraImageUpload(inputEl, previewId) {
    const file = inputEl.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById(previewId);
        if (!preview) return;
        preview.src = e.target.result;
        preview.style.display = 'block';
        
        // Hide placeholder icon if visible
        const slot = preview.closest('.ap-img-slot');
        if (slot) {
            const placeholder = slot.querySelector('.ap-img-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

/**
 * AUTO-SKU GENERATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Rules:
 *  1. Extract the "base name" from the typed product name by taking the first
 *     meaningful word (ignoring sizes like "3kg", "5kg", "500g", "1L" etc.)
 *     and uppercasing its first 4 letters → abbreviation.
 *
 *  2. Search allProducts for any product whose name starts with the same base
 *     word (case-insensitive). If found and it already has a SKU, return that
 *     same SKU → variants of the same product share one SKU.
 *
 *  3. If no existing match, find the highest existing numeric suffix for this
 *     abbreviation and return the next number, e.g. "BANG-001".
 *
 * Examples:
 *   "Banganapalli 3 Kg"  → base="banganapalli" → abbr="BANG"
 *   existing "Banganapalli 5Kg" already has SKU "BANG-001"
 *   → returns "BANG-001"   (same family)
 *
 *   "Alphonso"           → base="alphonso" → abbr="ALPH"
 *   no existing product  → returns "ALPH-001"
 */
function generateProductSku(name) {
    if (!name || name.trim().length < 2) return '';

    // Strip weight/size tokens from the name to find the real base name
    const sizePattern = /\b(\d+\s*(kg|g|ml|l|pcs|pc|gm|gms|litre|liter))\b/gi;
    const baseName = name.replace(sizePattern, '').trim();

    if (!baseName) return '';

    // Get first meaningful word
    const firstWord = baseName.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '');
    if (!firstWord || firstWord.length < 2) return '';

    const abbr = firstWord.substring(0, 4).toUpperCase();

    // Search existing products for same family
    const existingMatch = allProducts.find(p => {
        if (!p.name) return false;
        const pBaseName = p.name.replace(sizePattern, '').trim();
        const pFirst = pBaseName.split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toUpperCase();
        return pFirst === firstWord.toUpperCase();
    });

    // If a matching product already has a SKU, reuse it (same product family)
    if (existingMatch && existingMatch.sku) {
        return existingMatch.sku;
    }

    // Otherwise find the highest existing number for this abbreviation prefix
    const existingNumbers = allProducts
        .filter(p => p.sku && p.sku.startsWith(abbr + '-'))
        .map(p => {
            const parts = p.sku.split('-');
            return parseInt(parts[parts.length - 1]) || 0;
        });

    const nextNum = existingNumbers.length > 0
        ? Math.max(...existingNumbers) + 1
        : 1;

    return `${abbr}-${String(nextNum).padStart(3, '0')}`;
}

async function editProduct(id) {
    const p = allProducts.find(x => x.id == id);
    if(!p) { showToast('Product not found. Please refresh the page.', 'error'); return; }
    editingProductId = id;

    navigateTo('add-product');

    const form = document.getElementById('product-form');
    if(!form) return;

    await loadCategoryOptions();

    form.elements['name'].value = p.name || '';
    form.elements['category_id'].value = p.category_id || '';
    form.elements['badge'].value = p.badge || '';
    const pType = p.product_type || 'standard';
    form.elements['product_type'].value = pType;
    form.elements['slug'].value = p.slug || '';
    form.elements['description'].value = p.description || '';
    form.elements['image_url'].value = p.image_url || '';
    form.elements['base_price_per_kg'].value = getBasePricePerKg(p) || '';
    form.elements['compare_at_price_per_kg'].value = p.compare_at_price_per_kg || p.original_price || '';
    form.elements['stock_count'].value = p.stock_count || 0;
    form.elements['priority'].value = p.priority ?? 100;
    form.elements['variant_quantities'].value = getProductVariantQuantities(p).join(',') || (typeof p.variant_quantities === 'string' ? p.variant_quantities : '3,5,7,10,15');
    form.elements['in_stock'].checked = !!p.in_stock;
    form.elements['is_active'].checked = p.is_active !== false;
    form.elements['is_featured'].checked = !!p.is_featured;
    form.elements['show_on_home'].checked = !!p.show_on_home;
    form.elements['show_on_shop'].checked = p.show_on_shop !== false;
    
    // Star Rating Fields
    form.elements['rating'].value = p.rating || '5.0';
    form.elements['review_count'].value = p.review    // Load Crate Builder Slots if applicable
    if (pType === 'custom_box') {
        const { data: variants } = await supabaseClient.from('product_variants').select('*').eq('product_id', id).order('id', { ascending: true });
        
        const container = document.getElementById('crate-slots-container');
        if (container && variants && variants.length > 0) {
            const slots = container.querySelectorAll('.crate-slot');
            variants.forEach((v, i) => {
                if (slots[i]) {
                    const idInput = slots[i].querySelector('.custom-var-id');
                    const sizeInput = slots[i].querySelector('.custom-var-size');
                    const priceInput = slots[i].querySelector('.custom-var-price');
                    
                    if (idInput) idInput.value = v.sku || '';
                    if (sizeInput) sizeInput.value = v.label || '';
                    if (priceInput) priceInput.value = v.price || '';
                }
            });
        }
    }

    const preview = document.getElementById('img-preview');
    if(preview) preview.src = p.image_url || 'https://placehold.co/200x200/f1f5f9/94a3b8?text=Upload';

    document.getElementById('pm-title').innerText = 'Edit Product: ' + p.name;
    document.getElementById('save-product-btn').innerHTML = '<i class="ph ph-floppy-disk"></i> Update Product';
    
    // Trigger product type UI update
    handleProductTypeChange(pType);
    refreshVariantPreview();
}

async function saveProduct(event) {
    event.preventDefault();
    const form = document.getElementById('product-form');
    const productType = form.elements['product_type']?.value || 'standard';

    let variantQuantities = [];
    let customVariantPayload = null;
    let basePricePerKg = 0;
    let compareAtPerKg = 0;

    if (productType === 'custom_box') {
        const container = document.getElementById('section-crate-builder');
        const sizeInputs = container?.querySelectorAll('.custom-var-size') || [];
        const idInputs = container?.querySelectorAll('.custom-var-id') || [];
        const priceInputs = container?.querySelectorAll('.custom-var-price') || [];
        
        customVariantPayload = [];
        sizeInputs.forEach((input, i) => {
            const label = input.value.trim();
            if (label) {
                customVariantPayload.push({
                    label: label,
                    sku: idInputs[i]?.value?.trim() || null,
                    price: parseFloat(priceInputs[i]?.value) || 0
                });
                variantQuantities.push(label);
            }
        });
    } else {
        variantQuantities = parseVariantQuantities(form.elements['variant_quantities']?.value || '3,5,7,10,15');
        basePricePerKg = parseFloat(form.elements['base_price_per_kg']?.value || 0);
        compareAtPerKg = parseFloat(form.elements['compare_at_price_per_kg']?.value || 0);

        if (productType !== 'multi' && (!basePricePerKg || basePricePerKg <= 0)) {
            showToast('Please enter a valid Base Price Per Kg', 'warning');
            return;
        }
    }

    const defaultVariantQty = parseFloat(variantQuantities[0]) || 1;
    const defaultPrice    = customVariantPayload ? customVariantPayload[0].price : calculateVariantPrice(basePricePerKg, defaultVariantQty);
    const defaultOldPrice = (customVariantPayload || compareAtPerKg <= 0) ? null : calculateVariantPrice(compareAtPerKg, defaultVariantQty);

    const obj = {
        name:                    form.elements['name'].value.trim(),
        category_id:             parseInt(form.elements['category_id'].value) || null,
        badge:                   form.elements['badge']?.value || null,
        product_type:            productType,
        slug:                    form.elements['slug'].value.trim(),
        description:             form.elements['description']?.value || null,
        image_url:               form.elements['image_url']?.value || null,
        base_price:              basePricePerKg,
        base_price_per_kg:       basePricePerKg,
        compare_at_price_per_kg: compareAtPerKg || null,
        available_weights:       variantQuantities,
        variant_quantities:      variantQuantities.join(','),
        price:                   defaultPrice,
        original_price:          defaultOldPrice,
        stock_count:             parseInt(form.elements['stock_count'].value) || 0,
        priority:                parseInt(form.elements['priority'].value) || 100,
        in_stock:                form.elements['in_stock'].checked,
        is_active:               form.elements['is_active'].checked,
        is_featured:             form.elements['is_featured'].checked,
        show_on_home:            form.elements['show_on_home'].checked,
        show_on_shop:            form.elements['show_on_shop'].checked,
        rating:                  parseFloat(form.elements['rating'].value) || 5.0,
        review_count:            parseInt(form.elements['review_count'].value) || 0,
        harvest_journey:         form.elements['harvest_journey']?.value || null,
        about_item:              form.elements['about_item']?.value || null,
        sku:                     form.elements['sku']?.value?.trim() || null,
        updated_at:              new Date().toISOString()
    };

    try {
        const btn = document.getElementById('save-product-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-circle-notch spinner"></i> Saving...';

        const { data, error } = await saveProductRecordWithFallback(obj, editingProductId);
        if (error) throw error;

        const productId = data[0].id;
        
        // Pass the appropriate data to saveProductVariants
        await saveProductVariants(productId, customVariantPayload || obj.variant_quantities, {
            basePricePerKg,
            compareAtPerKg
        });

        await touchProductCatalogSync(productId);
        
        if (obj.category_id === 10) {
            const varietyName = obj.name.split(' ')[0];
            await syncVarietyPrices(varietyName, basePricePerKg, compareAtPerKg, obj.image_url);
        } else if (obj.sku) {
            await syncSameNamedProducts(obj.sku, obj.image_url);
        }

        showToast(editingProductId ? 'Product Updated! 🥭' : 'New Product Added! 🥭');
        navigateTo('all-products');
        renderProducts();
    } catch (err) {
        console.error(err);
        showToast('Error saving product: ' + err.message, 'error');
    } finally {
        const btn = document.getElementById('save-product-btn');
        btn.disabled = false;
        btn.innerText = editingProductId ? 'Update Product' : 'Save Product';
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
    renderCorpOrders();
    setupChart();
    renderProductReport();
    renderCODReport();
    
    // Check for order_id in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const orderIdParam = urlParams.get('order_id');
    if(orderIdParam) {
        setTimeout(() => searchByOrderId(orderIdParam), 1500); // Small delay to let admin auth/load finish
    }
    
    // --- Realtime Subscriptions ---
    supabaseClient
        .channel('order-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            console.log('New order detected:', payload.new);
            showToast('New Order Received! 🚀', 'success');
            renderDashboard();
            renderOrders();
            renderCODReport();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'corporate_orders' }, payload => {
            showToast('New Corporate Enquiry! 🏢', 'success');
            const badge = document.getElementById('corp-badge');
            if (badge) badge.style.display = 'inline-block';
            renderCorpOrders();
        })
        .subscribe();

    const pnInput = document.getElementById('product-name-input');
    if(pnInput) {
        pnInput.addEventListener('input', (e) => {
            const nameVal = e.target.value;

            // Auto-generate slug
            const slugInput = document.querySelector('#product-form input[name="slug"]');
            if(slugInput) {
                slugInput.value = nameVal
                    .toLowerCase()
                    .trim()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/[\s_-]+/g, '-')
                    .replace(/^-+|-+$/g, '');
            }

            // Auto-generate SKU (only if not editing and field is empty or was auto-set)
            const skuInput = document.querySelector('#product-form input[name="sku"]');
            if (skuInput && !editingProductId) {
                const generatedSku = generateProductSku(nameVal);
                if (generatedSku && skuInput.value !== generatedSku) {
                    skuInput.value = generatedSku;
                    // Flash green to show it was auto-filled
                    skuInput.classList.remove('sku-autofilled');
                    void skuInput.offsetWidth; // reflow to restart animation
                    skuInput.classList.add('sku-autofilled');
                }
            }
        });
    }

    const skuInput = document.getElementById('sku-input');
    if(skuInput) {
        let lastCheckedSku = '';
        skuInput.addEventListener('input', async (e) => {
            const typedSku = e.target.value.trim().toUpperCase();
            if(!typedSku || typedSku.length < 3 || editingProductId || typedSku === lastCheckedSku) return;
            
            // Check if SKU exists in local cache
            const existing = allProducts.find(p => p.sku && p.sku.toUpperCase() === typedSku);
            if(existing) {
                lastCheckedSku = typedSku;
                const choice = await showConfirm(
                    "Product ID Found", 
                    `This ID (${typedSku}) belongs to "${existing.name}". Load its details to update?`,
                    "Load Product Details",
                    "#2d6a4f"
                );
                if(choice) {
                    editProduct(existing.id);
                }
            }
        });
    }

    // Also check Option Product IDs in the custom variants list (enhanced with autocomplete)
    document.addEventListener('input', async (e) => {
        if(e.target.classList.contains('custom-var-id')) {
            const input = e.target;
            const typedSku = input.value.trim().toUpperCase();
            
            // Remove existing dropdown if any
            const existingDropdown = document.getElementById('sku-autocomplete-list');
            if(existingDropdown) existingDropdown.remove();

            if(!typedSku || typedSku.length < 2) return;

            const matches = allProducts.filter(p => 
                (p.sku && p.sku.toUpperCase().includes(typedSku)) || 
                (p.name && p.name.toUpperCase().includes(typedSku))
            ).slice(0, 5); // Limit to 5 results

            if(matches.length > 0) {
                const dropdown = document.createElement('div');
                dropdown.id = 'sku-autocomplete-list';
                dropdown.style.cssText = `
                    position: absolute;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    z-index: 1000;
                    width: ${input.offsetWidth}px;
                    max-height: 200px;
                    overflow-y: auto;
                `;
                
                const rect = input.getBoundingClientRect();
                dropdown.style.top = (window.scrollY + rect.bottom + 5) + 'px';
                dropdown.style.left = (window.scrollX + rect.left) + 'px';

                matches.forEach(p => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        padding: 8px 12px;
                        cursor: pointer;
                        border-bottom: 1px solid #f8fafc;
                        font-size: 13px;
                    `;
                    item.innerHTML = `
                        <div style="font-weight:700; color:#1e293b;">${p.sku || '-'}</div>
                        <div style="font-size:11px; color:#64748b;">${p.name} (₹${p.base_price || 0})</div>
                    `;
                    item.onclick = () => {
                        input.value = p.sku;
                        const row = input.closest('.custom-var-row');
                        const priceInput = row?.querySelector('.custom-var-price');
                        if(priceInput) priceInput.value = p.base_price || 0;
                        dropdown.remove();
                        showToast(`Selected ${p.name}`, 'info');
                    };
                    item.onmouseover = () => item.style.background = '#f1f5f9';
                    item.onmouseout = () => item.style.background = 'white';
                    dropdown.appendChild(item);
                });

                document.body.appendChild(dropdown);
            }
        }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if(!e.target.classList.contains('custom-var-id')) {
            document.getElementById('sku-autocomplete-list')?.remove();
        }
    });

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

    const basePriceInput = document.querySelector('#product-form input[name="base_price_per_kg"]');
    const variantInput = document.querySelector('#product-form input[name="variant_quantities"]');
    if (basePriceInput) basePriceInput.addEventListener('input', refreshVariantPreview);
    if (variantInput) variantInput.addEventListener('input', refreshVariantPreview);
    refreshVariantPreview();

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
    const { data: existingReview } = await supabaseClient.from('reviews').select('product_id').eq('id', id).single();
    const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
    if(error) showToast("Error deleting: " + error.message, 'error');
    else {
        try {
            await syncProductRatingSummary(existingReview?.product_id);
        } catch (syncError) {
            console.warn('Rating sync failed after delete', syncError);
        }
        showToast("Review deleted successfully 🗑️");
        renderReviews();
        renderProducts();
    }
}

const reviewForm = document.getElementById('review-form');
if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-review-id').value;
        let previousProductId = null;
        if (id) {
            const { data: existingReview } = await supabaseClient.from('reviews').select('product_id').eq('id', id).single();
            previousProductId = existingReview?.product_id ?? null;
        }

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
            try {
                await syncProductRatingSummary(obj.product_id);
                if (previousProductId && previousProductId !== obj.product_id) {
                    await syncProductRatingSummary(previousProductId);
                }
            } catch (syncError) {
                console.warn('Rating sync failed after review save', syncError);
            }
            showToast("Review saved successfully ✅");
            closeModal('reviewModal');
            renderReviews();
            renderProducts();
        }
    });
}

// --- Image Upload & Compression ---
async function handleFileUpload(input, targetInputNameOrId, previewId) {
    const file = input.files[0];
    if(!file) return;

    const preview = document.getElementById(previewId);

    // Show uploading state on the image preview slot
    if(preview) {
        const slot = preview.closest('.ap-img-slot');
        if(slot) {
            slot.classList.add('ap-img-uploading');
            slot.querySelector('.ap-img-overlay')?.remove();
            const uploading = document.createElement('div');
            uploading.className = 'ap-img-overlay ap-img-uploading-overlay';
            uploading.innerHTML = '<i class="ph ph-circle-notch spinner"></i><span>Uploading...</span>';
            uploading.style.cssText = 'opacity:1; background:rgba(45,106,79,0.75);';
            slot.appendChild(uploading);
        }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            // Compress using Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

            // Update the hidden URL input field
            const target = document.querySelector(`input[name="${targetInputNameOrId}"]`) || document.getElementById(targetInputNameOrId);
            if(target) {
                target.value = dataUrl;
                target.dispatchEvent(new Event('input'));
            }

            // Update preview
            if(preview) {
                preview.src = dataUrl;
                preview.style.display = 'block';
                // Remove uploading overlay, restore hover overlay
                const slot = preview.closest('.ap-img-slot');
                if(slot) {
                    slot.classList.remove('ap-img-uploading');
                    const uploadingOverlay = slot.querySelector('.ap-img-uploading-overlay');
                    if(uploadingOverlay) uploadingOverlay.remove();
                }
            }

            // ─── AUTO-SAVE to DB if editing an existing product ──────────────
            if(editingProductId && targetInputNameOrId === 'image_url') {
                try {
                    showToast('Saving image to product...', 'info');

                    const { error } = await supabaseClient
                        .from('products')
                        .update({ image_url: dataUrl, updated_at: new Date().toISOString() })
                        .eq('id', editingProductId);

                    if(error) throw error;

                    // Sync with other products that have the same SKU (family variants)
                    const currentProduct = allProducts.find(p => p.id == editingProductId);
                    if(currentProduct && currentProduct.sku) {
                        await syncSameNamedProducts(currentProduct.sku, dataUrl);
                    }

                    // Update local cache (for all products with this SKU)
                    allProducts.forEach(p => {
                        if (currentProduct && p.sku === currentProduct.sku) {
                            p.image_url = dataUrl;
                        }
                    });

                    showToast('✅ Image updated! All variants synced.', 'success');
                    renderProducts(); // Refresh the table instantly
                } catch(err) {
                    console.error('Image save error:', err);
                    showToast('Image loaded but not saved — click Save Product to apply.', 'warning');
                }
            } else {
                showToast('Image ready 🖼️ — click Save Product to apply.');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================================
// CORPORATE ORDERS MODULE
// ============================================================

let allCorpOrders = [];
let viewingCorpOrderId = null;

const corpStatusColors = {
    new:       { bg: '#fef3c7', text: '#92400e' },
    contacted: { bg: '#e0f2fe', text: '#075985' },
    confirmed: { bg: '#dcfce7', text: '#166534' },
    fulfilled: { bg: '#d1fae5', text: '#065f46' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' }
};

function corpStatusBadge(status) {
    const s = (status || 'new').toLowerCase();
    const colors = {
        new:       { bg: '#FEF3C7', text: '#92400E' },
        contacted: { bg: '#DBEAFE', text: '#1E40AF' },
        confirmed: { bg: '#D1FAE5', text: '#065F46' },
        fulfilled: { bg: '#E0E7FF', text: '#3730A3' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' }
    };
    const c = colors[s] || colors.new;
    return `<span style="background:${c.bg};color:${c.text};padding:6px 12px;border-radius:99px;font-size:0.7rem;font-weight:800;text-transform:uppercase;">${s}</span>`;
}

async function renderCorpOrders() {
    showLoading('corp-orders-tbody');
    try {
        const { data, error } = await supabaseClient
            .from('corporate_orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        allCorpOrders = data || [];

        const badge = document.getElementById('corp-badge');
        const hasNew = allCorpOrders.some(o => o.status === 'new');
        if (badge) badge.style.display = hasNew ? 'inline-block' : 'none';

        buildCorpTable(allCorpOrders);
    } catch(err) {
        showToast('Error loading corporate orders: ' + err.message, 'error');
        console.error(err);
    }
}

function buildCorpTable(orders) {
    const tbody = document.getElementById('corp-orders-tbody');
    if (!tbody) return;
    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8">
            <i class="ph ph-buildings" style="font-size:2.5rem;display:block;margin-bottom:10px;color:#d1d5db;"></i>
            No corporate enquiries yet.<br>
            <span style="font-size:0.82rem">They appear here when companies submit from the website portal.</span>
        </td></tr>`;
        return;
    }
    tbody.innerHTML = orders.map(o => {
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'2-digit'}) : '-';
        const mixParts = [];
        if (o.imam_qty) mixParts.push(`Imam: ${o.imam_qty}kg`);
        if (o.alph_qty) mixParts.push(`Alph: ${o.alph_qty}kg`);
        if (o.bang_qty) mixParts.push(`Bang: ${o.bang_qty}kg`);
        if (o.sent_qty) mixParts.push(`Sent: ${o.sent_qty}kg`);
        const mix = mixParts.length ? mixParts.join(' / ') : 'Standard Mix';
        return `<tr>
            <td style="font-size:0.8rem;color:#64748b;font-family:monospace;font-weight:700">${o.enquiry_ref || '#' + o.id}</td>
            <td><strong>${o.company_name || '-'}</strong></td>
            <td>${o.contact_person || '-'}<br><span style="font-size:0.78rem;color:#94a3b8">${o.contact_phone || o.phone || ''}</span></td>
            <td><span style="background:#f0fdf4;color:#166534;padding:3px 9px;border-radius:8px;font-size:0.78rem;font-weight:700">${o.crate_size}kg</span></td>
            <td style="font-size:0.82rem;color:#475569">${mix}</td>
            <td><strong>${o.total_units || 15}</strong></td>
            <td>${corpStatusBadge(o.status)}</td>
            <td style="font-size:0.8rem;color:#64748b">${date}</td>
            <td>
                <div style="display:flex;gap:6px">
                    <button class="action-btn" title="View Details" onclick="viewCorpOrder('${o.id}')"><i class="ph ph-eye"></i></button>
                    <button class="action-btn btn-delete" title="Delete" onclick="deleteCorpOrder('${o.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterCorpOrders(q) {
    const statusFilter = document.getElementById('corp-status-filter') ? document.getElementById('corp-status-filter').value : '';
    q = (q || '').toLowerCase();
    let filtered = allCorpOrders;
    if (statusFilter) filtered = filtered.filter(o => o.status === statusFilter);
    if (q) filtered = filtered.filter(o =>
        (o.enquiry_ref || '').toLowerCase().includes(q) ||
        (o.company_name || '').toLowerCase().includes(q) ||
        (o.contact_person || '').toLowerCase().includes(q) ||
        (o.phone || '').includes(q)
    );
    buildCorpTable(filtered);
}

function viewCorpOrder(id) {
    const o = allCorpOrders.find(x => String(x.id) === String(id));
    if (!o) return;
    viewingCorpOrderId = id;

    const body = document.getElementById('corp-detail-body');
    const statusSel = document.getElementById('corp-status-select');

    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Reference / Company</div>
                <div style="font-weight:700;font-size:1.1rem">${o.company_name || '-'}</div>
                <div style="font-size:0.85rem;color:#64748b;font-family:monospace">${o.enquiry_ref || '#' + o.id}</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Contact</div>
                <div>${o.contact_person || 'N/A'}</div>
                <div style="color:#64748b;font-size:0.85rem">${o.contact_phone || o.phone || ''} ${o.contact_email || o.email ? '· ' + (o.contact_email || o.email) : ''}</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Crate Size</div>
                <div><strong>${o.crate_size} KG</strong> — ${o.crate_size == 3 ? '3kg Elite' : '5kg Grand'}</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mango Mix</div>
                <div>Imam Pasand: <strong>${o.imam_qty || 0} kg</strong></div>
                <div>Alphonso: <strong>${o.alph_qty || 0} kg</strong></div>
                <div>Banganapalli: <strong>${o.bang_qty || 0} kg</strong></div>
                <div>Senthura: <strong>${o.sent_qty || 0} kg</strong></div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Units</div>
                <div><strong>${o.total_units || 15}</strong> crates (MOQ 15)</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Pricing</div>
                <div style="font-weight:700;font-size:1.1rem;color:var(--primary)">₹${(o.total_amount || 0).toLocaleString('en-IN')}</div>
                <div style="font-size:0.75rem;color:#64748b">Estimated Total</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Submitted On</div>
                <div style="font-size:0.88rem">${o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : '-'}</div>
            </div>
        </div>
        ${o.heritage_message ? `
        <div style="background:#fdfcf0;border-left:4px solid #d4af37;border-radius:8px;padding:16px;margin-bottom:16px">
            <div style="font-size:0.75rem;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Heritage Card Message</div>
            <div style="font-style:italic;color:#44403c">"${o.heritage_message}"</div>
        </div>` : ''}
        ${o.notes ? `
        <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:16px">
            <div style="font-size:0.75rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Internal Notes</div>
            <div>${o.notes}</div>
        </div>` : ''}
    `;

    if (statusSel) statusSel.value = o.status || 'new';
    openModal('corpDetailModal');
}

async function updateCorpStatus() {
    if (!viewingCorpOrderId) return;
    const status = document.getElementById('corp-status-select').value;
    try {
        const { error } = await supabaseClient
            .from('corporate_orders')
            .update({ status })
            .eq('id', viewingCorpOrderId);
        if (error) throw error;
        showToast('Status updated successfully');
        closeModal('corpDetailModal');
        renderCorpOrders();
    } catch(err) {
        showToast('Error updating status: ' + err.message, 'error');
    }
}

function sendCorpQuotation() {
    if(!viewingCorpOrderId) return;
    const o = allCorpOrders.find(x => String(x.id) === String(viewingCorpOrderId));
    if(!o) return;

    const phone = o.contact_phone || o.phone || '';
    if(!phone) {
        showToast("No phone number found", "error");
        return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const mix = [];
    if (o.imam_qty) mix.push(`• Imam Pasand: ${o.imam_qty}kg`);
    if (o.alph_qty) mix.push(`• Alphonso: ${o.alph_qty}kg`);
    if (o.bang_qty) mix.push(`• Banganapalli: ${o.bang_qty}kg`);
    if (o.sent_qty) mix.push(`• Senthura: ${o.sent_qty}kg`);

    const msg = `*Quotation: Farmmily Corporate Gifting* 🏢🥭

*Company:* ${o.company_name}
*Enquiry Ref:* ${o.enquiry_ref || '#' + o.id}

*Order Details:*
----------------------------
*Crate Size:* ${o.crate_size}kg Box
*Total Units:* ${o.total_units} Crates
*Mango Mix (per box):*
${mix.length ? mix.join('\n') : '• Heritage Selection Mix'}

*Pricing Summary:*
*ESTIMATED TOTAL:* ₹${(o.total_amount || 0).toLocaleString('en-IN')}
----------------------------
${o.heritage_message ? `*Heritage Card Msg:* "${o.heritage_message}"\n` : ''}
*Status:* ${o.status.toUpperCase()}

Namaste! 🙏 We are ready to harvest this special batch for your team. Please let us know if you have any adjustments.

*Farmmily Estate Team* 🍃`;
    
    const url = `https://wa.me/${cleanPhone.length === 10 ? '91'+cleanPhone : cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

async function saveCorpOrder() {
    const form = document.getElementById('corp-order-form');
    if (!form) return;
    const company = form.elements['company_name'].value.trim();
    if (!company) { showToast('Company name is required', 'warning'); return; }

    const obj = {
        company_name: company,
        contact_person: form.elements['contact_person']?.value?.trim() || '',
        contact_phone: form.elements['phone']?.value?.trim() || '',
        contact_email: form.elements['email']?.value?.trim() || '',
        phone: form.elements['phone']?.value?.trim() || '', // Keep for backward compatibility
        email: form.elements['email']?.value?.trim() || '', // Keep for backward compatibility
        crate_size: parseInt(form.elements['crate_size'].value),
        total_units: parseInt(form.elements['total_units'].value) || 15,
        imam_qty: parseInt(form.elements['imam_qty'].value) || 0,
        alph_qty: parseInt(form.elements['alph_qty'].value) || 0,
        bang_qty: parseInt(form.elements['bang_qty']?.value) || 0,
        sent_qty: parseInt(form.elements['sent_qty']?.value) || 0,
        heritage_message: form.elements['heritage_message'].value.trim(),
        notes: form.elements['notes'].value.trim(),
        enquiry_ref: 'CE-' + Math.floor(1000000 + Math.random() * 9000000),
        status: 'new'
    };

    const pricing = calculateCorporateOrderAmount(obj);
    if (pricing.totalKg !== obj.crate_size) {
        showToast(`The selected mango mix totals ${pricing.totalKg}kg. It must match the crate size of ${obj.crate_size}kg.`, 'warning');
        return;
    }

    if (pricing.pricePerCrate <= 0) {
        showToast('Unable to calculate crate pricing from current product prices. Please ensure mango products have a base price per kg.', 'warning');
        return;
    }

    obj.total_amount = pricing.totalAmount;

    try {
        const { error } = await supabaseClient.from('corporate_orders').insert([obj]);
        if (error) throw error;
        showToast('Corporate enquiry saved');
        closeModal('corpOrderModal');
        form.reset();
        renderCorpOrders();
    } catch(err) {
        showToast('Error saving: ' + err.message, 'error');
    }
}

async function deleteCorpOrder(id) {
    if (!await showConfirm('Delete Enquiry?', 'Are you sure you want to remove this corporate enquiry?', 'Delete', '#ef4444')) return;
    try {
        const { error } = await supabaseClient.from('corporate_orders').delete().eq('id', id);
        if (error) throw error;
        showToast('Enquiry deleted');
        renderCorpOrders();
    } catch(err) {
        showToast('Error deleting: ' + err.message, 'error');
    }
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

function setupRealtime() {
    // Sync Products & Stock
    supabaseClient.channel('public:products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
            if(payload.eventType === 'UPDATE' && payload.new.stock_count <= 5) {
                pushNotification(`Critical Low Stock: ${payload.new.name} (${payload.new.stock_count} left)`, 'error');
            }
            const pageEl = document.querySelector('.page.active');
            if(!pageEl) return;
            const page = pageEl.id;
            if(page === 'page-all-products') renderProducts();
            if(page === 'page-inventory') renderInventory();
            if(page === 'page-dashboard') renderDashboard();
        }).subscribe();

    // Sync Orders
    supabaseClient.channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            if(payload.eventType === 'INSERT') {
                pushNotification(`New Order #${payload.new.order_number || payload.new.id.toString().substring(0,8)} received!`, 'success');
            }
            const pageEl = document.querySelector('.page.active');
            if(!pageEl) return;
            const page = pageEl.id;
            if(page === 'page-all-orders') renderOrders();
            if(page === 'page-dashboard') renderDashboard();
        }).subscribe();

    // Sync Corporate Orders
    supabaseClient.channel('public:corporate_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'corporate_orders' }, payload => {
            if(payload.eventType === 'INSERT') {
                pushNotification(`New Corporate Enquiry: ${payload.new.company_name}`, 'warning');
                showToast('New Corporate Enquiry Received! 🏢', 'warning');
                const badge = document.getElementById('corp-badge');
                if(badge) badge.style.display = 'inline-block';
            }
            const pageEl = document.querySelector('.page.active');
            if(!pageEl) return;
            const page = pageEl.id;
            if(page === 'page-corporate') renderCorpOrders();
            if(page === 'page-dashboard') renderDashboard();
        }).subscribe();
    // Sync Settings
    supabaseClient.channel('public:store_settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
            const pageEl = document.querySelector('.page.active');
            if(pageEl && pageEl.id === 'page-delivery') renderDelivery();
        }).subscribe();
}

// --- Notification Logic ---
function pushNotification(msg, type = 'info') {
    // Avoid duplicate rapid-fire notifications
    const last = notifications[0];
    if(last && last.msg === msg && (Date.now() - last.time < 5000)) return;

    notifications.unshift({ msg, type, time: Date.now(), read: false });
    if(notifications.length > 20) notifications.pop();
    updateNotifUI();
}

function updateNotifUI() {
    const dot = document.getElementById('notif-dot');
    const list = document.getElementById('notif-list');
    if(!dot || !list) return;

    const unread = notifications.filter(n => !n.read).length;
    dot.style.display = unread > 0 ? 'block' : 'none';

    if(notifications.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8; font-size:0.85rem;">No new alerts</div>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div style="padding:12px 15px; border-bottom:1px solid #f1f5f9; display:flex; gap:10px; align-items:flex-start; ${n.read ? 'opacity:0.7' : 'background:#f8fafc'}">
            <div style="width:8px; height:8px; border-radius:50%; background:${getNotifColor(n.type)}; margin-top:5px; flex-shrink:0;"></div>
            <div>
                <div style="font-size:0.8rem; color:var(--text-main); font-weight:${n.read ? '500' : '700'}; line-height:1.4;">${n.msg}</div>
                <div style="font-size:0.65rem; color:#94a3b8; margin-top:4px;">${formatNotifTime(n.time)}</div>
            </div>
        </div>
    `).join('');
}

function getNotifColor(type) {
    if(type === 'success') return '#22c55e';
    if(type === 'error') return '#ef4444';
    if(type === 'warning') return '#f59e0b';
    return '#3b82f6';
}

function formatNotifTime(time) {
    const diff = Math.floor((Date.now() - time) / 1000);
    if(diff < 60) return 'Just now';
    if(diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toggleNotifications(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    if(!dropdown) return;
    
    const isShowing = dropdown.style.display === 'block';
    dropdown.style.display = isShowing ? 'none' : 'block';
    
    if(!isShowing) {
        notifications.forEach(n => n.read = true);
        updateNotifUI();
        
        // Close on click outside
        const closer = () => {
            dropdown.style.display = 'none';
            window.removeEventListener('click', closer);
        };
        setTimeout(() => window.addEventListener('click', closer), 10);
    }
}

function clearNotifications(e) {
    e.stopPropagation();
    notifications = [];
    updateNotifUI();
    const dropdown = document.getElementById('notif-dropdown');
    if(dropdown) dropdown.style.display = 'none';
}

async function printInvoice() {
    if(!currentModalOrder) return;
    const o = currentModalOrder;
    
    // Populate template
    const rawNum = o.order_number ? o.order_number.replace(/\D/g, '') : o.id.toString().substring(0,4);
    const displayNum = `INV-FF-2026/27-${rawNum.toString().padStart(4, '0')}`;
    document.getElementById('inv-num').innerText = `Invoice: ${displayNum}`;
    
    const orderDate = new Date(o.created_at);
    document.getElementById('inv-date').innerText = orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('inv-cust-name').innerText = (o.display_name || o.customer_name || 'Guest').toUpperCase();
    
    // Address & POS
    let addr = '';
    if (o.address && typeof o.address === 'object') {
        const a = o.address;
        addr = `${a.address_line || ''}, ${a.city || ''}, ${a.state || ''} ${a.pincode ? '- ' + a.pincode : ''}`.replace(/^, /, '').trim();
    } else {
        addr = o.address_text || o.address_line || (typeof o.address === 'string' ? o.address : '') || 'No address provided';
    }
    
    // Formatting: remove Map link part if it exists in the string
    if(addr.includes('(Map:')) addr = addr.split('(Map:')[0].trim().replace(/,$/, '');
    
    document.getElementById('inv-cust-addr').innerText = addr;

    // For simplicity, check if TN is in address
    const isLocal = addr.toLowerCase().includes('tamil nadu') || addr.toLowerCase().includes('tn') || addr.includes('33');
    document.getElementById('inv-cust-pos').innerText = isLocal ? 'Tamil Nadu (33)' : 'Interstate';
    
    // Items
    const tbody = document.getElementById('inv-items-body');
    const { data: items } = await supabaseClient.from('order_items').select('*').eq('order_id', o.id);
    
    let totalTaxable = 0;
    let totalIGST = 0;
    if(items && items.length > 0) {
        tbody.innerHTML = items.map((i, index) => {
            const hsn = i.product_name.toLowerCase().includes('honey') ? '040900' : '080450'; 
            const itemTaxable = parseFloat((i.total_price / 1.05).toFixed(2));
            const itemIGST = parseFloat((i.total_price - itemTaxable).toFixed(2));
            const unitTaxable = parseFloat((i.unit_price / 1.05).toFixed(2));
            
            totalTaxable += itemTaxable;
            totalIGST += itemIGST;

            return `
                <tr style="border-bottom:1px solid #eee">
                    <td style="padding:10px; text-align:left;">${index + 1}</td>
                    <td style="padding:10px; text-align:left;">
                        <div style="font-weight:700;">${i.product_name}</div>
                        <div style="font-size:11px; color:#888;">${i.weight ? `Weight: ${i.weight}` : ''}</div>
                    </td>
                    <td style="padding:10px; text-align:left;">${hsn}</td>
                    <td style="padding:10px; text-align:center;">${i.quantity}</td>
                    <td style="padding:10px; text-align:right;">${unitTaxable.toFixed(2)}</td>
                    <td style="padding:10px; text-align:right;">${itemIGST.toFixed(2)}<br><small style="color:#888;font-size:9px;">5%</small></td>
                    <td style="padding:10px; text-align:right;">${itemTaxable.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px">No items found</td></tr>';
        totalTaxable = o.total / 1.05;
        totalIGST = o.total - totalTaxable;
    }

    const grandTotal = parseFloat(o.total);
    
    // Summary
    const sub_disp = document.getElementById('inv-subtotal');
    if(sub_disp) sub_disp.innerText = totalTaxable.toFixed(2);
    const taxable_disp = document.getElementById('inv-taxable');
    if(taxable_disp) taxable_disp.innerText = totalTaxable.toFixed(2);
    const tax_val = document.getElementById('inv-tax');
    if(tax_val) tax_val.innerText = totalIGST.toFixed(2);
    const total_disp = document.getElementById('inv-total-disp');
    if(total_disp) total_disp.innerText = `₹${grandTotal.toFixed(2)}`;
    const words_disp = document.getElementById('inv-words');
    if(words_disp) words_disp.innerText = numberToWords(grandTotal);

    // Print
    const content = document.getElementById('invoice-template').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>&nbsp;</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    @page { margin: 0; size: auto; }
                    html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: 'Inter', sans-serif; }
                    @media print {
                        body { padding: 20mm; }
                        header, footer { display: none !important; }
                    }
                    * { box-sizing: border-box; }
                </style>
            </head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 800);
}

function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convert(n) {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return '';
  }

  if (num === 0) return 'Zero';
  let words = 'Indian Rupee ' + convert(Math.floor(num)) + ' Only';
  return words;
}

async function sendInvoice() {
    if(!currentModalOrder) return;
    const o = currentModalOrder;
    const phone = o.phone || (o.address ? o.address.phone : '') || '';
    if(!phone) {
        showToast("No phone number found for this customer", "error");
        return;
    }

    showToast("Generating itemized invoice message...", "info");
    
    // Fetch items for the breakdown
    const { data: items } = await supabaseClient.from('order_items').select('*').eq('order_id', o.id);
    
    let itemText = '';
    if(items && items.length > 0) {
        itemText = items.map(i => `• ${i.product_name} ${i.weight ? `(${i.weight})` : ''} x ${i.quantity} = ₹${i.total_price}`).join('\n');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const orderRef = o.order_number || o.id.toString().substring(0,8).toUpperCase();
    
    const msg = `*Namaste!* 🙏 

Your order *#${orderRef}* from *Farmmily Farms* is confirmed and being processed! 🥭🍃

*INV-SUMMARY:*
----------------------------
${itemText || 'Order Summary: ₹' + o.total}
----------------------------
*Subtotal:* ₹${o.subtotal || o.total - (o.delivery_charge || 0)}
*Delivery:* ${o.delivery_charge > 0 ? '₹'+o.delivery_charge : 'FREE'}
*TOTAL AMOUNT:* ₹${o.total}

*Payment Status:* ${o.payment_status?.toUpperCase() || 'PAID'}
*Delivery Status:* ${o.status.toUpperCase()}

📄 *View Digital Invoice & Track:*
https://farmmily.web.app/track?id=${o.id}

Thank you for choosing heritage harvests and supporting natural farming! 🚜✨`;
    
    const url = `https://wa.me/${cleanPhone.length === 10 ? '91'+cleanPhone : cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// Start Setup
checkAuth(); 
setupRealtime();
loadCategoryOptions(); 


async function syncVarietyPrices(varietyName, basePrice, compareAt, imageUrl) {
    console.log(`Syncing prices for variety: ${varietyName} -> ₹${basePrice}/kg`);
    try {
        const { data: cousins, error } = await supabaseClient
            .from('products')
            .select('id, name, available_weights')
            .eq('category_id', 10);
            
        if (error) throw error;
        
        const matches = (cousins || []).filter(c => c.name.startsWith(varietyName));
        
        for (const p of matches) {
            const weights = p.available_weights || [3,5,7,10,15];
            const defaultWeight = weights[0] || 3;
            
            const newPrice = Math.round(basePrice * defaultWeight);
            const newOldPrice = compareAt > 0 ? Math.round(compareAt * defaultWeight) : null;
            
            const updatePayload = {
                base_price: basePrice,
                base_price_per_kg: basePrice,
                compare_at_price_per_kg: compareAt || null,
                price: newPrice,
                original_price: newOldPrice,
                image_url: imageUrl,
                updated_at: new Date().toISOString()
            };
            
            await supabaseClient.from('products').update(updatePayload).eq('id', p.id);
            
            if (typeof saveProductVariants === 'function') {
                await saveProductVariants(p.id, weights.join(','), {
                    basePricePerKg: basePrice,
                    compareAtPerKg: compareAt
                });
            }
        }
    } catch (err) {
        console.error(`Variety sync failed:`, err);
    }
}

async function syncSameNamedProducts(sku, imageUrl) {
    if (!sku || !imageUrl) return;
    console.log(`Syncing images for all products with SKU: ${sku}`);
    try {
        const { error } = await supabaseClient
            .from('products')
            .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
            .eq('sku', sku);
        if (error) throw error;
    } catch (err) {
        console.error("Same-SKU product sync failed:", err);
    }
}

function checkAuth() {
    if (localStorage.getItem('adminLoggedIn') !== 'true') {
        const path = window.location.pathname;
        if (!path.includes('index.html') && path !== '/' && path !== '') {
             window.location.href = '/';
        }
    }
}
