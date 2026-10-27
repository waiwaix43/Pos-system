const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const compression = require('compression');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'd8537908239a461fdae853f8410e561662d5c0226cd3f283da9661eaa9e73945';
const db = require('./db'); // Supabase client
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { syncInventoryNotification, createNotification, encodeInventoryExpiry, decodeInventoryExpiry, addInventoryExpiryBatch, deductInventoryExpiryBatch, formatThaiDate } = require('./notificationService');

const { getCachedShopSettings, invalidateShopSettings } = require('./shopSettingsCache');

const app = express();
app.use(compression()); // บีบอัด JSON (gzip/deflate) ลดขนาดข้อมูลที่ส่งผ่านเน็ตอย่างมาก
app.use(cors());
app.options(/.*/, cors()); 
app.use(express.json({ limit: '10mb' })); 

const getShopIdFromReq = (req) => {
    let shopId = req.body?.shop_id ?? req.query?.shop_id;
    if (!shopId && req.headers?.['authorization']) {
        try {
            const token = req.headers['authorization'].split(' ')[1];
            if (token) {
                const decoded = jwt.decode(token);
                if (decoded && decoded.shop_id) shopId = decoded.shop_id;
            }
        } catch (e) {}
    }
    return shopId ? Number(shopId) : null;
}; 

// ==========================================
// --- 1. API สมัครสมาชิก (Register) ---
// ==========================================
app.post('/api/register', async (req, res) => {
    const { 
        shop_name, branch, shop_phone, shop_email, address, province, district, sub_district, zipcode,
        admin_name, admin_email, admin_phone, password, 
        roles, profile_image 
    } = req.body;

    if (!shop_name || !admin_email || !password) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลพื้นฐานที่จำเป็นให้ครบถ้วน' });
    }

    try {
        const { data: existingUser } = await db.from('staff').select('id').eq('email', admin_email).single();
        if (existingUser) return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้วในระบบ' });

        const { data: shopRes, error: shopErr } = await db.from('shops').insert([{ 
            shop_name, branch: branch || 'สาขาหลัก', owner_email: admin_email, profile_image: profile_image || null 
        }]).select('id').single();

        if (shopErr) throw shopErr;
        const shopId = shopRes.id;

        const salt = await bcrypt.genSalt(10);
        const hashedAdminPassword = await bcrypt.hash(password, salt);
        const hashedStaffPassword = await bcrypt.hash('staff_password', salt);
        
        const finalRoles = (roles && roles.length > 0) ? roles : [{ roleName: 'เจ้าของร้าน', pin: null }];
        const getEmailPrefix = (role) => { if(role === 'เจ้าของร้าน') return 'owner'; if(role === 'ผู้จัดการ') return 'manager'; return 'staff'; };

        const staffValues = await Promise.all(finalRoles.map(async (r, index) => {
            const isOwner = r.roleName === 'เจ้าของร้าน';
            return {
                shop_id: shopId,
                name: isOwner ? admin_name : `${r.roleName}${index}`,
                phone: isOwner ? admin_phone : null,
                email: isOwner ? admin_email : `${getEmailPrefix(r.roleName)}_${index}@${shop_name.replace(/\s+/g, '')}.com`,
                password: isOwner ? hashedAdminPassword : hashedStaffPassword,
                role: r.roleName,
                pin: r.pin ? await bcrypt.hash(String(r.pin), salt) : null
            };
        }));

        const { error: staffErr } = await db.from('staff').insert(staffValues);
        if (staffErr) { await db.from('shops').delete().eq('id', shopId); throw staffErr; }

        const fullAddress = `${address || ''}${sub_district || ''} ${district || ''}${province || ''} ${zipcode || ''}`.trim();
        const defaultShopSettings = {
            shop_name, branch_name: branch || 'สาขาหลัก', logo: profile_image || "", 
            address: fullAddress || "กรุณาระบุที่อยู่ร้าน", phone: shop_phone || "-", email: shop_email || admin_email, tax_id: "-",
            allow_negative_stock: false, auto_deduct_stock: true, allow_price_override: true, allow_discounts: true,
            require_reason_delete_item: true, require_reason_cancel_bill: true, auto_print_receipt: true, enable_e_receipt: false,
            receipt_show_logo: false, receipt_prefix: "INV-", receipt_start_number: "10001", receipt_footer: "ขอบคุณที่ใช้บริการ",
            pin_enabled: req.body.pin_enabled !== undefined ? Boolean(req.body.pin_enabled) : (Array.isArray(roles) && roles.length > 0),
            pin_settings: {},
            payment_cash_enabled: true, payment_qr_enabled: true, payment_transfer_enabled: false, payment_credit_enabled: false, payment_debit_enabled: false,
            alert_low_stock: true, low_stock_threshold: 10, vat_enabled: false, vat_rate: 7, prices_include_vat: true,
            notify_low_stock: true, notify_out_of_stock: true, notify_refund: true, notify_cancel_bill: true, notify_stock_adjust: true,
            hardware_printer_type: "none", hardware_barcode_scanner: false, hardware_cash_drawer: false,
            language: "th", currency: "THB", timezone: "auto", date_format: "DD/MM/YYYY", time_format: "24h"
        };

        await db.from('shop_settings').insert([{ shop_id: shopId, settings_data: defaultShopSettings }]);

        res.status(201).json({ success: true, message: "สร้างบัญชีร้านและพนักงานสำเร็จ" });
    } catch (err) { res.status(500).json({ error: "ไม่สามารถสร้างบัญชีได้: " + err.message }); }
});

// ==========================================
// --- 2. API เข้าสู่ระบบ (Login) ---
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await db.from('staff').select('*, shops(shop_name, branch, profile_image)').eq('email', email).single();
        if (error || !user) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        
        let validPassword = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            validPassword = await bcrypt.compare(password, user.password);
        } else {
            validPassword = (password === user.password);
        }

        if (!validPassword) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        if (user.status === 'inactive') return res.status(401).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });

        const savedSettings = await getCachedShopSettings(user.shop_id);
        const userPinMap = savedSettings.pin_settings && typeof savedSettings.pin_settings === 'object' && !Array.isArray(savedSettings.pin_settings)
            ? savedSettings.pin_settings
            : {};
        const userPinSetting = userPinMap[String(user.id)] !== undefined ? userPinMap[String(user.id)] : savedSettings.pin_enabled;
        const pinEnabled = userPinSetting !== undefined ? Boolean(userPinSetting) : true;
        const shouldRequirePinForUser = Boolean(user.pin) && pinEnabled;

        res.json({ 
            success: true,
            hasPin: shouldRequirePinForUser,
            pinRequired: shouldRequirePinForUser,
            pinEnabled,
            token: jwt.sign({ id: user.id, shop_id: user.shop_id, role: user.role }, JWT_SECRET, { expiresIn: '12h' }),
            user: { id: user.id, email: user.email, name: user.name, role: user.role, pin: user.pin, pin_enabled: pinEnabled, shop_id: user.shop_id, shop_name: user.shops?.shop_name || '-', branch: user.shops?.branch || 'สาขาหลัก', profile_image: user.shops?.profile_image || '' } 
        });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 3. API ตรวจสอบ & รีเซ็ต PIN ---
// ==========================================

const authenticateToken = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token expired' });
        req.user = user;
        next();
    });
};
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

app.use('/api', (req, res, next) => {
    const publicPaths = [
        '/login', '/register', '/verify-pin', '/verify-manager-pin', '/reset-pin', 
        '/settings', '/staff-roles', '/forgot-password', '/shifts/active', 
        '/categories', '/products', '/payment-methods', '/options', '/product_options',
        '/next-bill-number', '/orders', '/promotions', '/inventory'
    ];
    if (publicPaths.some(p => req.path === p || req.path.startsWith(p + '?') || req.path.startsWith(p + '/'))) return next();
    authenticateToken(req, res, next);
});

app.post('/api/verify-pin', async (req, res) => {
    const { email, role, pin } = req.body; 
    try {
        const { data: users, error } = await db.from('staff').select('*, shops(shop_name, branch, profile_image)').eq('email', email).eq('role', role);
        if (error || !users || users.length === 0) return res.status(404).json({ success: false, error: "ไม่พบข้อมูลผู้ใช้" });
        
        const user = users[0];
        let validPin = false;
        if (user.pin && (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$'))) {
            validPin = await bcrypt.compare(String(pin), user.pin);
        } else {
            validPin = (String(pin) === user.pin);
        }
        
        if (validPin) {
            res.json({ success: true, token: jwt.sign({ id: user.id, shop_id: user.shop_id, role: user.role }, JWT_SECRET, { expiresIn: '12h' }), user: { id: user.id, email: user.email, name: user.name, role: user.role, shop_id: user.shop_id, shop_name: user.shops?.shop_name || '-', branch: user.shops?.branch || 'สาขาหลัก', profile_image: user.shops?.profile_image || '' } });
        } else { res.status(401).json({ success: false, error: "รหัส PIN ไม่ถูกต้อง" }); }
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/reset-pin', async (req, res) => {
    const { email, password, newPin } = req.body;
    try {
        const { data: user, error } = await db.from('staff').select('*').eq('email', email).single();
        if (error || !user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

        let validPass = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            validPass = await bcrypt.compare(password, user.password);
        } else {
            validPass = (password === user.password);
        }

        if (!validPass) return res.status(401).json({ error: "รหัสผ่านเข้าสู่ระบบไม่ถูกต้อง" });

        const salt = await bcrypt.genSalt(10);
        const hashedNewPin = await bcrypt.hash(String(newPin), salt);

        const { error: updateErr } = await db.from('staff').update({ pin: hashedNewPin }).eq('email', email);
        if (updateErr) throw updateErr;

        res.json({ success: true, message: "ตั้งรหัส PIN ใหม่เรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/users/change-password', async (req, res) => {
    const { id, email, oldPass, newPass, confirmPass } = req.body;
    if ((!id && !email) || !oldPass || !newPass || !confirmPass) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }
    if (String(newPass).length < 6) {
        return res.status(400).json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
    }
    if (String(newPass) !== String(confirmPass)) {
        return res.status(400).json({ error: "รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน" });
    }
    try {
        let query = db.from('staff').select('id, password');
        if (id) query = query.eq('id', id);
        else query = query.eq('email', email);

        const { data: user, error } = await query.single();
        if (error || !user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

        const validPassword = user.password?.startsWith('$2a$') || user.password?.startsWith('$2b$')
            ? await bcrypt.compare(String(oldPass), user.password)
            : String(oldPass) === user.password;
        if (!validPassword) return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

        const hashedPass = await bcrypt.hash(String(newPass), await bcrypt.genSalt(10));
        const { error: updateError } = await db.from('staff').update({ password: hashedPass }).eq('id', user.id);
        if (updateError) throw updateError;
        res.json({ success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/users/change-pin', async (req, res) => {
    const { id, email, password, newPin, confirmPin } = req.body;
    if ((!id && !email) || !password || !newPin || !confirmPin) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }
    if (!/^\d{4}$/.test(String(newPin))) {
        return res.status(400).json({ error: "กรุณากรอก PIN ใหม่เป็นตัวเลข 4 หลัก" });
    }
    if (String(newPin) !== String(confirmPin)) {
        return res.status(400).json({ error: "รหัส PIN ใหม่กับยืนยัน PIN ไม่ตรงกัน" });
    }
    try {
        let query = db.from('staff').select('id, password');
        if (id) query = query.eq('id', id);
        else query = query.eq('email', email);
        
        const { data: user, error } = await query.single();
        if (error || !user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

        const validPassword = user.password?.startsWith('$2a$') || user.password?.startsWith('$2b$')
            ? await bcrypt.compare(String(password), user.password)
            : String(password) === user.password;
        if (!validPassword) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

        const hashedPin = await bcrypt.hash(String(newPin), await bcrypt.genSalt(10));
        const { error: updateError } = await db.from('staff').update({ pin: hashedPin }).eq('id', user.id);
        if (updateError) throw updateError;
        res.json({ success: true, message: "เปลี่ยนรหัส PIN เรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/verify-manager-pin', async (req, res) => {
    try {
        const { data: users, error } = await db.from('staff').select('*').eq('shop_id', req.body.shop_id).in('role', ['เจ้าของร้าน', 'ผู้จัดการ']);
        if (error) throw error;
        
        let validUser = false;
        for (const u of users) {
            if (u.pin && (u.pin.startsWith('$2a$') || u.pin.startsWith('$2b$'))) {
                const isMatch = await bcrypt.compare(String(req.body.pin), u.pin);
                if (isMatch) { validUser = true; break; }
            } else if (u.pin === String(req.body.pin)) {
                validUser = true; break;
            }
        }
        res.json({ success: validUser });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- In-Memory Caching for High-Frequency APIs ---
// ==========================================
const categoriesCache = new Map();
const productsCache = new Map();
const paymentMethodsCache = new Map();
const optionsCache = new Map();

function invalidateProductsCache(shopId) {
    if (!shopId) return;
    const prefix = `${shopId}_`;
    for (const key of productsCache.keys()) {
        if (key.startsWith(prefix)) productsCache.delete(key);
    }
}

// ==========================================
// --- 4. API หมวดหมู่สินค้า (Categories) ---
// ==========================================
app.get('/api/categories', async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.status(200).json([]);
        const cacheKey = String(shop_id);
        const cached = categoriesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return res.status(200).json(cached.data);
        }
        const { data, error } = await db.from('categories').select('*').eq('shop_id', shop_id).order('sort_order', { ascending: true }).order('id', { ascending: false });
        if (error) throw error;
        const result = data || [];
        categoriesCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.post('/api/categories', async (req, res) => {
    try {
        const { error } = await db.from('categories').insert([{ shop_id: req.body.shop_id, name: req.body.name, status: req.body.status || 'active' }]);
        if (error) throw error;
        categoriesCache.delete(String(req.body.shop_id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/categories/reorder', async (req, res) => {
    try {
        const { shop_id, ordered_ids } = req.body;
        if (!shop_id || !ordered_ids || !Array.isArray(ordered_ids)) return res.status(400).json({ error: 'Invalid data' });
        
        for (let i = 0; i < ordered_ids.length; i++) {
            await db.from('categories').update({ sort_order: i }).eq('id', ordered_ids[i]).eq('shop_id', shop_id);
        }
        categoriesCache.delete(String(shop_id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.put('/api/categories/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('categories').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error;
        categoriesCache.delete(String(shopId));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const shopId = getShopIdFromReq(req);
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('categories').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) {
            if (error.code === '23503') {
                return res.status(400).json({ 
                    error: 'ไม่สามารถลบหมวดหมู่นี้ได้ เนื่องจากยังมีสินค้าที่ผูกกับหมวดหมู่นี้อยู่' 
                });
            }
            throw error;
        }
        categoriesCache.delete(String(shopId));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});



// ==========================================
// --- 5. API สินค้า (Products) ---
// ==========================================
app.get('/api/products', async (req, res) => {
    const { shop_id, category_id } = req.query;
    try {
        if (!shop_id) return res.status(200).json([]);
        const cacheKey = `${shop_id}_${category_id || 'all'}`;
        const cached = productsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 30000) {
            return res.status(200).json(cached.data);
        }
        let query = db.from('products').select('*').eq('shop_id', shop_id);
        if (category_id && category_id !== 'all') query = query.eq('category_id', category_id);
        const { data, error } = await query.order('id', { ascending: false });
        if (error) throw error;
        const result = data || [];
        productsCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.post('/api/products', async (req, res) => {
    const { shop_id, category_id, name, price, status, image_url } = req.body;
    try {
        const { error } = await db.from('products').insert([{ shop_id, category_id, name, price, status: status || 'active', image_url }]);
        if (error) throw error;
        invalidateProductsCache(shop_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.put('/api/products/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('products').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error;
        invalidateProductsCache(shopId);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.delete('/api/products/:id', async (req, res) => {
    try {
        const shopId = getShopIdFromReq(req);
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });

        // ลบความสัมพันธ์ของสูตรและตัวเลือกที่ผูกกับสินค้านี้ก่อน
        await db.from('recipes').delete().eq('product_id', req.params.id);
        await db.from('product_options').delete().eq('product_id', req.params.id);

        const { error } = await db.from('products').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) {
            console.error("Delete product error:", error);
            if (error.code === '23503') {
                return res.status(400).json({ 
                    error: 'ไม่สามารถลบสินค้านี้ได้ เนื่องจากมีประวัติการขายในระบบ แนะนำให้ปิดการใช้งานแทน' 
                });
            }
            throw error;
        }
        invalidateProductsCache(shopId);
        res.json({ success: true });
    } catch (err) { 
        console.error("Delete product err:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); 
    }
});

// ==========================================
// --- 6. API ตัวเลือกสินค้า (Options & Modifiers) ---
// ==========================================
app.get('/api/options', async (req, res) => {
    try {
        const { shop_id } = req.query;
        if (!shop_id) return res.json([]);
        const cacheKey = String(shop_id);
        const cached = optionsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return res.json(cached.data);
        }
        const { data: groups, error } = await db.from('option_groups').select('*, items:option_items(*)').eq('shop_id', shop_id).order('id', { ascending: false });
        if (error) throw error;
        const result = (groups || []).map(g => ({
            ...g,
            items: g.items || []
        }));
        optionsCache.set(cacheKey, { data: result, timestamp: Date.now() });
        res.json(result);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/options', async (req, res) => {
    const { shop_id, name, description, type, is_required, min_selection, max_selection, status, items } = req.body;
    try {
        const { data: group, error } = await db.from('option_groups')
            .insert([{ shop_id, name, description, type, is_required, min_selection, max_selection, status }])
            .select().single();
        if (error) throw error;
        
        if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ 
                option_group_id: group.id, name: i.name, price: i.price, status: 'active' 
            }));
            const { error: itemsErr } = await db.from('option_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
        }
        optionsCache.delete(String(shop_id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/options/:id', async (req, res) => {
    const groupId = req.params.id;
    const { shop_id, name, description, type, is_required, min_selection, max_selection, status, items } = req.body;
    try {
        if (!shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error: groupErr } = await db.from('option_groups')
            .update({ name, description, type, is_required, min_selection, max_selection, status })
            .eq('id', groupId)
            .eq('shop_id', shop_id);
        if (groupErr) throw groupErr;

        await db.from('option_items').delete().eq('option_group_id', groupId);
        
        if (items && items.length > 0) {
            const itemsToInsert = items.map(i => ({ 
                option_group_id: groupId, name: i.name, price: i.price, status: i.status || 'active' 
            }));
            const { error: itemsErr } = await db.from('option_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
        }
        optionsCache.delete(String(shop_id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/options/:id', async (req, res) => {
    try {
        const shopId = getShopIdFromReq(req);
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        await db.from('product_options').delete().eq('option_group_id', req.params.id);
        await db.from('option_items').delete().eq('option_group_id', req.params.id);
        const { error } = await db.from('option_groups').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error;
        optionsCache.delete(String(shopId));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/product_options', async (req, res) => {
    try {
        const { product_id } = req.query;
        let query = db.from('product_options').select('*');
        if (product_id) query = query.eq('product_id', product_id);
        
        const { data, error } = await query;
        if (error) throw error; 
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/product_options', async (req, res) => {
    const { product_id, option_group_ids, shop_id } = req.body;
    try {
        if (!shop_id || !product_id) return res.status(400).json({ error: 'ต้องระบุ shop_id และ product_id' });
        const { data: product, error: productErr } = await db.from('products').select('id, shop_id').eq('id', product_id).eq('shop_id', shop_id).single();
        if (productErr || !product) return res.status(403).json({ error: 'สินค้านี้ไม่ได้อยู่ในร้านของคุณ' });

        await db.from('product_options').delete().eq('product_id', product_id);
        
        if (option_group_ids && option_group_ids.length > 0) {
            const { data: validGroups, error: groupsErr } = await db.from('option_groups').select('id').eq('shop_id', shop_id).in('id', option_group_ids);
            if (groupsErr) throw groupsErr;
            const validIds = (validGroups || []).map(g => g.id);
            if (validIds.length === 0) return res.status(400).json({ error: 'ไม่มีตัวเลือกที่ตรงกับร้านนี้' });
            const inserts = validIds.map(oid => ({ product_id, option_group_id: oid }));
            const { error: insertErr } = await db.from('product_options').insert(inserts);
            if (insertErr) throw insertErr;
        }
        
        const hasOptions = option_group_ids && option_group_ids.length > 0;
        await db.from('products').update({ has_options: hasOptions }).eq('id', product_id).eq('shop_id', shop_id);

        res.json({ success: true, message: "ผูกตัวเลือกเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 7. API สูตรสินค้า (Recipes) - รองรับ Atomic Update ---
// ==========================================
app.get('/api/recipes', async (req, res) => {
    try {
        const { product_id, shop_id } = req.query;
        let query = db.from('recipes').select('*, inventory_items(name, unit, cost)');
        if (product_id) query = query.eq('product_id', product_id);
        if (shop_id) {
            const { data: productRows, error: productErr } = await db.from('products').select('id').eq('shop_id', shop_id).in('id', product_id ? [product_id] : []);
            if (productErr) throw productErr;
            const productIds = (productRows || []).map(p => p.id);
            if (product_id && productIds.length === 0) return res.json([]);
            if (product_id) query = query.in('product_id', productIds);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/products/:productId/recipe', async (req, res) => {
    const { productId } = req.params;
    const { shop_id, items } = req.body;

    if (!productId) {
        return res.status(400).json({ error: "ไม่พบ Product ID" });
    }

    try {
        if (!shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { data: product, error: productErr } = await db.from('products').select('id, shop_id').eq('id', productId).eq('shop_id', shop_id).single();
        if (productErr || !product) return res.status(403).json({ error: 'สินค้านี้ไม่ได้อยู่ในร้านของคุณ' });

        const { error: deleteError } = await db.from('recipes').delete().eq('product_id', productId);

        if (deleteError) {
            console.error("Delete Recipe Error:", deleteError);
            return res.status(500).json({ error: "ไม่สามารถเคลียร์สูตรเดิมได้: " + deleteError.message });
        }

        if (items && items.length > 0) {
            const insertPayload = items.map(item => ({
                product_id: productId,
                inventory_item_id: item.inventory_item_id,
                quantity: item.quantity,
                unit: item.unit
            }));

            const { error: insertError } = await db.from('recipes').insert(insertPayload);

            if (insertError) {
                console.error("Insert Recipe Error:", insertError);
                return res.status(500).json({ error: "ไม่สามารถบันทึกสูตรใหม่ได้: " + insertError.message });
            }
        }

        recipesCache.clear();
        return res.status(200).json({ success: true, message: "อัปเดตสูตรสำเร็จ" });

    } catch (error) {
        console.error("Server Error updating recipe:", error);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดที่ฐานข้อมูล" });
    }
});

app.post('/api/recipes', async (req, res) => {
    const { product_id, inventory_item_id, quantity, unit, shop_id } = req.body;
    try {
        if (!shop_id || !product_id) return res.status(400).json({ error: 'ต้องระบุ shop_id และ product_id' });
        const { data: product, error: productErr } = await db.from('products').select('id').eq('id', product_id).eq('shop_id', shop_id).single();
        if (productErr || !product) return res.status(403).json({ error: 'สินค้านี้ไม่ได้อยู่ในร้านของคุณ' });
        const { error } = await db.from('recipes').insert([{ product_id, inventory_item_id, quantity, unit }]);
        if (error) throw error;
        recipesCache.clear();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('recipes').delete().eq('id', req.params.id).eq('product_id', req.body.product_id || '').not('product_id', 'is', null);
        if (error) throw error;
        recipesCache.clear();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 8. API บันทึกออเดอร์ & ตัดสต็อก (Orders & Deduct) ---
// ==========================================
// getCachedShopSettings / invalidateShopSettings ถูกย้ายไปที่ ./shopSettingsCache เพื่อใช้ร่วมกันทั้งระบบ

const shiftStatusCache = new Map();
async function getShiftStatus(shiftId) {
    const key = String(shiftId);
    const cached = shiftStatusCache.get(key);
    if (cached && Date.now() - cached.timestamp < 15000) {
        return cached.status;
    }
    const { data: shift, error } = await db.from('shifts').select('status').eq('id', shiftId).single();
    if (error || !shift) return null;
    shiftStatusCache.set(key, { status: shift.status, timestamp: Date.now() });
    return shift.status;
}

const shiftBillCounters = new Map();
async function getNextBillNumber(shopId, shiftId, increment = false) {
    const key = `${shopId}_${shiftId}`;
    let counterObj = shiftBillCounters.get(key);
    if (!counterObj) {
        const [lastOrderResult, settings] = await Promise.all([
            db.from('orders').select('bill_number').eq('shop_id', shopId).eq('shift_id', shiftId).order('id', { ascending: false }).limit(1),
            getCachedShopSettings(shopId)
        ]);
        const prefix = settings?.receipt_prefix ?? 'INV-';
        const startNumber = Number.parseInt(settings?.receipt_start_number, 10);
        const padding = Number.isNaN(startNumber) ? 4 : String(settings.receipt_start_number).length;
        let nextNumber = Number.isNaN(startNumber) ? 1 : startNumber;
        const lastBill = lastOrderResult.data?.[0]?.bill_number;
        if (lastBill && lastBill.startsWith(prefix)) {
            const lastNum = parseInt(lastBill.slice(prefix.length), 10);
            if (!Number.isNaN(lastNum)) nextNumber = lastNum + 1;
        }
        counterObj = { prefix, padding, currentNumber: nextNumber };
        shiftBillCounters.set(key, counterObj);
    }
    
    const formatted = `${counterObj.prefix}${String(counterObj.currentNumber).padStart(counterObj.padding, '0')}`;
    if (increment) {
        counterObj.currentNumber += 1;
    }
    return formatted;
}

const recipesCache = new Map();
async function getCachedRecipes(productIds) {
    if (!productIds || productIds.length === 0) return [];
    const missingIds = [];
    const result = [];
    const now = Date.now();
    for (const pid of productIds) {
        const cached = recipesCache.get(String(pid));
        if (cached && now - cached.timestamp < 300000) {
            result.push(...cached.data);
        } else {
            missingIds.push(pid);
        }
    }
    if (missingIds.length > 0) {
        const { data, error } = await db.from('recipes').select('product_id, inventory_item_id, quantity').in('product_id', missingIds);
        if (!error && data) {
            const byProd = new Map();
            for (const pid of missingIds) byProd.set(String(pid), []);
            for (const r of data) {
                const arr = byProd.get(String(r.product_id));
                if (arr) arr.push(r);
            }
            for (const [pid, list] of byProd.entries()) {
                recipesCache.set(pid, { data: list, timestamp: now });
                result.push(...list);
            }
        }
    }
    return result;
}

app.get('/api/next-bill-number', async (req, res) => {
    const { shop_id, shift_id } = req.query;
    if (!shift_id || shift_id === 'undefined') return res.json({ billCode: "0001" });
    try {
        const billCode = await getNextBillNumber(shop_id, shift_id, false);
        res.json({ billCode });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/orders', async (req, res) => {
    const { shop_id, staff_id, shift_id, order_type, total_amount, payment_method, received_amount, change_amount, cart } = req.body;
    try {
        if (!shift_id) return res.status(400).json({ success: false, error: "ไม่พบรหัสรอบการขาย" });
        const [shiftStatus, billNumber, shopSettings] = await Promise.all([
            getShiftStatus(shift_id),
            getNextBillNumber(shop_id, shift_id, true),
            getCachedShopSettings(shop_id)
        ]);

        if (!shiftStatus || shiftStatus !== 'OPEN') {
            return res.status(400).json({ success: false, error: "รอบการขายนี้ถูกปิดแล้ว กรุณาเปิดรอบการขายใหม่" });
        }

        const isGateway = ['QR', 'PROMPTPAY', 'CREDIT_CARD', 'CARD'].includes(payment_method) || payment_method.includes('QR');
        const isTransfer = ['TRANSFER', 'โอนเงิน'].includes(payment_method) || payment_method.includes('โอนเงิน');
        let orderStatus = 'completed';
        if (isGateway) orderStatus = 'PENDING_PAYMENT';
        else if (isTransfer) orderStatus = 'PENDING_VERIFICATION';

        const receiptSettingsSnapshot = shopSettings ? JSON.parse(JSON.stringify(shopSettings)) : null;
        const cartSubtotal = (cart || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
        const vatEnabled = receiptSettingsSnapshot?.vat_enabled === true || receiptSettingsSnapshot?.vat_enabled === 'true';
        const vatRate = Number(receiptSettingsSnapshot?.vat_rate || 0);
        const pricesIncludeVat = receiptSettingsSnapshot?.prices_include_vat !== false && receiptSettingsSnapshot?.prices_include_vat !== 'false';
        const vatAmount = vatEnabled && vatRate > 0
            ? pricesIncludeVat ? cartSubtotal * (vatRate / (100 + vatRate)) : cartSubtotal * (vatRate / 100)
            : 0;
        const calculatedTotal = vatEnabled && !pricesIncludeVat ? cartSubtotal + vatAmount : cartSubtotal;
        if (receiptSettingsSnapshot) {
            receiptSettingsSnapshot.receipt_subtotal = cartSubtotal;
            receiptSettingsSnapshot.receipt_subtotal_excluding_vat = pricesIncludeVat ? calculatedTotal - vatAmount : cartSubtotal;
            receiptSettingsSnapshot.receipt_vat_enabled = vatEnabled;
            receiptSettingsSnapshot.receipt_vat_rate = vatRate;
            receiptSettingsSnapshot.receipt_vat_amount = vatAmount;
            receiptSettingsSnapshot.receipt_total_amount = calculatedTotal;
        }
        const getPkgSize = (u) => { const p = String(u||'').split('|'); return (p.length===3 && Number(p[1])>0) ? Number(p[1]) : 1; };

        const cartItems = cart || [];
        const productIds = [...new Set(cartItems.map(item => item.id || item.product_id).filter(Boolean))];
        let preloadedRecipes = null;
        let preloadedInventory = null;

        if (receiptSettingsSnapshot?.allow_negative_stock === false) {
            const allRecipes = await getCachedRecipes(productIds);
            preloadedRecipes = allRecipes || [];

            const recipesByProduct = new Map();
            for (const recipe of preloadedRecipes) {
                const productRecipes = recipesByProduct.get(recipe.product_id) || [];
                productRecipes.push(recipe);
                recipesByProduct.set(recipe.product_id, productRecipes);
            }
            const inventoryIds = [...new Set(preloadedRecipes.map(recipe => recipe.inventory_item_id).filter(Boolean))];
            const { data: inventoryItems } = inventoryIds.length > 0
                ? await db.from('inventory_items').select('id, quantity, name, unit').in('id', inventoryIds)
                : { data: [] };
            preloadedInventory = inventoryItems || [];
            const inventoryItemsById = new Map(preloadedInventory.map(item => [item.id, item]));

            for (const item of cartItems) {
                const productId = item.id || item.product_id;
                const recipes = recipesByProduct.get(productId) || [];
                for (const recipe of recipes) {
                    const inventoryItem = inventoryItemsById.get(recipe.inventory_item_id);
                    const requiredQuantity = Number(recipe.quantity || 0) * Number(item.quantity || 0);
                    if (inventoryItem) {
                        const pkgSize = getPkgSize(inventoryItem.unit);
                        const currentSubUnitTotal = Number(inventoryItem.quantity) * pkgSize;
                        if (currentSubUnitTotal < requiredQuantity) {
                            return res.status(400).json({ success: false, error: `วัตถุดิบ ${inventoryItem.name || ''} ไม่เพียงพอสำหรับการขาย` });
                        }
                    }
                }
            }
        }

        // Insert order
        const orderInsertPayload = {
            bill_number: billNumber, 
            shop_id, 
            staff_id: staff_id || null, 
            shift_id, 
            order_type, 
            total_amount: calculatedTotal,
            payment_method: payment_method || 'เงินสด', 
            received_amount: received_amount || calculatedTotal, 
            change_amount: change_amount || 0, 
            status: orderStatus
        };

        const { data: orderRes, error: orderErr } = await db.from('orders')
            .insert([orderInsertPayload])
            .select('id')
            .single();
        if (orderErr) throw orderErr;

        const orderId = orderRes.id;

        // Insert order items
        const itemsValues = cart.map(item => ({
            order_id: orderId, 
            product_id: item.id || item.product_id, 
            quantity: item.quantity, 
            price: item.price, 
            addon_name: item.optionsText || item.addon_name || null, 
            addon_price: item.addon_price || 0, 
            note: item.note || null
        }));

        const { error: itemsErr } = await db.from('order_items').insert(itemsValues);
        if (itemsErr) throw itemsErr;

        // RESPOND TO CASHIER IMMEDIATELY (Ultra-fast response)
        res.status(201).json({ success: true, message: "สร้างออเดอร์สำเร็จ", billNumber, orderId, orderStatus });

        // Non-blocking background stock deduction and notification sync
        let autoDeduct = true;
        if (receiptSettingsSnapshot?.auto_deduct_stock === false) autoDeduct = false;

        if (autoDeduct && orderStatus === 'completed' && productIds.length > 0) {
            setImmediate(async () => {
                try {
                    let allRecipes = preloadedRecipes;
                    if (!allRecipes) {
                        const { data: recipeData, error: recipeErr } = await db.from('recipes')
                            .select('product_id, inventory_item_id, quantity')
                            .in('product_id', productIds);
                        if (recipeErr) throw recipeErr;
                        allRecipes = recipeData || [];
                    }

                    const recipesByProduct = new Map();
                    for (const recipe of allRecipes) {
                        const productRecipes = recipesByProduct.get(recipe.product_id) || [];
                        productRecipes.push(recipe);
                        recipesByProduct.set(recipe.product_id, productRecipes);
                    }

                    const requiredByInventory = new Map();
                    for (const item of cart) {
                        const productId = item.id || item.product_id;
                        for (const recipe of recipesByProduct.get(productId) || []) {
                            const requiredQuantity = Number(recipe.quantity || 0) * Number(item.quantity || 0);
                            if (requiredQuantity <= 0) continue;
                            requiredByInventory.set(
                                recipe.inventory_item_id,
                                (requiredByInventory.get(recipe.inventory_item_id) || 0) + requiredQuantity
                            );
                        }
                    }

                    const inventoryItemIds = [...requiredByInventory.keys()];
                    if (inventoryItemIds.length > 0) {
                        let inventoryItems = preloadedInventory;
                        if (!inventoryItems || inventoryItems.length === 0) {
                            const { data: invData, error: inventoryReadError } = await db.from('inventory_items')
                                .select('id, quantity, unit')
                                .eq('shop_id', shop_id)
                                .in('id', inventoryItemIds);
                            if (inventoryReadError) throw inventoryReadError;
                            inventoryItems = invData || [];
                        }

                        const stockMovements = [];
                        const inventoryUpdates = [];
                        const updatedItemIds = [];

                        for (const invItem of inventoryItems) {
                            const requiredQuantity = requiredByInventory.get(invItem.id);
                            if (!requiredQuantity) continue;
                            const pkgSize = getPkgSize(invItem.unit);
                            const previousStock = Number(invItem.quantity || 0);
                            const newStock = Number((previousStock - requiredQuantity / pkgSize).toFixed(6));

                            inventoryUpdates.push(
                                db.from('inventory_items').update({ quantity: newStock }).eq('id', invItem.id)
                            );
                            updatedItemIds.push(invItem.id);

                            stockMovements.push({
                                shop_id,
                                inventory_item_id: invItem.id,
                                movement_type: 'SALE',
                                quantity: Number((newStock - previousStock).toFixed(6)),
                                balance_after: newStock,
                                reference_id: orderId,
                                reason: `ขายสินค้า POS (บิล ${billNumber})`
                            });
                        }

                        // Parallel update inventory + batch insert stock movements
                        await Promise.all([
                            ...inventoryUpdates,
                            stockMovements.length > 0 ? db.from('stock_movements').insert(stockMovements) : Promise.resolve(null)
                        ]);

                        // Asynchronously sync inventory notifications in the background
                        if (updatedItemIds.length > 0) {
                            Promise.all(updatedItemIds.map(itemId =>
                                syncInventoryNotification({ shopId: shop_id, itemId, userId: staff_id || null })
                            )).catch(error => console.error('Inventory notification sync error:', error));
                        }
                    }
                } catch (backgroundError) {
                    console.error("Background stock deduction error:", backgroundError);
                }
            });
        }
    } catch (err) {
        console.error("Order Creation Error:", err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ: ' + (err.message || String(err)) });
    }
});

app.post('/api/orders/:id/confirm-transfer', async (req, res) => {
    const { shop_id } = req.body;
    if (!shop_id) {
        return res.status(400).json({ success: false, error: 'ต้องระบุ shop_id' });
    }
    if (req.user && req.user.shop_id && String(req.user.shop_id) !== String(shop_id)) {
        return res.status(403).json({ success: false, error: 'ไม่มีสิทธิ์ยืนยันรายการของร้านนี้' });
    }

    try {
        const { data: order, error } = await db.from('orders').select('*')
            .eq('id', req.params.id)
            .eq('shop_id', shop_id)
            .maybeSingle();
        if (error) throw error;
        if (!order) return res.status(404).json({ success: false, error: 'ไม่พบบิลนี้' });

        const paymentMethod = String(order.payment_method || '');
        const isTransfer = ['TRANSFER', 'โอนเงิน'].includes(paymentMethod) || paymentMethod.includes('โอนเงิน');
        if (!isTransfer) return res.status(400).json({ success: false, error: 'บิลนี้ไม่ได้ชำระด้วยการโอนเงิน' });
        if (order.status === 'completed') return res.json({ success: true, alreadyConfirmed: true });
        if (order.status !== 'PENDING_VERIFICATION') {
            return res.status(409).json({ success: false, error: 'บิลนี้ไม่อยู่ในสถานะรอตรวจสอบ' });
        }

        const confirmed = await paymentRoutes.completeOrder(order, order.total_amount, 'PENDING_VERIFICATION');
        if (!confirmed) return res.status(409).json({ success: false, error: 'รายการนี้ถูกยืนยันไปแล้ว' });

        res.json({ success: true });
    } catch (err) {
        console.error('Confirm transfer error:', err);
        res.status(500).json({ success: false, error: 'ยืนยันรายการโอนไม่สำเร็จ กรุณาลองอีกครั้ง' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { shop_id, limit, status, startDate, endDate, shift_id } = req.query;
        if (!shop_id) return res.json([]);
        let query = db.from('orders').select('*').eq('shop_id', shop_id);
        if (shift_id) {
            query = query.eq('shift_id', shift_id);
        }
        if (status && status !== 'all' && status !== 'ทั้งหมด') {
            query = query.eq('status', status);
        }
        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }
        query = query.order('created_at', { ascending: false });
        const maxLimit = limit ? Math.min(Number(limit) || 200, 1000) : 200;
        query = query.limit(maxLimit);

        const { data, error } = await query;
        if (error) throw error; res.json(data || []);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/orders/single/:id', async (req, res) => {
    try {
        if (!req.query.shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const query = db.from('orders').select('*').eq('id', req.params.id).eq('shop_id', req.query.shop_id);
        const { data, error } = await query.single();
        if (error || !data) return res.status(404).json({ error: "ไม่พบข้อมูลบิล" });
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/orders/:id/items', async (req, res) => {
    try {
        const shopId = req.query.shop_id;
        let query = db.from('order_items').select('*, products(name)');
        if (shopId) {
            query = query.eq('shop_id', shopId);
        }
        query = query.eq('order_id', req.params.id);
        const { data, error } = await query;
        if (error) throw error; res.json((data || []).map(item => ({ ...item, name: item.products?.name })));
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/orders/:id/void', async (req, res) => {
    const orderId = req.params.id;
    const { shop_id, pin } = req.body;
    try {
        const { data: users, error: staffErr } = await db.from('staff').select('*').eq('shop_id', shop_id).in('role', ['เจ้าของร้าน', 'ผู้จัดการ']);
        if (staffErr || !users || users.length === 0) return res.status(403).json({ success: false, error: "ไม่มีสิทธิ์ยกเลิกบิล" });
        
        let validUser = false;
        for (const u of users) {
             if (u.pin && (u.pin.startsWith('$2a$') || u.pin.startsWith('$2b$'))) {
                 if (await bcrypt.compare(String(pin), u.pin)) { validUser = true; break; }
             } else if (u.pin === String(pin)) {
                 validUser = true; break;
             }
        }
        
        if (!validUser) return res.status(403).json({ success: false, error: "รหัส PIN ไม่ถูกต้อง" });

        const { data: order } = await db.from('orders').select('*').eq('id', orderId).eq('shop_id', shop_id).single();
        if (!order || order.status === 'cancelled') return res.status(400).json({ success: false, error: "ไม่พบบิลนี้ หรือบิลถูกยกเลิกไปแล้ว" });

        let autoDeduct = true;
        let sData = {};
        try {
            sData = await getCachedShopSettings(shop_id);
            if (sData.auto_deduct_stock === false) autoDeduct = false;
        } catch (e) { console.error("Fetch Error: ", e); }

        const { data: items } = await db.from('order_items').select('*').eq('order_id', orderId);
        if (autoDeduct && items) {
            for (const item of items) {
                const productId = item.product_id || item.id;
                const { data: recipes } = await db.from('recipes').select('*').eq('product_id', productId);
                if (recipes && recipes.length > 0) {
                    for (const recipe of recipes) {
                        const totalReturn = recipe.quantity * item.quantity;
                        const { data: invItem } = await db.from('inventory_items').select('quantity, unit').eq('id', recipe.inventory_item_id).single();
                        if (invItem) {
                            const getPkgSize = (u) => { const p = String(u||'').split('|'); return (p.length===3 && Number(p[1])>0) ? Number(p[1]) : 1; };
                            const pkgSize = getPkgSize(invItem.unit);
                            const returnStorageUnit = Number((totalReturn / pkgSize).toFixed(6));
                            const newStock = Number((Number(invItem.quantity) + returnStorageUnit).toFixed(6));
                            await db.from('inventory_items').update({ quantity: newStock }).eq('id', recipe.inventory_item_id);
                            
                            await db.from('stock_movements').insert([{
                                shop_id, inventory_item_id: recipe.inventory_item_id, movement_type: 'VOID_RETURN',
                                quantity: returnStorageUnit, balance_after: newStock, reference_id: orderId, reason: `คืนสต็อกจากการยกเลิกบิล (Void)`
                            }]);
                        }
                    }
                }
            }
        }

        await db.from('order_items').update({ price: 0, addon_price: 0 }).eq('order_id', orderId);
        await db.from('orders').update({ total_amount: 0, received_amount: 0, change_amount: 0, status: 'cancelled' }).eq('id', orderId);

        {
            if (sData.notify_cancel_bill !== false) {
                await createNotification({ shopId: shop_id, type: 'CANCEL_BILL', priority: 'WARNING', title: 'ยกเลิกบิล', message: `บิล ${order.bill_number} ถูกยกเลิก`, entityType: 'order', entityId: orderId, userId: req.body.staff_id || null });
            }
            if (sData.notify_refund !== false && items && items.length > 0) {
                await createNotification({ shopId: shop_id, type: 'REFUND', priority: 'INFO', title: 'คืนสินค้า', message: `คืนสินค้าจากบิล ${order.bill_number}`, entityType: 'order', entityId: orderId, userId: req.body.staff_id || null });
            }
        }

        if (order.shift_id) {
            const { data: allOrders } = await db.from('orders').select('total_amount').eq('shift_id', order.shift_id).neq('status', 'cancelled');
            const newTotalSales = allOrders ? allOrders.reduce((sum, o) => sum + Number(o.total_amount), 0) : 0;
            await db.from('shifts').update({ total_sales: newTotalSales }).eq('id', order.shift_id);
        }
        res.json({ success: true, message: "ยกเลิกบิลเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ==========================================
// --- 9. API รอบการขาย / กะ (Shifts) ---
// ==========================================
app.get('/api/shifts/active', async (req, res) => {
    try {
        const { data, error } = await db.from('shifts').select('*').eq('shop_id', req.query.shop_id).eq('status', 'OPEN').single();
        if (error && error.code !== 'PGRST116') throw error; 
        res.json({ shift: data || null });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/shifts', async (req, res) => {
    try {
        const { data, error } = await db.from('shifts').select('*, staff(role, email)').eq('shop_id', req.query.shop_id).order('opened_at', { ascending: false });
        if (error) throw error; res.json({ shifts: data.map(shift => ({ ...shift, staff_name: shift.staff ? `${shift.staff.role}` : 'พนักงาน' })) });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/shifts/open', async (req, res) => {
    const { shop_id, staff_id, opening_cash } = req.body;
    try {
        const { data: existing } = await db.from('shifts').select('id').eq('shop_id', shop_id).eq('status', 'OPEN').single();
        if (existing) return res.status(400).json({ message: "มีรอบการขายเปิดอยู่แล้ว กรุณาปิดรอบเดิมก่อน" });
        const { data, error } = await db.from('shifts').insert([{ shop_id, staff_id, opening_cash: Number(opening_cash) || 0, status: 'OPEN', opened_at: new Date().toISOString() }]).select().single();
        if (error) throw error; res.json({ success: true, shift: data });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/shifts/close', async (req, res) => {
    const { shift_id, closing_cash, expected_cash, cash_difference } = req.body;
    try {
        const { data: shiftOrders } = await db.from('orders').select('total_amount').eq('shift_id', shift_id).neq('status', 'cancelled');
        const totalSales = (shiftOrders || []).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
        const { error } = await db.from('shifts').update({
            closing_cash: Number(closing_cash),
            expected_cash: Number(expected_cash),
            cash_difference: Number(cash_difference),
            total_sales: totalSales,
            status: 'CLOSED',
            closed_at: new Date().toISOString()
        }).eq('id', shift_id);
        if (error) throw error;

        shiftStatusCache.delete(String(shift_id));
        for (const k of shiftBillCounters.keys()) {
            if (k.endsWith(`_${shift_id}`)) shiftBillCounters.delete(k);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/shifts/expense', async (req, res) => {
    const { shop_id, shift_id, pin, amount, reason } = req.body;
    try {
        const { data: users } = await db.from('staff').select('*').eq('shop_id', shop_id).in('role', ['เจ้าของร้าน', 'ผู้จัดการ']);
        let validPin = false;
        for (const u of users) {
            if (u.pin && (u.pin.startsWith('$2a$') || u.pin.startsWith('$2b$'))) {
                if (await bcrypt.compare(String(pin), u.pin)) { validPin = true; break; }
            } else if (u.pin === String(pin)) { validPin = true; break; }
        }
        if (!validPin) return res.status(403).json({ success: false, error: "รหัส PIN ผู้มีอำนาจอนุมัติไม่ถูกต้อง" });

        const { error } = await db.from('shift_expenses').insert([{ shift_id, shop_id, amount: Number(amount), reason }]);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/shifts/:id/summary', async (req, res) => {
    try {
        const shiftId = req.params.id;
        const orders = await fetchAll(() => db.from('orders').select('*').eq('shift_id', shiftId).neq('status', 'cancelled'));
        const { data: expenses } = await db.from('shift_expenses').select('*').eq('shift_id', shiftId);
        const { data: shift } = await db.from('shifts').select('*').eq('id', shiftId).single();
        const orderIds = (orders || []).map(order => order.id);
        const { data: orderItems } = orderIds.length > 0
            ? await db.from('order_items').select('order_id, quantity, price, addon_price, product_id, products(name)').in('order_id', orderIds)
            : { data: [] };

        const totalSales = orders ? orders.reduce((acc, o) => acc + Number(o.total_amount), 0) : 0;
        
        let cashSales = 0, transferSales = 0, creditSales = 0;
        
        if (orders) {
            orders.forEach(o => {
                if (o.payment_method === 'เงินสด') cashSales += Number(o.total_amount);
                else if (o.payment_method === 'บัตรเครดิต') creditSales += Number(o.total_amount);
                else transferSales += Number(o.total_amount);
            });
        }

        const totalExpenses = expenses ? expenses.reduce((acc, e) => acc + Number(e.amount), 0) : 0;
        const expectedCash = Number(shift?.opening_cash || 0) + cashSales + totalExpenses;
        const productTotals = {};
        (orderItems || []).forEach(item => {
            const productName = item.products?.name || 'สินค้าไม่ระบุชื่อ';
            const key = item.product_id || productName;
            if (!productTotals[key]) productTotals[key] = { name: productName, quantity: 0, total: 0 };
            productTotals[key].quantity += Number(item.quantity) || 0;
            productTotals[key].total += (Number(item.price) + Number(item.addon_price || 0)) * (Number(item.quantity) || 0);
        });
        const soldProducts = Object.values(productTotals).sort((a, b) => b.quantity - a.quantity);
        const itemCount = (orderItems || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        const itemCountsByOrder = (orderItems || []).reduce((counts, item) => {
            counts[item.order_id] = (counts[item.order_id] || 0) + (Number(item.quantity) || 0);
            return counts;
        }, {});
        const chartData = (orders || [])
            .filter(order => order.created_at)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map(order => ({
                    timestamp: order.created_at,
                    amount: Number(order.total_amount) || 0,
                    orderCount: 1,
                    itemCount: itemCountsByOrder[order.id] || 0
            }));

        res.json({
            summary: {
                totalSales, cashSales, receiptCount: orders?.length || 0, itemCount,
                expectedCash, expensesList: expenses || [], chartData,
                payments: { cash: cashSales, transfer: transferSales, credit: creditSales }
            },
            soldProducts
        });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 10. API ระบบคลังสินค้า (Inventory) ---
// ==========================================
const decodeInventoryUnit = (unit) => {
    const value = String(unit || 'หน่วย');
    const parts = value.split('|');
    if (parts.length === 3 && Number(parts[1]) > 0) {
        return {
            unit: /[\u0080-\u009F\uFFFD]/.test(parts[0]) ? 'หน่วย' : parts[0],
            package_size: Number(parts[1]),
            package_unit: /[\u0080-\u009F\uFFFD]/.test(parts[2]) ? 'ชิ้น' : parts[2]
        };
    }
    const safeUnit = /[\u0080-\u009F\uFFFD]/.test(value) ? 'หน่วย' : value;
    return { unit: safeUnit, package_size: 1, package_unit: safeUnit };
};

const encodeInventoryUnit = (unit, packageSize, packageUnit) => {
    const baseUnit = String(unit || 'หน่วย').trim();
    const size = Number(packageSize || 1);
    const contentUnit = String(packageUnit || 'ชิ้น').trim();
    return size !== 1 ? `${baseUnit}|${size}|${contentUnit}` : baseUnit;
};

const presentInventoryItem = (item) => {
    const unitInfo = decodeInventoryUnit(item.unit);
    const expiryInfo = decodeInventoryExpiry(item);
    return {
        ...item,
        unit: unitInfo.unit,
        package_size: unitInfo.package_size,
        package_unit: unitInfo.package_unit,
        total_pieces: Number(item.quantity || 0) * unitInfo.package_size,
        cost_per_piece: unitInfo.package_size > 0 ? Number(item.cost || 0) / unitInfo.package_size : 0,
        mfg_date: expiryInfo.mfg_date,
        exp_date: expiryInfo.exp_date,
        no_expiry: expiryInfo.no_expiry,
        expiry_alert_days: expiryInfo.expiry_alert_days,
        expiry_status: expiryInfo.expiry_status,
        days_until_expiry: expiryInfo.days_until_expiry,
        expiry_batches: expiryInfo.expiry_batches || []
    };
};

const formatStockInDateSuffix = ({ mfg_date, exp_date, no_expiry }) => {
    const parts = [];
    if (mfg_date && String(mfg_date).trim()) {
        parts.push(`วันผลิต: ${formatThaiDate(mfg_date)}`);
    }
    if (no_expiry) {
        parts.push('ไม่มีวันหมดอายุ');
    } else if (exp_date && String(exp_date).trim()) {
        parts.push(`วันหมดอายุ: ${formatThaiDate(exp_date)}`);
    }
    return parts.length > 0 ? ` (${parts.join(' | ')})` : '';
};

app.get('/api/inventory/categories', async (req, res) => {
    try {
        let categoriesQuery = db.from('inventory_categories').select('id, name, type').eq('shop_id', req.query.shop_id);
        let { data: categories, error: catErr } = await categoriesQuery;
        if (catErr && String(catErr.message || '').toLowerCase().includes('type')) {
            const fallback = await db.from('inventory_categories').select('id, name').eq('shop_id', req.query.shop_id);
            categories = fallback.data || [];
        } else if (catErr) {
            throw catErr;
        }
        const { data: items, error: itemErr } = await db.from('inventory_items').select('category_id').eq('shop_id', req.query.shop_id);
        if (itemErr) throw itemErr;
        const itemCounts = new Map();
        (items || []).forEach(item => itemCounts.set(item.category_id, (itemCounts.get(item.category_id) || 0) + 1));
        res.json((categories || []).map(c => ({
            ...c,
            type: c.type || 'raw_material',
            item_count: itemCounts.get(c.id) || 0
        })));
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/inventory/categories', async (req, res) => {
    try {
        const { shop_id, name, type } = req.body;
        const normalizedShopId = Number(shop_id);
        const normalizedType = String(type || 'raw_material');
        if (!normalizedShopId || !String(name || '').trim()) return res.status(400).json({ error: 'กรุณาระบุร้านค้าและชื่อหมวดย่อย' });
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหมวดย่อยไม่ถูกต้อง' });

        const trimmedName = String(name).trim();
        const { data: duplicate, error: duplicateErr } = await db.from('inventory_categories').select('id').eq('shop_id', normalizedShopId).ilike('name', trimmedName).limit(1);
        if (duplicateErr) throw duplicateErr;
        if (duplicate && duplicate.length > 0) return res.status(409).json({ error: 'มีหมวดย่อยชื่อนี้อยู่แล้วในร้าน' });

        let categoryInsert = { shop_id: normalizedShopId, name: trimmedName };
        try {
            const { data, error } = await db.from('inventory_categories').insert([{ ...categoryInsert, type: normalizedType }]).select('*').single();
            if (error) throw error;
            const createdCategory = { ...data, type: data.type || 'raw_material' };
            return res.json({ success: true, message: "เพิ่มหมวดหมู่สต็อกสำเร็จ", id: createdCategory.id, category: createdCategory });
        } catch (err) {
            if (String(err.message || '').toLowerCase().includes('type')) {
                const { data, error } = await db.from('inventory_categories').insert([{ ...categoryInsert }]).select('*').single();
                if (error) throw error;
                const createdCategory = { ...data, type: 'raw_material' };
                return res.json({ success: true, message: "เพิ่มหมวดหมู่สต็อกสำเร็จ", id: createdCategory.id, category: createdCategory });
            }
            throw err;
        }
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/inventory/categories/:id', async (req, res) => {
    try {
        const { shop_id, name, type } = req.body;
        const normalizedShopId = Number(shop_id);
        const normalizedCategoryId = Number(req.params.id);
        const normalizedType = String(type || 'raw_material');
        if (!normalizedShopId || !String(name || '').trim()) return res.status(400).json({ error: 'กรุณาระบุร้านค้าและชื่อหมวดย่อย' });
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหมวดย่อยไม่ถูกต้อง' });

        const trimmedName = String(name).trim();
        const { data: existingCategory, error: existingError } = await db.from('inventory_categories').select('id, type').eq('id', normalizedCategoryId).eq('shop_id', normalizedShopId).maybeSingle();
        if (existingError) throw existingError;
        if (!existingCategory) return res.status(404).json({ error: 'ไม่พบหมวดย่อยนี้ในร้านของคุณ' });

        const { data: duplicate, error: duplicateErr } = await db.from('inventory_categories').select('id').eq('shop_id', normalizedShopId).ilike('name', trimmedName).neq('id', normalizedCategoryId).limit(1);
        if (duplicateErr) throw duplicateErr;
        if (duplicate && duplicate.length > 0) return res.status(409).json({ error: 'มีหมวดย่อยชื่อนี้อยู่แล้วในร้าน' });

        const categoryUpdate = { name: trimmedName };
        try {
            const { error: itemTypeError } = await db.from('inventory_items').update({ type: normalizedType }).eq('category_id', normalizedCategoryId).eq('shop_id', normalizedShopId);
            if (itemTypeError) throw itemTypeError;

            const { data, error } = await db.from('inventory_categories').update({ ...categoryUpdate, type: normalizedType }).eq('id', normalizedCategoryId).eq('shop_id', normalizedShopId).select('*').single();
            if (error) throw error;
            const updatedCategory = { ...data, type: data.type || 'raw_material' };
            return res.json({ success: true, message: 'แก้ไขหมวดย่อยสำเร็จ', id: updatedCategory.id, category: updatedCategory });
        } catch (err) {
            if (String(err.message || '').toLowerCase().includes('type')) {
                const { data, error } = await db.from('inventory_categories').update(categoryUpdate).eq('id', normalizedCategoryId).eq('shop_id', normalizedShopId).select('*').single();
                if (error) throw error;
                const updatedCategory = { ...data, type: 'raw_material' };
                return res.json({ success: true, message: 'แก้ไขหมวดย่อยสำเร็จ', id: updatedCategory.id, category: updatedCategory });
            }
            throw err;
        }
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/inventory/categories/:id', async (req, res) => {
    try {
        const shopId = Number(req.query.shop_id || req.body?.shop_id);
        const categoryId = Number(req.params.id);
        if (!shopId || !categoryId) return res.status(400).json({ error: 'กรุณาระบุร้านค้าและหมวดหมู่' });

        const { data: linkedItems, error: checkErr } = await db.from('inventory_items').select('id').eq('category_id', categoryId).eq('shop_id', shopId);
        if (checkErr) throw checkErr;

        if (linkedItems && linkedItems.length > 0) {
            const { error: unlinkError } = await db.from('inventory_items').update({ category_id: null }).eq('category_id', categoryId).eq('shop_id', shopId);
            if (unlinkError) throw unlinkError;
        }

        const { error } = await db.from('inventory_categories').delete().eq('id', categoryId).eq('shop_id', shopId);
        if (error) throw error;
        res.json({ success: true, message: 'ลบหมวดย่อยสำเร็จ และย้ายรายการที่ใช้หมวดนี้ออกแล้ว' });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/inventory/items', async (req, res) => {
    const { shop_id, category_id, search, item_ids, include_images, images_only } = req.query;
    try {
        if (images_only === 'true' && !item_ids) return res.status(400).json({ error: 'กรุณาระบุรายการสินค้าที่ต้องการโหลดรูป' });
        let itemIds;
        if (item_ids) {
            itemIds = String(item_ids).split(',').map(id => Number(id));
            if (itemIds.length > 50 || itemIds.some(id => !Number.isInteger(id) || id <= 0)) {
                return res.status(400).json({ error: 'รายการสินค้าที่ระบุไม่ถูกต้อง' });
            }
        }
        const columns = images_only === 'true'
            ? 'id, image_url'
            : include_images === 'false'
                ? 'id, shop_id, category_id, name, quantity, unit, min_threshold, sku, barcode, cost, type, status, inventory_categories(name)'
                : '*, inventory_categories(name)';
        let query = db.from('inventory_items').select(columns).eq('shop_id', shop_id).order('id', { ascending: true });
        if (category_id && category_id !== 'all') query = query.eq('category_id', category_id);
        if (search) query = query.ilike('name', `%${search}%`);
        if (itemIds) query = query.in('id', itemIds);
        const { data, error } = await query;
        if (error) throw error;
        res.json(data.map(item => images_only === 'true' ? item : presentInventoryItem({ ...item, category_name: item.inventory_categories?.name })));
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/inventory/items', async (req, res) => {
    const { shop_id, category_id, name, quantity, unit, package_size, package_unit, min_threshold, image_url, cost, type, status, mfg_date, exp_date, no_expiry, expiry_alert_days, expiry_batches } = req.body;
    try {
        if (!shop_id || !name) return res.status(400).json({ error: "กรุณาระบุร้านค้าและชื่อรายการ" });
        const normalizedType = String(type || 'raw_material');
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหลักไม่ถูกต้อง' });

        const isNoExpiry = Boolean(no_expiry);
        if (!isNoExpiry && mfg_date && exp_date && String(exp_date).slice(0, 10) < String(mfg_date).slice(0, 10)) {
            return res.status(400).json({ error: 'วันหมดอายุต้องไม่น้อยกว่าวันผลิต' });
        }
        if (!isNoExpiry && Array.isArray(expiry_batches)) {
            for (const b of expiry_batches) {
                if (b && !b.no_expiry && b.mfg_date && b.exp_date && String(b.exp_date).slice(0, 10) < String(b.mfg_date).slice(0, 10)) {
                    return res.status(400).json({ error: 'วันหมดอายุของแต่ละล็อตต้องไม่น้อยกว่าวันผลิต' });
                }
            }
        }

        let category = null;
        if (category_id) {
            try {
                const { data, error } = await db.from('inventory_categories').select('id, type').eq('id', category_id).eq('shop_id', shop_id).single();
                if (error) throw error;
                category = data;
            } catch (err) {
                const { data, error } = await db.from('inventory_categories').select('id').eq('id', category_id).eq('shop_id', shop_id).single();
                if (error || !data) return res.status(400).json({ error: 'ไม่พบหมวดย่อยที่เลือกในร้านนี้ หรือประเภทไม่ตรงกับประเภทหลัก' });
                category = { id: data.id, type: normalizedType };
            }
            if (category && category.type && String(category.type || 'raw_material') !== normalizedType) return res.status(400).json({ error: 'หมวดย่อยต้องเป็นประเภทเดียวกับประเภทหลักที่เลือก' });
        }

        const { data: shop, error: shopError } = await db.from('shops').select('id').eq('id', shop_id).maybeSingle();
        if (shopError) throw shopError;
        if (!shop) return res.status(400).json({ error: "ไม่พบร้านค้านี้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่" });

        const initialQuantity = Number(quantity || 0);
        const encodedExpiry = encodeInventoryExpiry({
            mfg_date,
            exp_date,
            no_expiry: isNoExpiry,
            expiry_alert_days,
            batches: expiry_batches,
            total_quantity: initialQuantity
        });

        const { data: createdItem, error } = await db.from('inventory_items').insert([{
            shop_id,
            category_id: category_id || null,
            name,
            quantity: initialQuantity,
            unit: encodeInventoryUnit(unit, package_size, package_unit),
            min_threshold: min_threshold || 0,
            image_url: image_url || null,
            sku: null,
            barcode: encodedExpiry,
            cost: cost || 0,
            type: normalizedType,
            status: status || 'active'
        }]).select('id, quantity, barcode').single();
        if (error) throw error;
        if (createdItem && initialQuantity !== 0) {
            const decodedCreated = decodeInventoryExpiry(createdItem);
            const dateSuffix = decodedCreated.expiry_batches && decodedCreated.expiry_batches.length > 1
                ? ` (${decodedCreated.expiry_batches.length} ล็อตวันหมดอายุ)`
                : formatStockInDateSuffix({ mfg_date: decodedCreated.mfg_date || mfg_date, exp_date: decodedCreated.exp_date || exp_date, no_expiry: isNoExpiry });
            const { error: movementError } = await db.from('stock_movements').insert([{
                shop_id,
                inventory_item_id: createdItem.id,
                movement_type: 'INITIAL_STOCK',
                quantity: initialQuantity,
                balance_after: initialQuantity,
                reason: `เพิ่มเข้าคลัง${dateSuffix}`
            }]);
            if (movementError) throw movementError;
        }
        if (createdItem) {
            await syncInventoryNotification({ shopId: shop_id, itemId: createdItem.id, userId: null });
        }
        res.json({ success: true, message: "เพิ่มรายการเข้าคลังสำเร็จ" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/inventory/items/:id', async (req, res) => {
    try {
        const { shop_id, category_id, name, unit, package_size, package_unit, min_threshold, image_url, cost, type, status, mfg_date, exp_date, no_expiry, expiry_alert_days, expiry_batches } = req.body;
        if (!shop_id) return res.status(400).json({ error: 'กรุณาระบุร้านค้า' });
        const normalizedType = String(type || 'raw_material');
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหลักไม่ถูกต้อง' });

        const isNoExpiry = Boolean(no_expiry);
        if (!isNoExpiry && mfg_date && exp_date && String(exp_date).slice(0, 10) < String(mfg_date).slice(0, 10)) {
            return res.status(400).json({ error: 'วันหมดอายุต้องไม่น้อยกว่าวันผลิต' });
        }
        if (!isNoExpiry && Array.isArray(expiry_batches)) {
            for (const b of expiry_batches) {
                if (b && !b.no_expiry && b.mfg_date && b.exp_date && String(b.exp_date).slice(0, 10) < String(b.mfg_date).slice(0, 10)) {
                    return res.status(400).json({ error: 'วันหมดอายุของแต่ละล็อตต้องไม่น้อยกว่าวันผลิต' });
                }
            }
        }

        let category = null;
        if (category_id) {
            try {
                const { data, error } = await db.from('inventory_categories').select('id, type').eq('id', category_id).eq('shop_id', shop_id).single();
                if (error) throw error;
                category = data;
            } catch (err) {
                const { data, error } = await db.from('inventory_categories').select('id').eq('id', category_id).eq('shop_id', shop_id).single();
                if (error || !data) return res.status(400).json({ error: 'ไม่พบหมวดย่อยที่เลือกในร้านนี้ หรือประเภทไม่ตรงกับประเภทหลัก' });
                category = { id: data.id, type: normalizedType };
            }
            if (category && category.type && String(category.type || 'raw_material') !== normalizedType) return res.status(400).json({ error: 'หมวดย่อยต้องเป็นประเภทเดียวกับประเภทหลักที่เลือก' });
        }

        const { data: existingItem, error: existingError } = await db.from('inventory_items').select('shop_id, quantity, barcode').eq('id', req.params.id).eq('shop_id', shop_id).single();
        if (existingError || !existingItem) return res.status(403).json({ error: 'ไม่พบรายการนี้ในร้านของคุณ' });

        const currentDecoded = decodeInventoryExpiry(existingItem);
        const batchesToSave = Array.isArray(expiry_batches)
            ? expiry_batches
            : currentDecoded.expiry_batches;

        const encodedExpiry = encodeInventoryExpiry({
            mfg_date,
            exp_date,
            no_expiry: isNoExpiry,
            expiry_alert_days,
            batches: batchesToSave,
            total_quantity: existingItem.quantity
        });
        const updates = {
            category_id: category_id || null,
            name,
            unit: encodeInventoryUnit(unit, package_size, package_unit),
            min_threshold: min_threshold ?? 0,
            image_url: image_url || null,
            barcode: encodedExpiry,
            cost: cost ?? 0,
            type: normalizedType,
            status: status || 'active'
        };

        const { error } = await db.from('inventory_items').update(updates).eq('id', req.params.id).eq('shop_id', shop_id);
        if (error) throw error;
        await syncInventoryNotification({ shopId: shop_id, itemId: req.params.id, userId: req.body.user_id || null });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/inventory/items/:id', async (req, res) => {
    try {
        const shopId = getShopIdFromReq(req);
        if (!shopId) return res.status(400).json({ error: 'กรุณาระบุร้านค้า' });
        const { error } = await db.from('inventory_items').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/inventory/adjust', async (req, res) => {
    const { shop_id, item_id, user_id, adjust_qty, reason, note, expected_quantity, mfg_date, exp_date, no_expiry, batch_id } = req.body;
    try {
        const amount = Number(adjust_qty);
        if (!shop_id || !item_id || !Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'กรุณาระบุจำนวนที่ถูกต้อง' });

        if (amount > 0 && !no_expiry && mfg_date && exp_date && String(exp_date).slice(0, 10) < String(mfg_date).slice(0, 10)) {
            return res.status(400).json({ error: 'วันหมดอายุต้องไม่น้อยกว่าวันผลิต' });
        }

        const { data: item, error: itemErr } = await db.from('inventory_items').select('quantity, shop_id, name, unit, barcode').eq('id', item_id).eq('shop_id', shop_id).single();
        if (itemErr || !item) throw new Error("ไม่พบวัตถุดิบในระบบ");
        const previousQuantity = Number(item.quantity || 0);
        if (expected_quantity !== undefined && Math.abs(Number(expected_quantity) - previousQuantity) > 0.001) {
            return res.status(409).json({ error: 'สต็อกถูกเปลี่ยนแปลงแล้ว ข้อมูลล่าสุดถูกอัปเดตแล้ว', current_stock: previousQuantity });
        }
        const newQty = Number((previousQuantity + amount).toFixed(6));
        if (newQty < 0) return res.status(400).json({ error: 'จำนวนที่ลดไม่สามารถมากกว่าสต็อกปัจจุบันได้' });

        let nextBarcode = item.barcode;
        let dateSuffix = '';

        if (amount > 0) {
            const hasBatchDates = Boolean(no_expiry) || (mfg_date && String(mfg_date).trim()) || (exp_date && String(exp_date).trim());
            if (hasBatchDates) {
                nextBarcode = addInventoryExpiryBatch(item, {
                    quantity: amount,
                    mfg_date: mfg_date || null,
                    exp_date: no_expiry ? null : (exp_date || null),
                    no_expiry: Boolean(no_expiry)
                });
                dateSuffix = formatStockInDateSuffix({
                    mfg_date: mfg_date || null,
                    exp_date: no_expiry ? null : (exp_date || null),
                    no_expiry: Boolean(no_expiry)
                });
            }
        } else if (amount < 0) {
            nextBarcode = deductInventoryExpiryBatch(item, {
                deduct_qty: Math.abs(amount),
                batch_id: batch_id || null,
                new_total_quantity: newQty
            });
        }

        const updatePayload = nextBarcode !== item.barcode
            ? { quantity: newQty, barcode: nextBarcode }
            : { quantity: newQty };

        const { data: updatedItem, error: updateErr } = await db.from('inventory_items')
            .update(updatePayload)
            .eq('id', item_id)
            .eq('shop_id', shop_id)
            .eq('quantity', previousQuantity)
            .select('quantity, barcode')
            .maybeSingle();
        if (updateErr) throw updateErr;
        if (!updatedItem) {
            const { data: latestItem, error: latestItemError } = await db.from('inventory_items')
                .select('quantity')
                .eq('id', item_id)
                .eq('shop_id', shop_id)
                .maybeSingle();
            if (latestItemError) throw latestItemError;
            return res.status(409).json({
                error: 'สต็อกถูกเปลี่ยนแปลงแล้ว ข้อมูลล่าสุดถูกอัปเดตแล้ว',
                current_stock: latestItem?.quantity
            });
        }

        const payload = {
            shop_id,
            inventory_item_id: item_id,
            movement_type: amount > 0 ? 'STOCK_IN' : 'STOCK_OUT',
            quantity: Number(Math.abs(amount).toFixed(6)),
            balance_after: newQty,
            reason: (reason || 'ปรับ Stock') + dateSuffix + (note ? ` - ${note}` : ''),
            created_by: user_id || null
        };
        const { data: movement, error: moveErr } = await db.from('stock_movements').insert([payload]).select('*').single();
        if (moveErr) {
            console.error('Inventory quantity updated but stock movement could not be recorded:', moveErr);
            return res.status(500).json({
                success: false,
                stock_updated: true,
                new_stock: updatedItem.quantity,
                error: 'ปรับสต็อกแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ'
            });
        }

        const [stockNotificationResult, adjustmentNotificationResult] = await Promise.allSettled([
            syncInventoryNotification({ shopId: shop_id, itemId: item_id, userId: user_id || null }),
            createNotification({
                shopId: shop_id,
                type: 'STOCK_ADJUST',
                priority: 'INFO',
                title: 'ปรับสต็อก',
                message: `ปรับสต็อก ${item.name} (${amount > 0 ? '+' : ''}${amount})${dateSuffix}`,
                entityType: 'inventory_item',
                entityId: item_id,
                metadata: { eventState: movement.id },
                userId: user_id || null
            })
        ]);
        if (stockNotificationResult.status === 'rejected') {
            console.error('Inventory adjustment saved, but stock alert sync failed:', stockNotificationResult.reason);
        }
        if (adjustmentNotificationResult.status === 'rejected') {
            console.error('Inventory adjustment saved, but adjustment notification failed:', adjustmentNotificationResult.reason);
        }

        const updatedExpiryInfo = decodeInventoryExpiry({ barcode: updatedItem.barcode, quantity: updatedItem.quantity });
        res.json({
            success: true,
            message: "ปรับสต็อกสำเร็จ",
            new_stock: updatedItem.quantity,
            movement,
            expiry_info: updatedExpiryInfo,
            notification_status: {
                stock_alert: stockNotificationResult.status === 'fulfilled' ? 'ok' : 'failed',
                stock_adjust: adjustmentNotificationResult.status === 'rejected'
                    ? 'failed'
                    : adjustmentNotificationResult.value ? 'active' : 'disabled'
            }
        });
    } catch (err) {
        console.error('Inventory stock adjustment failed:', err);
        res.status(500).json({ error: 'ปรับสต็อกไม่สำเร็จ กรุณาลองใหม่' });
    }
});

app.get('/api/inventory/:id', async (req, res) => {
    try {
        const shopId = req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'กรุณาระบุร้านค้า' });
        const { data, error } = await db.from('inventory_items').select('*').eq('id', req.params.id).eq('shop_id', shopId).single();
        if (error) throw error;
        res.json({ ...presentInventoryItem(data), stock: data.quantity, minStock: data.min_threshold || 10, movements: [] });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/stock-movements', async (req, res) => {
    try {
        const { shop_id, item_id, limit = 50 } = req.query;
        let query = db.from('stock_movements').select('*').eq('shop_id', shop_id).order('created_at', { ascending: false }).limit(limit);
        if (item_id) query = query.eq('inventory_item_id', item_id);
        const { data, error } = await query;
        if (error) throw error;
        const normalized = (data || []).map(row => ({
            ...row,
            quantity: Number(Number(row.quantity || 0).toFixed(6)),
            balance_after: Number(Number(row.balance_after || 0).toFixed(6))
        }));
        res.json(normalized);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 11. API การตั้งค่า & ช่องทางการชำระเงิน ---
// ==========================================
const defaultSettings = {
    shop_name: "ชื่อร้านของคุณ", branch_name: "สาขาหลัก", logo: "", address: "ที่อยู่ร้าน", phone: "-", email: "-", tax_id: "-",
    allow_negative_stock: false, auto_deduct_stock: true, allow_price_override: true, allow_discounts: true,
    require_reason_delete_item: true, require_reason_cancel_bill: true, auto_print_receipt: true, enable_e_receipt: false,
    receipt_show_logo: false, receipt_prefix: "INV-", receipt_start_number: "10001", receipt_footer: "ขอบคุณที่ใช้บริการ",
    pin_enabled: true,
    pin_settings: {},
    payment_cash_enabled: true, payment_qr_enabled: true, payment_transfer_enabled: false, payment_credit_enabled: false, payment_debit_enabled: false,
    alert_low_stock: true, low_stock_threshold: 10, vat_enabled: false, vat_rate: 7, prices_include_vat: true,
    notify_low_stock: true, notify_out_of_stock: true, notify_refund: true, notify_cancel_bill: true, notify_stock_adjust: true,
    hardware_printer_type: "none", hardware_barcode_scanner: false, hardware_cash_drawer: false, language: "th", currency: "THB", timezone: "auto", date_format: "DD/MM/YYYY", time_format: "24h"
};

app.get('/api/settings', async (req, res) => {
    const shop_id = req.query.shop_id || 1;
    try {
        const savedSettings = await getCachedShopSettings(shop_id);
        res.setHeader('Cache-Control', 'private, max-age=60');
        res.json({ shop_id: Number(shop_id), ...defaultSettings, ...(savedSettings || {}) });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

app.get('/api/staff-roles', async (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).json({ error: 'ต้องระบุอีเมลผู้ใช้' });
    }

    try {
        const { data: currentUser, error: userError } = await db.from('staff')
            .select('shop_id, role')
            .eq('email', email)
            .single();

        if (userError || !currentUser) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลพนักงาน' });
        }

        const { data: staffList, error: staffError } = await db.from('staff')
            .select('role')
            .eq('shop_id', currentUser.shop_id)
            .order('id', { ascending: true });

        if (staffError) throw staffError;

        const roles = Array.from(new Set((staffList || []).map((staff) => staff.role).filter(Boolean)));
        return res.json(roles);
    } catch (error) {
        return res.status(500).json({ error: error.message || 'ไม่สามารถโหลดสิทธิ์พนักงานได้' });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { error } = await db.from('shop_settings').upsert({ shop_id: req.body.shop_id, settings_data: req.body.data });
        if (error) throw error;
        invalidateShopSettings(req.body.shop_id);
        res.json({ success: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้วค่ะ" });
    } catch (error) { res.status(500).json({ error: "ไม่สามารถบันทึกข้อมูลได้" }); }
});

app.put('/api/users/:id/pin-setting', async (req, res) => {
    try {
        const { shop_id, pin_enabled } = req.body;
        const userId = req.params.id;

        if (!shop_id) {
            return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        }

        const { data: shopSettingsData, error: fetchError } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        const savedSettings = shopSettingsData?.settings_data ? (typeof shopSettingsData.settings_data === 'string' ? JSON.parse(shopSettingsData.settings_data) : shopSettingsData.settings_data) : {};
        const userPinMap = savedSettings.pin_settings && typeof savedSettings.pin_settings === 'object' && !Array.isArray(savedSettings.pin_settings)
            ? savedSettings.pin_settings
            : {};

        userPinMap[String(userId)] = Boolean(pin_enabled);

        const nextSettings = {
            ...savedSettings,
            pin_enabled: Boolean(pin_enabled),
            pin_settings: userPinMap,
        };

        const { error } = await db.from('shop_settings').upsert({ shop_id, settings_data: nextSettings });
        if (error) throw error;
        invalidateShopSettings(shop_id);

        res.json({ success: true, pin_enabled: Boolean(pin_enabled), user_id: Number(userId) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'ไม่สามารถบันทึกสถานะ PIN ของพนักงานได้' });
    }
});

app.get('/api/payment-methods', async (req, res) => {
    try {
        const shopId = req.query.shop_id;
        if (!shopId) return res.json([]);
        const cacheKey = String(shopId);
        const cached = paymentMethodsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return res.json(cached.data);
        }
        let { data, error } = await db.from('payment_methods').select('*').eq('shop_id', shopId).order('display_order', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
            const defaults = [
                { shop_id: shopId, name: 'เงินสด', type: 'CASH', is_enabled: true, display_order: 0 },
                { shop_id: shopId, name: 'QR พร้อมเพย์', type: 'QR', is_enabled: true, display_order: 1 },
                { shop_id: shopId, name: 'โอนเงิน', type: 'TRANSFER', is_enabled: true, display_order: 2 },
                { shop_id: shopId, name: 'บัตรเครดิต', type: 'CARD', is_enabled: false, display_order: 3 }
            ];
            const seeded = await db.from('payment_methods').insert(defaults).select('*');
            if (seeded.error) throw seeded.error;
            data = seeded.data || [];
        }
        paymentMethodsCache.set(cacheKey, { data, timestamp: Date.now() });
        return res.json(data);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/payment-methods', async (req, res) => {
    try {
        const { shop_id, name, type } = req.body;
        if (!shop_id || !String(name || '').trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อช่องทางการชำระเงิน' });
        const { count } = await db.from('payment_methods').select('*', { count: 'exact', head: true }).eq('shop_id', shop_id);
        const { data, error } = await db.from('payment_methods').insert([{
            shop_id, name: String(name).trim(), type: type || 'OTHER', is_enabled: true, display_order: count || 0
        }]).select('*').single();
        if (error) throw error;
        paymentMethodsCache.delete(String(shop_id));
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/payment-methods/:id', async (req, res) => {
    try {
        const { error } = await db.from('payment_methods').delete().eq('id', req.params.id).eq('shop_id', req.query.shop_id);
        if (error) throw error;
        paymentMethodsCache.delete(String(req.query.shop_id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/payment-methods', async (req, res) => {
    try {
        const results = await Promise.all(req.body.methods.map(m => db.from('payment_methods')
            .update({ is_enabled: m.is_enabled, display_order: m.display_order })
            .eq('id', m.id)
            .eq('shop_id', req.body.shop_id)));
        const failed = results.find(result => result.error);
        if (failed?.error) throw failed.error;
        paymentMethodsCache.delete(String(req.body.shop_id));
        res.json({ success: true, message: "อัปเดตช่องทางการชำระเงินเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 12. API โปรโมชั่น (Promotions) ---
// ==========================================
app.get('/api/promotions', async (req, res) => {
    try {
        const { data, error } = await db.from('promotions').select('*').eq('shop_id', req.query.shop_id).order('id', { ascending: false });
        if (error) {
            console.warn('GET /api/promotions warning (table may not exist in database):', error.message);
            return res.status(200).json([]);
        }
        res.json(data || []);
    } catch (err) {
        console.warn('GET /api/promotions catch (returning empty array):', err.message);
        res.status(200).json([]);
    }
});

app.post('/api/promotions', async (req, res) => {
    try {
        const { error } = await db.from('promotions').insert([req.body]);
        if (error) {
            console.warn('POST /api/promotions error:', error.message);
            return res.status(400).json({ error: 'ไม่พบตารางโปรโมชั่นในฐานข้อมูล กรุณาสร้างตาราง promotions ก่อนใช้งาน' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/promotions/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('promotions').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) {
            console.warn('PUT /api/promotions error:', error.message);
            return res.status(400).json({ error: 'ไม่พบตารางโปรโมชั่นในฐานข้อมูล' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/promotions/:id', async (req, res) => {
    try {
        const shopId = getShopIdFromReq(req);
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('promotions').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) {
            console.warn('DELETE /api/promotions error:', error.message);
            return res.status(400).json({ error: 'ไม่พบตารางโปรโมชั่นในฐานข้อมูล' });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

// ==========================================
// --- 13. API การจัดการพนักงาน (Staff) ---
// ==========================================
app.get('/api/staff', async (req, res) => {
    try {
        const { data, error } = await db.from('staff')
            .select('id, name, email, role, phone, status')
            .eq('shop_id', req.query.shop_id)
            .order('role', { ascending: true }) 
            .order('id', { ascending: true });
            
        if (error) throw error; 
        res.json((data || []).map(staff => ({ ...staff, image_url: null, created_at: null })));
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.post('/api/staff', async (req, res) => {
    const { shop_id, name, email, role, phone, pin, password, status } = req.body;
    try {
        const { data: existing } = await db.from('staff').select('id').eq('email', email).single();
        if (existing) return res.status(400).json({ error: "อีเมลนี้มีอยู่ในระบบแล้ว" });

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password || 'staff_password', salt);
        const hashedPin = pin ? await bcrypt.hash(String(pin), salt) : await bcrypt.hash('0000', salt);

        const { error } = await db.from('staff').insert([{
            shop_id, name, email, role, phone,
            password: hashedPass, pin: hashedPin, status: status || 'active'
        }]);
        if (error) throw error;
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.put('/api/staff/:id', async (req, res) => {
    const { name, role, phone, status, pin, password, shop_id } = req.body;
    try {
        const { data: existingStaff } = await db.from('staff').select('shop_id').eq('id', req.params.id).single();
        if (!existingStaff || existingStaff.shop_id !== shop_id) {
            return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึงข้อมูลพนักงานคนนี้" });
        }

        const updateData = { name, role, phone, status };
        
        if (pin && String(pin).trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            updateData.pin = await bcrypt.hash(String(pin), salt);
        }
        if (password && String(password).trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const { error } = await db.from('staff').update(updateData).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.delete('/api/staff/:id', async (req, res) => {
    try {
        const { shop_id } = req.body || {};
        if (!shop_id) return res.status(400).json({ error: "ต้องระบุร้านค้า" });

        const { data: existingStaff } = await db.from('staff').select('shop_id').eq('id', req.params.id).single();
        if (!existingStaff || String(existingStaff.shop_id) !== String(shop_id)) {
            return res.status(403).json({ error: "ไม่มีสิทธิ์ลบพนักงานคนนี้" });
        }

        const { error } = await db.from('staff').delete().eq('id', req.params.id).eq('shop_id', shop_id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/staff/:id/activity', async (req, res) => {
    const staffId = req.params.id;
    const shopId = req.query.shop_id;
    try {
        let activities = [];

        const orders = await fetchAll(() => db.from('orders')
            .select('bill_number, total_amount, created_at')
            .eq('staff_id', staffId)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(10));
            
        if (orders) {
            orders.forEach(o => activities.push({
                type: 'SALE',
                action: 'รับออเดอร์และชำระเงิน',
                detail: `เลขที่บิล: ${o.bill_number} ยอด: ฿${Number(o.total_amount).toLocaleString()}`,
                created_at: o.created_at
            }));
        }

        const { data: shifts } = await db.from('shifts')
            .select('id, opened_at, closed_at')
            .eq('staff_id', staffId)
            .eq('shop_id', shopId)
            .order('opened_at', { ascending: false })
            .limit(5);

        if (shifts) {
            shifts.forEach(s => {
                activities.push({
                    type: 'SHIFT_OPEN', action: 'เปิดรอบการขาย',
                    detail: `เปิดรอบการขาย (รหัส: ${s.id})`, created_at: s.opened_at
                });
                if (s.closed_at) {
                    activities.push({
                        type: 'SHIFT_CLOSE', action: 'ปิดรอบการขาย',
                        detail: `ปิดรอบการขาย (รหัส: ${s.id})`, created_at: s.closed_at
                    });
                }
            });
        }

        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(activities.slice(0, 15)); 
    } catch (err) { 
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); 
    }
});

// ==========================================
// --- 14. API สำหรับหน้า Dashboard Reports ---
// ==========================================

const parseReportTimestamp = (value) => {
    if (value instanceof Date) return value;
    const timestamp = String(value);
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
    return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
};

const getBangkokDateKey = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(parseReportTimestamp(value));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const getDateRange = (period, customStart, customEnd) => {
    const todayKey = getBangkokDateKey(new Date());
    let startDate = new Date(`${todayKey}T00:00:00+07:00`);
    let endDate = new Date(`${todayKey}T23:59:59.999+07:00`);

    if (period === 'เมื่อวาน') {
        startDate.setDate(startDate.getDate() - 1);
        endDate = new Date(`${getBangkokDateKey(startDate)}T23:59:59.999+07:00`);
    } else if (period === '7 วันที่ผ่านมา') {
        startDate.setDate(startDate.getDate() - 6);
    } else if (period === '30 วันที่ผ่านมา') {
        startDate.setDate(startDate.getDate() - 29);
    } else if (period === 'เดือนนี้') {
        startDate = new Date(`${todayKey.slice(0, 8)}01T00:00:00+07:00`);
    } else if (period === 'เดือนที่แล้ว') {
        startDate.setDate(1);
        startDate.setMonth(startDate.getMonth() - 1);
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setMilliseconds(-1);
    } else if (period === 'ปีนี้') {
        startDate = new Date(`${todayKey.slice(0, 4)}-01-01T00:00:00+07:00`);
    } else if (period === 'ปีที่แล้ว') {
        startDate = new Date(`${Number(todayKey.slice(0, 4)) - 1}-01-01T00:00:00+07:00`);
        endDate = new Date(`${Number(todayKey.slice(0, 4))}-01-01T00:00:00+07:00`);
        endDate.setMilliseconds(-1);
    } else if (period === 'ทั้งหมด') {
        startDate = new Date('1970-01-01T00:00:00+07:00');
        endDate = new Date('2999-12-31T23:59:59.999+07:00');
    } else if (period === 'กำหนดเอง' && customStart && customEnd) {
        startDate = new Date(`${customStart}T00:00:00+07:00`);
        endDate = new Date(`${customEnd}T23:59:59.999+07:00`);
    }
    return { start: startDate.toISOString(), end: endDate.toISOString() };
};

const fetchAllInChunks = async (qFn, col, vals) => {
    if (!vals || vals.length === 0) return [];
    let all = [];
    const sz = 200;
    for(let i=0; i<vals.length; i+=sz) {
        let c = vals.slice(i, i+sz);
        all = all.concat(await fetchAll(() => qFn().in(col, c)));
    }
    return all;
};

const fetchAll = async (qFn) => {
    let all = [], from = 0, limit = 1000;
    while(true) {
        const {data, error} = await qFn().range(from, from + limit - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < limit) break;
        from += limit;
    }
    return all;
};

app.get('/api/reports/summary', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        
        const orders = await fetchAll(() => db.from('orders')
            .select('id, total_amount, order_items(quantity)')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end));
            
        const totalBills = orders ? orders.length : 0;
        let netSales = 0;
        let totalItems = 0;
        if (orders) {
            for (const o of orders) {
                netSales += Number(o.total_amount || 0);
                if (Array.isArray(o.order_items)) {
                    for (const item of o.order_items) {
                        totalItems += Number(item.quantity || 0);
                    }
                }
            }
        }
        const avgBill = totalBills > 0 ? netSales / totalBills : 0;

        res.json({ summary: { netSales, totalBills, avgBill, totalItems } });
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/sales', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const orders = await fetchAll(() => db.from('orders')
            .select('id, bill_number, created_at, total_amount, payment_method, staff(name), order_items(quantity)')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true }));
        
        const itemCountsByOrder = {};
        if (orders) {
            for (const order of orders) {
                let count = 0;
                if (Array.isArray(order.order_items)) {
                    for (const item of order.order_items) {
                        count += Number(item.quantity || 0);
                    }
                }
                itemCountsByOrder[order.id] = count;
            }
        }
        const startKey = getBangkokDateKey(new Date(start));
        const endKey = getBangkokDateKey(new Date(end));
        const rangeStart = new Date(`${startKey}T00:00:00+07:00`);
        const rangeEnd = new Date(`${endKey}T23:59:59.999+07:00`);
        if (rangeStart > new Date()) return res.json({ chart: [] });
        const rangeDays = Math.floor((rangeEnd - rangeStart) / 86400000) + 1;
        const granularity = rangeDays === 1 ? 'hour' : rangeDays <= 93 ? 'day' : rangeDays <= 730 ? 'week' : 'month';
        const getBucketKey = (date) => {
            const reportDate = parseReportTimestamp(date);
            const dateKey = getBangkokDateKey(reportDate);
            if (granularity === 'hour') {
                const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(reportDate);
                return `${dateKey}T${hour}:00`;
            }
            if (granularity === 'week') {
                const day = new Date(`${dateKey}T00:00:00+07:00`);
                day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
                return getBangkokDateKey(day);
            }
            if (granularity === 'month') return dateKey.slice(0, 7);
            return dateKey;
        };
        const grouped = {};
        orders.forEach(order => {
            const key = getBucketKey(order.created_at);
            if (!grouped[key]) grouped[key] = { value: 0, orderCount: 0, itemCount: 0, orders: [] };
            const amount = Number(order.total_amount) || 0;
            const itemCount = itemCountsByOrder[order.id] || 0;
            grouped[key].value += amount;
            grouped[key].orderCount += 1;
            grouped[key].itemCount += itemCount;
            grouped[key].orders.push({
                id: order.id,
                billNumber: order.bill_number,
                createdAt: order.created_at,
                staffName: order.staff?.name || null,
                itemCount,
                amount,
                paymentMethod: order.payment_method || null
            });
        });

        const addBucket = (key) => {
            if (!grouped[key]) grouped[key] = { value: 0, orderCount: 0, itemCount: 0, orders: [] };
        };
        if (granularity === 'hour') {
            for (let hour = 0; hour < 24; hour += 1) addBucket(`${startKey}T${String(hour).padStart(2, '0')}:00`);
        } else if (granularity === 'day') {
            for (const cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) addBucket(getBangkokDateKey(cursor));
        }

        const chart = Object.keys(grouped).sort().map(key => {
            const bucket = grouped[key];
            return {
                key,
                label: key,
                value: bucket.value,
                orderCount: bucket.orderCount,
                itemCount: bucket.itemCount,
                averageBill: bucket.orderCount ? bucket.value / bucket.orderCount : 0,
                orders: bucket.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            };
        });

        res.json({ chart, granularity });
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/payments', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const orders = await fetchAll(() => db.from('orders').select('payment_method, total_amount')
            .eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end));
        
        if (!orders || orders.length === 0) return res.json([]);
        const grouped = orders.reduce((acc, o) => {
            const method = o.payment_method || 'เงินสด';
            if(!acc[method]) acc[method] = { count: 0, sum: 0 };
            acc[method].count += 1;
            acc[method].sum += Number(o.total_amount);
            return acc;
        }, {});
        
        res.json(Object.keys(grouped).map(k => ({
            "ช่องทาง": k, "จำนวนรายการ": grouped[k].count, "ยอดรวม (฿)": grouped[k].sum.toLocaleString()
        })));
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/products', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const orders = await fetchAll(() => db.from('orders')
            .select('id, order_items(quantity, price, products(name, category_id))')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end));
        
        if (!orders || orders.length === 0) return res.json([]);

        const productSales = {};
        for (const order of orders) {
            if (Array.isArray(order.order_items)) {
                for (const i of order.order_items) {
                    const pName = i.products?.name || 'Unknown';
                    if (!productSales[pName]) productSales[pName] = { qty: 0, sum: 0 };
                    productSales[pName].qty += Number(i.quantity || 0);
                    productSales[pName].sum += (Number(i.quantity || 0) * Number(i.price || 0));
                }
            }
        }

        const topProducts = Object.keys(productSales).sort((a,b) => productSales[b].qty - productSales[a].qty).slice(0, 10).map(k => ({
            "ชื่อสินค้า": k, "ขายได้ (ชิ้น)": productSales[k].qty, "ยอดรวม (฿)": productSales[k].sum.toLocaleString()
        }));

        res.json(topProducts);
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/inventory', async (req, res) => {
    try {
        const { shop_id } = req.query;
        const { data: inv } = await db.from('inventory_items').select('id, name, quantity, min_threshold, unit, type').eq('shop_id', shop_id);
        if (!inv) return res.json({ outOfStock: 0, lowStock: 0, table: [] });

        const outOfStock = inv.filter(i => Number(i.quantity) <= 0).length;
        const lowStock = inv.filter(i => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.min_threshold)).length;

        const table = inv.filter(i => Number(i.quantity) <= Number(i.min_threshold)).map(i => {
            const decoded = decodeInventoryUnit(i.unit);
            const unitName = decoded.unit || i.unit || '';
            const qtyFormatted = Number(Number(i.quantity || 0).toFixed(2));
            const minFormatted = Number(Number(i.min_threshold || 0).toFixed(2));
            return {
                id: i.id,
                "ชื่อวัตถุดิบ": i.name,
                "คงเหลือ": `${qtyFormatted} ${unitName}`,
                "ขั้นต่ำ": `${minFormatted} ${unitName}`,
                "สถานะ": Number(i.quantity) <= 0 ? "หมด" : "ต่ำ"
            };
        });

        res.json({ totalItems: inv.length, outOfStock, lowStock, asOf: new Date().toISOString(), table });
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/stock-movement', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        if (!shop_id) return res.status(400).json({ error: 'กรุณาระบุร้านค้า' });
        const { start, end } = getDateRange(period, startDate, endDate);
        const movements = await fetchAll(() => db.from('stock_movements').select('id, created_at, movement_type, quantity, balance_after, reason, reference_id, inventory_item_id')
            .eq('shop_id', shop_id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }));
        if (!movements || movements.length === 0) {
            return res.json({
                summary: [],
                movements: [],
                totalItemsUsed: 0,
                lowStockCount: 0,
                totalEstimatedCost: 0
            });
        }

        const { data: inventoryItems, error: inventoryError } = await db.from('inventory_items')
            .select('id, name, unit, quantity, min_threshold, cost, type, sku, category_id, inventory_categories(name)')
            .eq('shop_id', shop_id);
        if (inventoryError) throw inventoryError;

        const orderIds = [...new Set(movements.map(m => m.reference_id).filter(Boolean))];
        const orders = orderIds.length > 0
            ? await fetchAllInChunks(() => db.from('orders').select('id, bill_number').eq('shop_id', shop_id), 'id', orderIds)
            : [];
        const itemDetails = new Map((inventoryItems || []).map(item => {
            const decoded = decodeInventoryUnit(item.unit);
            return [item.id, {
                ...item,
                unit: decoded.unit,
                package_size: decoded.package_size,
                package_unit: decoded.package_unit,
                category_name: item.inventory_categories?.name || '-'
            }];
        }));
        const billNumbers = new Map((orders || []).map(order => [String(order.id), order.bill_number]));
        const movementLabels = {
            SALE: 'ใช้ไปจากการขาย',
            VOID_RETURN: 'คืนสต็อกจากการยกเลิกบิล (Void)',
            ADJUSTMENT: 'ปรับ Stock',
            INITIAL_STOCK: 'เพิ่มเข้าคลัง',
            STOCK_IN: 'เพิ่มเข้าสต็อก',
            STOCK_OUT: 'ลดสต็อก (ปรับออก)'
        };

        const summaryMap = new Map();

        for (const m of movements) {
            const itemId = m.inventory_item_id;
            if (!itemId) continue;
            const item = itemDetails.get(itemId);
            if (!item) continue;

            if (!summaryMap.has(itemId)) {
                summaryMap.set(itemId, {
                    itemId,
                    name: item.name,
                    categoryName: item.category_name,
                    sku: item.sku,
                    type: item.type,
                    mainUnit: item.unit,
                    packageSize: Number(item.package_size || 1),
                    packageUnit: item.package_unit,
                    costPerUnit: Number(item.cost || 0),
                    currentStockBase: Number(item.quantity || 0),
                    minThresholdBase: Number(item.min_threshold || 0),
                    salesUsageBase: 0,
                    voidReturnBase: 0,
                    stockOutBase: 0,
                    adjustLossBase: 0,
                    salesCount: 0
                });
            }

            const agg = summaryMap.get(itemId);
            const qty = Number(m.quantity || 0);

            if (m.movement_type === 'SALE') {
                agg.salesUsageBase += Math.abs(qty);
                agg.salesCount += 1;
            } else if (m.movement_type === 'VOID_RETURN') {
                agg.voidReturnBase += Math.abs(qty);
            } else if (m.movement_type === 'STOCK_OUT') {
                agg.stockOutBase += Math.abs(qty);
            } else if (m.movement_type === 'ADJUSTMENT' && qty < 0) {
                agg.adjustLossBase += Math.abs(qty);
            }
        }

        const summary = [];
        for (const agg of summaryMap.values()) {
            const netUsedBase = (agg.salesUsageBase - agg.voidReturnBase) + agg.stockOutBase + agg.adjustLossBase;
            if (netUsedBase <= 0) continue;

            const roundedNetUsedBase = Number(netUsedBase.toFixed(4));
            const packageSize = agg.packageSize;
            const totalUsedQuantity = Number((roundedNetUsedBase * packageSize).toFixed(2));
            const currentStockDetail = Number((agg.currentStockBase * packageSize).toFixed(2));
            const minThresholdDetail = Number((agg.minThresholdBase * packageSize).toFixed(2));

            let suggestedBuyPackages;
            let suggestedBuyQuantity;
            let suggestedBuyText;

            if (packageSize > 1) {
                suggestedBuyPackages = Math.max(1, Math.ceil(roundedNetUsedBase));
                suggestedBuyQuantity = suggestedBuyPackages * packageSize;
                suggestedBuyText = `${suggestedBuyPackages} ${agg.mainUnit} (${suggestedBuyQuantity.toLocaleString()} ${agg.packageUnit})`;
            } else {
                suggestedBuyPackages = Math.max(1, Math.ceil(totalUsedQuantity));
                suggestedBuyQuantity = suggestedBuyPackages;
                suggestedBuyText = `${suggestedBuyPackages.toLocaleString()} ${agg.mainUnit}`;
            }

            const estimatedCost = Number((suggestedBuyPackages * agg.costPerUnit).toFixed(2));

            let status = 'normal';
            if (agg.currentStockBase <= 0) {
                status = 'out';
            } else if (agg.currentStockBase <= agg.minThresholdBase) {
                status = 'low';
            }

            summary.push({
                itemId: agg.itemId,
                name: agg.name,
                categoryName: agg.categoryName,
                sku: agg.sku,
                type: agg.type,
                mainUnit: agg.mainUnit,
                packageUnit: agg.packageUnit,
                packageSize: agg.packageSize,
                totalUsedBase: roundedNetUsedBase,
                totalUsedQuantity,
                totalUsedText: packageSize > 1 
                    ? `${totalUsedQuantity.toLocaleString()} ${agg.packageUnit} (${roundedNetUsedBase} ${agg.mainUnit})`
                    : `${totalUsedQuantity.toLocaleString()} ${agg.mainUnit}`,
                salesCount: agg.salesCount,
                currentStockBase: agg.currentStockBase,
                currentStockQuantity: currentStockDetail,
                currentStockText: packageSize > 1
                    ? `${currentStockDetail.toLocaleString()} ${agg.packageUnit} (${Number(agg.currentStockBase.toFixed(2))} ${agg.mainUnit})`
                    : `${currentStockDetail.toLocaleString()} ${agg.mainUnit}`,
                minThresholdBase: agg.minThresholdBase,
                minThresholdQuantity: minThresholdDetail,
                suggestedBuyPackages,
                suggestedBuyQuantity,
                suggestedBuyText,
                costPerUnit: agg.costPerUnit,
                estimatedCost,
                status
            });
        }

        const statusPriority = { out: 1, low: 2, normal: 3 };
        summary.sort((a, b) => {
            if (statusPriority[a.status] !== statusPriority[b.status]) {
                return statusPriority[a.status] - statusPriority[b.status];
            }
            return b.totalUsedBase - a.totalUsedBase;
        });

        const totalEstimatedCost = Number(summary.reduce((sum, item) => sum + (item.estimatedCost || 0), 0).toFixed(2));
        const lowStockCount = summary.filter(s => s.status === 'out' || s.status === 'low').length;

        const formattedMovements = movements.slice(0, 100).map(m => {
            const item = itemDetails.get(m.inventory_item_id) || { name: '-', unit: 'หน่วย', package_size: 1, package_unit: 'หน่วย' };
            const packageSize = Number(item.package_size || 1);
            const changedQuantity = Number(m.quantity) * packageSize;
            const balanceAfter = m.balance_after == null ? null : Number(m.balance_after) * packageSize;
            const billNumber = billNumbers.get(String(m.reference_id));
            return {
                "id": m.id,
                "วันที่": new Date(m.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }),
                "created_at": m.created_at,
                "รายการวัตถุดิบ": item.name || '-',
                "item_id": m.inventory_item_id,
                "ประเภท": movementLabels[m.movement_type] || m.movement_type,
                "movement_type": m.movement_type,
                "จำนวนที่เปลี่ยน": changedQuantity > 0 ? `+${changedQuantity}` : changedQuantity,
                "quantity_number": changedQuantity,
                "หน่วย": item.package_unit || 'หน่วย',
                "คงเหลือหลังรายการ": balanceAfter ?? '-',
                "รายละเอียด": billNumber ? `บิล ${billNumber}` : (m.reason || '-')
            };
        });

        res.json({
            summary,
            movements: formattedMovements,
            totalItemsUsed: summary.length,
            lowStockCount,
            totalEstimatedCost
        });
    } catch (e) {
        console.error('Stock movement report error:', e);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
});

app.get('/api/reports/employees', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const orders = await fetchAll(() => db.from('orders').select('staff_id, total_amount, staff(name)')
            .eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end));
        
        if (!orders || orders.length === 0) return res.json([]);
        const grouped = orders.reduce((acc, o) => {
            const sName = o.staff?.name || 'พนักงาน (ไม่ระบุ)';
            if(!acc[sName]) acc[sName] = { bills: 0, sum: 0 };
            acc[sName].bills += 1;
            acc[sName].sum += Number(o.total_amount);
            return acc;
        }, {});

        res.json(Object.keys(grouped).map(k => ({
            "พนักงาน": k, "จำนวนบิล": grouped[k].bills, "ยอดขาย (฿)": grouped[k].sum.toLocaleString()
        })));
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/shifts', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: shifts } = await db.from('shifts').select('opened_at, closed_at, total_sales, staff(name)')
            .eq('shop_id', shop_id).gte('opened_at', start).lte('opened_at', end).order('opened_at', { ascending: false });
        
        if (!shifts || shifts.length === 0) return res.json([]);
        res.json(shifts.map(s => ({
            "พนักงาน": s.staff?.name || '-', "เวลาเปิดกะ": new Date(s.opened_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
            "สถานะ": s.closed_at ? 'ปิดแล้ว' : 'กำลังเปิด', "ยอดขาย": Number(s.total_sales || 0).toLocaleString()
        })));
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/profit', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        
        const orders = await fetchAll(() => db.from('orders')
            .select('id, total_amount, order_items(product_id, quantity)')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end));
        const revenue = orders ? orders.reduce((sum, o) => sum + Number(o.total_amount), 0) : 0;

        const { data: exps } = await db.from('shift_expenses').select('amount').eq('shop_id', shop_id).gte('created_at', start).lte('created_at', end);
        const expenses = exps ? exps.filter(e => Number(e.amount) > 0).reduce((sum, e) => sum + Number(e.amount), 0) : 0;

        const soldItems = [];
        if (orders) {
            for (const order of orders) {
                if (Array.isArray(order.order_items)) {
                    soldItems.push(...order.order_items);
                }
            }
        }
        const productIds = [...new Set((soldItems || []).map(item => item.product_id).filter(Boolean))];
        const recipes = await fetchAllInChunks(() => db.from('recipes').select('product_id, quantity, inventory_items(cost, unit)'), 'product_id', productIds);
        const recipesByProduct = (recipes || []).reduce((map, recipe) => {
            if (!map[recipe.product_id]) map[recipe.product_id] = [];
            map[recipe.product_id].push(recipe);
            return map;
        }, {});
        let cogs = 0;
        let cogsAvailable = true;
        (soldItems || []).forEach(item => {
            const productRecipes = recipesByProduct[item.product_id] || [];
            if (!item.product_id || productRecipes.length === 0 || productRecipes.some(recipe => recipe.inventory_items?.cost == null || Number(recipe.inventory_items.cost) <= 0 || Number.isNaN(Number(recipe.inventory_items.cost)))) {
                cogsAvailable = false;
                return;
            }
            productRecipes.forEach(recipe => {
                const getPkgSize = (u) => { const p = String(u||'').split('|'); return (p.length===3 && Number(p[1])>0) ? Number(p[1]) : 1; };
                const pkgSize = getPkgSize(recipe.inventory_items?.unit);
                const costPerPiece = (Number(recipe.inventory_items?.cost) || 0) / pkgSize;
                cogs += (Number(item.quantity) || 0) * (Number(recipe.quantity) || 0) * costPerPiece;
            });
        });

        res.json({ revenue, expenses, cogs: cogsAvailable ? cogs : null, cogsAvailable, netProfit: cogsAvailable ? revenue - expenses - cogs : null });
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});

app.get('/api/reports/customers', (req, res) => res.json({ available: false, message: 'ยังไม่มีข้อมูลลูกค้าใน schema ปัจจุบัน' }));
app.get('/api/reports/tax', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const data = await getCachedShopSettings(shop_id);
        if (!data.vat_enabled) return res.json({ available: false, message: 'ยังไม่ได้เปิดใช้งานภาษีมูลค่าเพิ่ม' });
        const orders = await fetchAll(() => db.from('orders').select('total_amount').eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end));
        const total = (orders || []).reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
        const rate = Number(data.vat_rate) || 0;
        const tax = data.prices_include_vat ? total * rate / (100 + rate) : total * rate / 100;
        res.json([{ "อัตราภาษี": `${rate}%`, "ฐานภาษี (฿)": (data.prices_include_vat ? total - tax : total).toLocaleString(), "ภาษี (฿)": tax.toLocaleString() }]);
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.get('/api/reports/discounts', (req, res) => res.json({ available: false, message: 'ยังไม่มีข้อมูลส่วนลดที่บันทึกใน orders schema ปัจจุบัน' }));
app.get('/api/reports/returns', (req, res) => res.json({ available: false, message: 'ยังไม่มีตารางหรือสถานะการคืนสินค้าใน schema ปัจจุบัน' }));
app.get('/api/reports/expenses', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data, error } = await db.from('shift_expenses').select('amount, reason, created_at').eq('shop_id', shop_id).gt('amount', 0).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false });
        if (error) throw error;
        res.json((data || []).map(expense => ({ "วันที่": new Date(expense.created_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }), "รายการ": expense.reason || 'ไม่ระบุ', "จำนวนเงิน (฿)": Number(expense.amount).toLocaleString() })));
    } catch (e) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
app.get('/api/reports/export', (req, res) => res.send("ระบบ Export กำลังอยู่ในช่วงพัฒนา"));

// ==========================================
// --- 11. API ลบบัญชีร้านค้า (Close Account) ---
// ==========================================
app.delete('/api/shops/close', async (req, res) => {
    try {
        const { shop_id, user_id, password } = req.body;
        if (!shop_id || !user_id || !password) {
            return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน (shop_id, user_id, password)" });
        }

        const { data: user, error: userError } = await db.from('staff').select('*, shops(owner_email)').eq('id', user_id).eq('shop_id', shop_id).single();
        if (userError || !user) {
            return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้" });
        }

        if (user.role !== 'เจ้าของร้าน') {
            return res.status(403).json({ error: "เฉพาะเจ้าของร้านเท่านั้นที่สามารถลบบัญชีได้" });
        }

        let validPassword = false;
        if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
            validPassword = await bcrypt.compare(password, user.password);
        } else {
            validPassword = (password === user.password);
        }

        if (!validPassword) {
            return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        }

        const { error: deleteError } = await db.from('shops').delete().eq('id', shop_id);
        
        if (deleteError) {
            throw deleteError;
        }

        res.json({ success: true, message: "ปิดบัญชีร้านค้าเรียบร้อยแล้ว" });
    } catch (err) {
        console.error('DELETE /api/shops/close error:', err);
        res.status(500).json({ error: "ไม่สามารถลบบัญชีได้: " + err.message });
    }
});

// ==========================================
// --- ตั้งเวลาทำงานอัตโนมัติ (Cron Jobs) ---
// ==========================================
// เคลียร์การแจ้งเตือนที่เก่ากว่า 30 วัน (ทำงานทุกเที่ยงคืน)
cron.schedule('0 0 * * *', async () => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { error } = await db.from('notifications')
            .delete()
            .lt('created_at', thirtyDaysAgo.toISOString());
            
        if (error) {
            console.error('Cron: Error deleting old notifications:', error);
        } else {
            console.log('Cron: Successfully deleted notifications older than 30 days');
        }
    } catch (err) {
        console.error('Cron: Exception in deleting old notifications:', err);
    }
});

// ==========================================
// --- เริ่มการทำงานของ Server ---
// ==========================================
const PORT = process.env.PORT || 5000;
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
            console.error(`Please kill the process using port ${PORT} or change the PORT in .env file.\n`);
            process.exit(1);
        } else {
            console.error('Server error:', err);
        }
    });
}

// ==========================================
// --- 10.5 API ศูนย์การแจ้งเตือน ---
// ==========================================
const inventoryNotificationSyncAt = new Map();

app.get('/api/notifications', async (req, res) => {
    try {
        const { shop_id, user_id, unread_only, type, priority, limit = 30, offset = 0 } = req.query;

        if (!shop_id || !user_id) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุ shop_id และ user_id' });
        }

        const shopId = Number(shop_id);
        const userId = Number(user_id);
        if (!Number.isFinite(shopId) || !Number.isFinite(userId)) {
            return res.status(400).json({ success: false, error: 'shop_id และ user_id ต้องเป็นตัวเลข' });
        }

        const lastInventorySync = inventoryNotificationSyncAt.get(shopId) || 0;
        if (Date.now() - lastInventorySync >= 300_000) {
            inventoryNotificationSyncAt.set(shopId, Date.now());
            try {
                const [inventoryResult, activeAlertsResult] = await Promise.all([
                    db.from('inventory_items').select('id, quantity, min_threshold, barcode, status').eq('shop_id', shopId),
                    db.from('notifications').select('entity_id')
                        .eq('shop_id', shopId)
                        .eq('entity_type', 'inventory_item')
                        .eq('is_active', true)
                        .in('type', ['STOCK_LOW', 'STOCK_OUT', 'STOCK_EXPIRING', 'STOCK_EXPIRED'])
                ]);
                if (inventoryResult.error) throw inventoryResult.error;
                if (activeAlertsResult.error) throw activeAlertsResult.error;

                const activeAlertItemIds = new Set((activeAlertsResult.data || []).map((alert) => String(alert.entity_id)));
                const itemsToSync = (inventoryResult.data || []).filter((item) => {
                    const quantity = Number(item.quantity || 0);
                    const minimum = Number(item.min_threshold || 0);
                    const expiryInfo = decodeInventoryExpiry(item);
                    const hasExpiryAlert = quantity > 0 && item.status !== 'inactive' && !expiryInfo.no_expiry &&
                        (expiryInfo.expiry_status === 'EXPIRED' || expiryInfo.expiry_status === 'EXPIRES_TODAY' || expiryInfo.expiry_status === 'EXPIRING_SOON');
                    return quantity <= 0 || (minimum > 0 && quantity <= minimum) || hasExpiryAlert || activeAlertItemIds.has(String(item.id));
                });

                await Promise.all(itemsToSync.map((item) =>
                    syncInventoryNotification({ shopId, itemId: item.id, userId })
                ));
            } catch (syncError) {
                inventoryNotificationSyncAt.delete(shopId);
                console.error('Notification feed inventory sync failed:', syncError);
            }
        }

        let query = db.from('notifications').select('*', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true).order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Math.min(Number(limit), 100) - 1);
        if (unread_only === 'true') query = query.eq('is_read', false);
        if (type) {
            if (type.includes(',')) {
                query = query.in('type', type.split(','));
            } else {
                query = query.eq('type', type);
            }
        }
        if (priority) query = query.eq('priority', priority);

        const { data, count, error } = await query;
        if (error) throw error;

        const { count: unreadCount, error: unreadError } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('is_active', true).eq('is_read', false);
        if (unreadError) throw unreadError;

        return res.status(200).json({
            success: true,
            notifications: data || [],
            total: count || 0,
            unreadCount: unreadCount || 0
        });
    } catch (err) {
        console.error('GET /api/notifications error:', err);
        return res.status(500).json({
            success: false,
            error: 'ไม่สามารถโหลดการแจ้งเตือนได้',
            hint: 'กรุณารัน backend/notifications.sql ใน Supabase ก่อนใช้งาน'
        });
    }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
        const { shop_id } = req.body;
        if (!shop_id) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุ shop_id' });
        }

        const { data, error } = await db.from('notifications').update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('shop_id', shop_id).select('*').single();
        if (error) throw error;

        return res.status(200).json({ success: true, notification: data });
    } catch (err) {
        console.error('PATCH /api/notifications/:id/read error:', err);
        return res.status(500).json({ success: false, error: 'ไม่สามารถอัปเดตการแจ้งเตือนได้' });
    }
});

app.patch('/api/notifications/read-all', async (req, res) => {
    try {
        const { shop_id } = req.body;
        if (!shop_id) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุ shop_id' });
        }

        const { error } = await db.from('notifications').update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('shop_id', shop_id).eq('is_active', true).eq('is_read', false);
        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('PATCH /api/notifications/read-all error:', err);
        return res.status(500).json({ success: false, error: 'ไม่สามารถอ่านการแจ้งเตือนทั้งหมดได้' });
    }
});

module.exports = app;