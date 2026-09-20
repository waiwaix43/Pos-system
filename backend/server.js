const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db'); // Supabase client
const bcrypt = require('bcryptjs');
const { syncInventoryNotification } = require('./notificationService');

const app = express();
app.use(cors()); 
app.use(express.json({ limit: '10mb' })); 

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
                name: isOwner ? admin_name : `${r.roleName} ${index}`,
                phone: isOwner ? admin_phone : null,
                email: isOwner ? admin_email : `${getEmailPrefix(r.roleName)}_${index}@${shop_name.replace(/\s+/g, '')}.com`,
                password: isOwner ? hashedAdminPassword : hashedStaffPassword,
                role: r.roleName,
                pin: r.pin ? await bcrypt.hash(String(r.pin), salt) : null
            };
        }));

        const { error: staffErr } = await db.from('staff').insert(staffValues);
        if (staffErr) { await db.from('shops').delete().eq('id', shopId); throw staffErr; }

        const fullAddress = `${address || ''} ${sub_district || ''} ${district || ''} ${province || ''} ${zipcode || ''}`.trim();
        const defaultShopSettings = {
            shop_name, branch_name: branch || 'สาขาหลัก', logo: profile_image || "", 
            address: fullAddress || "กรุณาระบุที่อยู่ร้าน", phone: shop_phone || "-", email: shop_email || admin_email, tax_id: "-",
            allow_negative_stock: false, auto_deduct_stock: true, allow_price_override: true, allow_discounts: true,
            require_reason_delete_item: true, require_reason_cancel_bill: true, auto_print_receipt: true, enable_e_receipt: false,
            receipt_show_logo: false, receipt_prefix: "INV-", receipt_start_number: "10001", receipt_footer: "ขอบคุณที่ใช้บริการ",
            pin_enabled: Array.isArray(roles) && roles.length > 0,
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

        const { data: shopSettingsData } = await db.from('shop_settings').select('settings_data').eq('shop_id', user.shop_id).single();
        const savedSettings = shopSettingsData?.settings_data ? (typeof shopSettingsData.settings_data === 'string' ? JSON.parse(shopSettingsData.settings_data) : shopSettingsData.settings_data) : {};
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
            user: { id: user.id, email: user.email, name: user.name, role: user.role, pin: user.pin, pin_enabled: pinEnabled, shop_id: user.shop_id, shop_name: user.shops?.shop_name || '-', branch: user.shops?.branch || 'สาขาหลัก', profile_image: user.shops?.profile_image || '' } 
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 3. API ตรวจสอบ & รีเซ็ต PIN ---
// ==========================================
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
            res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, shop_id: user.shop_id, shop_name: user.shops?.shop_name || '-', branch: user.shops?.branch || 'สาขาหลัก', profile_image: user.shops?.profile_image || '' } });
        } else { res.status(401).json({ success: false, error: "รหัส PIN ไม่ถูกต้อง" }); }
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/change-password', async (req, res) => {
    const { email, oldPass, newPass, confirmPass } = req.body;
    if (!email || !oldPass || !newPass || !confirmPass) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }
    if (String(newPass).length < 6) {
        return res.status(400).json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
    }
    if (String(newPass) !== String(confirmPass)) {
        return res.status(400).json({ error: "รหัสผ่านใหม่กับยืนยันรหัสผ่านไม่ตรงกัน" });
    }
    try {
        const { data: user, error } = await db.from('staff').select('id, password').eq('email', email).single();
        if (error || !user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

        const validPassword = user.password?.startsWith('$2a$') || user.password?.startsWith('$2b$')
            ? await bcrypt.compare(String(oldPass), user.password)
            : String(oldPass) === user.password;
        if (!validPassword) return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

        const hashedPassword = await bcrypt.hash(String(newPass), await bcrypt.genSalt(10));
        const { error: updateError } = await db.from('staff').update({ password: hashedPassword }).eq('id', user.id);
        if (updateError) throw updateError;
        res.json({ success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/change-pin', async (req, res) => {
    const { email, oldPin, newPin, confirmPin } = req.body;
    if (!email || !oldPin || !newPin || !confirmPin) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }
    if (!/^\d{4}$/.test(String(newPin))) {
        return res.status(400).json({ error: "กรุณากรอก PIN ใหม่เป็นตัวเลข 4 หลัก" });
    }
    if (String(newPin) !== String(confirmPin)) {
        return res.status(400).json({ error: "รหัส PIN ใหม่กับยืนยัน PIN ไม่ตรงกัน" });
    }
    try {
        const { data: user, error } = await db.from('staff').select('id, pin').eq('email', email).single();
        if (error || !user) return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งาน" });

        const validPin = user.pin?.startsWith('$2a$') || user.pin?.startsWith('$2b$')
            ? await bcrypt.compare(String(oldPin), user.pin)
            : String(oldPin) === user.pin;
        if (!validPin) return res.status(401).json({ error: "รหัส PIN เดิมไม่ถูกต้อง" });

        const hashedPin = await bcrypt.hash(String(newPin), await bcrypt.genSalt(10));
        const { error: updateError } = await db.from('staff').update({ pin: hashedPin }).eq('id', user.id);
        if (updateError) throw updateError;
        res.json({ success: true, message: "เปลี่ยนรหัส PIN เรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 4. API หมวดหมู่สินค้า (Categories) ---
// ==========================================
app.get('/api/categories', async (req, res) => {
    try {
        const { shop_id } = req.query;
        const { data, error } = await db.from('categories').select('*').eq('shop_id', shop_id).order('id', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/categories', async (req, res) => {
    try {
        const { error } = await db.from('categories').insert([{ shop_id: req.body.shop_id, name: req.body.name, status: req.body.status || 'active' }]);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/categories/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('categories').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('categories').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 5. API สินค้า (Products) ---
// ==========================================
app.get('/api/products', async (req, res) => {
    const { shop_id, category_id } = req.query;
    try {
        let query = db.from('products').select('*').eq('shop_id', shop_id);
        if (category_id && category_id !== 'all') query = query.eq('category_id', category_id);
        const { data, error } = await query.order('id', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/products', async (req, res) => {
    const { shop_id, category_id, name, price, status, image_url } = req.body;
    try {
        const { error } = await db.from('products').insert([{ shop_id, category_id, name, price, status: status || 'active', image_url }]);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/products/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('products').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/products/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('products').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 6. API ตัวเลือกสินค้า (Options & Modifiers) ---
// ==========================================
app.get('/api/options', async (req, res) => {
    try {
        const { shop_id } = req.query;
        const { data: groups, error: err1 } = await db.from('option_groups').select('*').eq('shop_id', shop_id).order('id', { ascending: false });
        if (err1) throw err1;
        
        const groupIds = groups.map(g => g.id);
        let items = [];
        
        if (groupIds.length > 0) {
            const { data: itemsData, error: err2 } = await db.from('option_items').select('*').in('option_group_id', groupIds);
            if (err2) throw err2;
            items = itemsData;
        }

        const result = groups.map(g => ({
            ...g,
            items: items.filter(i => i.option_group_id === g.id)
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/options/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('option_groups').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; 
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/product_options', async (req, res) => {
    try {
        const { product_id } = req.query;
        let query = db.from('product_options').select('*');
        if (product_id) query = query.eq('product_id', product_id);
        
        const { data, error } = await query;
        if (error) throw error; 
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('recipes').delete().eq('id', req.params.id).eq('product_id', req.body.product_id || '').not('product_id', 'is', null);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 8. API บันทึกออเดอร์ & ตัดสต็อก (Orders & Deduct) ---
// ==========================================
app.get('/api/next-bill-number', async (req, res) => {
    const { shop_id, shift_id } = req.query;
    if (!shift_id || shift_id === 'undefined') return res.json({ billCode: "0001" });
    try {
        const { count, error } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('shift_id', shift_id);
        if (error) throw error;
        const { data: shopSettings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        const settings = shopSettings?.settings_data || {};
        const prefix = settings.receipt_prefix ?? 'INV-';
        const startNumber = Number.parseInt(settings.receipt_start_number, 10);
        const nextNumber = Number.isNaN(startNumber) ? (count || 0) + 1 : startNumber + (count || 0);
        const padding = Number.isNaN(startNumber) ? 4 : String(settings.receipt_start_number).length;
        res.json({ billCode: `${prefix}${String(nextNumber).padStart(padding, '0')}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/orders', async (req, res) => {
    const { shop_id, staff_id, shift_id, order_type, total_amount, payment_method, received_amount, change_amount, cart } = req.body;
    try {
        if (!shift_id) return res.status(400).json({ success: false, error: "ไม่พบรหัสรอบการขาย" });
        const { data: activeShift, error: shiftErr } = await db.from('shifts').select('status').eq('id', shift_id).single();
        if (shiftErr || !activeShift || activeShift.status !== 'OPEN') return res.status(400).json({ success: false, error: "รอบการขายนี้ถูกปิดแล้ว กรุณาเปิดรอบการขายใหม่" });

        const { count, error: countErr } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('shift_id', shift_id);
        if (countErr) throw countErr;

        let receiptSettingsSnapshot = null;
        const { data: shopSettings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        if (shopSettings?.settings_data) {
            receiptSettingsSnapshot = typeof shopSettings.settings_data === 'string'
                ? JSON.parse(shopSettings.settings_data)
                : shopSettings.settings_data;
        }
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
        if (receiptSettingsSnapshot?.allow_negative_stock === false) {
            for (const item of cart || []) {
                const productId = item.id || item.product_id;
                const { data: recipes } = await db.from('recipes').select('inventory_item_id, quantity').eq('product_id', productId);
                for (const recipe of recipes || []) {
                    const { data: inventoryItem } = await db.from('inventory_items').select('quantity, name').eq('id', recipe.inventory_item_id).single();
                    const requiredQuantity = Number(recipe.quantity || 0) * Number(item.quantity || 0);
                    if (inventoryItem && Number(inventoryItem.quantity) < requiredQuantity) {
                        return res.status(400).json({ success: false, error: `วัตถุดิบ ${inventoryItem.name || ''} ไม่เพียงพอสำหรับการขาย` });
                    }
                }
            }
        }
        const receiptPrefix = receiptSettingsSnapshot?.receipt_prefix ?? 'INV-';
        const startNumber = Number.parseInt(receiptSettingsSnapshot?.receipt_start_number, 10);
        const nextNumber = Number.isNaN(startNumber) ? (count || 0) + 1 : startNumber + (count || 0);
        const padding = Number.isNaN(startNumber) ? 4 : String(receiptSettingsSnapshot.receipt_start_number).length;
        const billNumber = `${receiptPrefix}${String(nextNumber).padStart(padding, '0')}`;

        const { data: orderRes, error: orderErr } = await db.from('orders').insert([{
            bill_number: billNumber, shop_id, staff_id: staff_id || null, shift_id, order_type, total_amount: calculatedTotal,
            payment_method: payment_method || 'เงินสด', received_amount: received_amount || calculatedTotal, change_amount: change_amount || 0, status: 'completed'
        }]).select('id').single();
        if (orderErr) throw orderErr;

        const orderId = orderRes.id;

        // Preserve the receipt configuration used at checkout for historical bills.
        if (receiptSettingsSnapshot) {
            await db.from('orders').update({ receipt_settings: receiptSettingsSnapshot }).eq('id', orderId);
        }

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

        let autoDeduct = true;
        try {
            const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
            if (settings && settings.settings_data) {
                const sData = typeof settings.settings_data === 'string' ? JSON.parse(settings.settings_data) : settings.settings_data;
                if (sData.auto_deduct_stock === false) autoDeduct = false;
            }
        } catch (e) { }

        if (autoDeduct) {
            for (const item of cart) {
                const productId = item.id || item.product_id;
                const { data: recipes } = await db.from('recipes').select('*').eq('product_id', productId);
                if (recipes && recipes.length > 0) {
                    for (const recipe of recipes) {
                        const totalDeduct = recipe.quantity * item.quantity;
                        const { data: invItem } = await db.from('inventory_items').select('quantity').eq('id', recipe.inventory_item_id).single();
                        if (invItem) {
                            const newStock = Number(invItem.quantity) - totalDeduct;
                            await db.from('inventory_items').update({ quantity: newStock }).eq('id', recipe.inventory_item_id);
                            
                            await db.from('stock_movements').insert([{
                                shop_id, inventory_item_id: recipe.inventory_item_id, movement_type: 'SALE',
                                quantity: -totalDeduct, balance_after: newStock, reference_id: orderId, reason: `ขายสินค้า POS (บิล ${billNumber})`
                            }]);
                            await syncInventoryNotification({ shopId: shop_id, itemId: recipe.inventory_item_id, userId: staff_id || null });
                        }
                    }
                }
            }
        }
        res.status(201).json({ success: true, message: "ชำระเงินสำเร็จ", billNumber });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await db.from('orders').select('*').eq('shop_id', req.query.shop_id).order('created_at', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/single/:id', async (req, res) => {
    try {
        if (!req.query.shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const query = db.from('orders').select('*').eq('id', req.params.id).eq('shop_id', req.query.shop_id);
        const { data, error } = await query.single();
        if (error || !data) return res.status(404).json({ error: "ไม่พบข้อมูลบิล" });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        try {
            const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
            if (settings && settings.settings_data) {
                const sData = typeof settings.settings_data === 'string' ? JSON.parse(settings.settings_data) : settings.settings_data;
                if (sData.auto_deduct_stock === false) autoDeduct = false;
            }
        } catch (e) {}

        const { data: items } = await db.from('order_items').select('*').eq('order_id', orderId);
        if (autoDeduct && items) {
            for (const item of items) {
                const productId = item.product_id || item.id;
                const { data: recipes } = await db.from('recipes').select('*').eq('product_id', productId);
                if (recipes && recipes.length > 0) {
                    for (const recipe of recipes) {
                        const totalReturn = recipe.quantity * item.quantity;
                        const { data: invItem } = await db.from('inventory_items').select('quantity').eq('id', recipe.inventory_item_id).single();
                        if (invItem) {
                            const newStock = Number(invItem.quantity) + totalReturn;
                            await db.from('inventory_items').update({ quantity: newStock }).eq('id', recipe.inventory_item_id);
                            
                            await db.from('stock_movements').insert([{
                                shop_id, inventory_item_id: recipe.inventory_item_id, movement_type: 'VOID_RETURN',
                                quantity: totalReturn, balance_after: newStock, reference_id: orderId, reason: `คืนสต็อกจากการยกเลิกบิล (Void)`
                            }]);
                        }
                    }
                }
            }
        }

        await db.from('order_items').update({ price: 0, addon_price: 0 }).eq('order_id', orderId);
        await db.from('orders').update({ total_amount: 0, received_amount: 0, change_amount: 0, status: 'cancelled' }).eq('id', orderId);

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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shifts', async (req, res) => {
    try {
        const { data, error } = await db.from('shifts').select('*, staff(role, email)').eq('shop_id', req.query.shop_id).order('opened_at', { ascending: false });
        if (error) throw error; res.json({ shifts: data.map(shift => ({ ...shift, staff_name: shift.staff ? `${shift.staff.role}` : 'พนักงาน' })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shifts/open', async (req, res) => {
    const { shop_id, staff_id, opening_cash } = req.body;
    try {
        const { data: existing } = await db.from('shifts').select('id').eq('shop_id', shop_id).eq('status', 'OPEN').single();
        if (existing) return res.status(400).json({ message: "มีรอบการขายเปิดอยู่แล้ว กรุณาปิดรอบเดิมก่อน" });
        const { data, error } = await db.from('shifts').insert([{ shop_id, staff_id, opening_cash: Number(opening_cash) || 0, status: 'OPEN', opened_at: new Date().toISOString() }]).select().single();
        if (error) throw error; res.json({ success: true, shift: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shifts/close', async (req, res) => {
    const { shift_id, closing_cash, expected_cash, cash_difference } = req.body;
    try {
        const { error } = await db.from('shifts').update({ closing_cash: Number(closing_cash), expected_cash: Number(expected_cash), cash_difference: Number(cash_difference), status: 'CLOSED', closed_at: new Date().toISOString() }).eq('id', shift_id);
        if (error) throw error;
        
        const { data: orders } = await db.from('orders').select('total_amount').eq('shift_id', shift_id).neq('status', 'cancelled');
        const totalSales = orders ? orders.reduce((sum, order) => sum + Number(order.total_amount), 0) : 0;
        await db.from('shifts').update({ total_sales: totalSales }).eq('id', shift_id);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        const { data: orders } = await db.from('orders').select('*').eq('shift_id', shiftId).neq('status', 'cancelled');
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 10. API ระบบคลังสินค้า (Inventory) ---
// ==========================================
const decodeInventoryUnit = (unit) => {
    const value = String(unit || 'หน่วย');
    const parts = value.split('|');
    if (parts.length === 3 && Number(parts[1]) > 0) {
        return { unit: parts[0], package_size: Number(parts[1]), package_unit: parts[2] };
    }
    return { unit: value, package_size: 1, package_unit: value };
};

const encodeInventoryUnit = (unit, packageSize, packageUnit) => {
    const baseUnit = String(unit || 'หน่วย').trim();
    const size = Number(packageSize || 1);
    const contentUnit = String(packageUnit || 'ชิ้น').trim();
    return size !== 1 ? `${baseUnit}|${size}|${contentUnit}` : baseUnit;
};

const presentInventoryItem = (item) => {
    const unitInfo = decodeInventoryUnit(item.unit);
    return { ...item, unit: unitInfo.unit, package_size: unitInfo.package_size, package_unit: unitInfo.package_unit, total_pieces: Number(item.quantity || 0) * unitInfo.package_size, cost_per_piece: unitInfo.package_size > 0 ? Number(item.cost || 0) / unitInfo.package_size : 0 };
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
        res.json((categories || []).map(c => ({
            ...c,
            type: c.type || 'raw_material',
            item_count: items.filter(i => i.category_id === c.id).length
        })));
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        if (duplicate && duplicate.length > 0) return res.status(409).json({ error: 'มีหมวดย่อยชื่อเดียวกันอยู่แล้วในร้านนี้' });

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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        if (duplicate && duplicate.length > 0) return res.status(409).json({ error: 'มีหมวดย่อยชื่อเดียวกันอยู่แล้วในร้านนี้' });

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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/categories/:id', async (req, res) => {
    try {
        const shopId = Number(req.query.shop_id || req.body?.shop_id);
        const categoryId = Number(req.params.id);
        if (!shopId || !categoryId) return res.status(400).json({ error: 'ต้องระบุ shop_id และ category_id' });

        const { data: linkedItems, error: checkErr } = await db.from('inventory_items').select('id').eq('category_id', categoryId).eq('shop_id', shopId);
        if (checkErr) throw checkErr;

        if (linkedItems && linkedItems.length > 0) {
            const { error: unlinkError } = await db.from('inventory_items').update({ category_id: null }).eq('category_id', categoryId).eq('shop_id', shopId);
            if (unlinkError) throw unlinkError;
        }

        const { error } = await db.from('inventory_categories').delete().eq('id', categoryId).eq('shop_id', shopId);
        if (error) throw error;
        res.json({ success: true, message: 'ลบหมวดย่อยสำเร็จ และย้ายรายการที่ใช้หมวดนี้ออกแล้ว' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items', async (req, res) => {
    const { shop_id, category_id, search } = req.query;
    try {
        let query = db.from('inventory_items').select('*, inventory_categories(name)').eq('shop_id', shop_id).order('id', { ascending: true });
        if (category_id && category_id !== 'all') query = query.eq('category_id', category_id);
        if (search) query = query.ilike('name', `%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        res.json(data.map(item => presentInventoryItem({ ...item, category_name: item.inventory_categories?.name })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/items', async (req, res) => {
    const { shop_id, category_id, name, quantity, unit, package_size, package_unit, min_threshold, image_url, sku, cost, type, status } = req.body;
    try {
        if (!shop_id || !name) return res.status(400).json({ error: "กรุณาระบุร้านค้าและชื่อรายการ" });
        if (!category_id) return res.status(400).json({ error: "กรุณาเลือกหมวดย่อยก่อนบันทึก" });
        const normalizedType = String(type || 'raw_material');
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหลักไม่ถูกต้อง' });

        let category = null;
        try {
            const { data, error } = await db.from('inventory_categories').select('id, type').eq('id', category_id).eq('shop_id', shop_id).single();
            if (error) throw error;
            category = data;
        } catch (err) {
            const { data, error } = await db.from('inventory_categories').select('id').eq('id', category_id).eq('shop_id', shop_id).single();
            if (error || !data) return res.status(400).json({ error: 'หมวดย่อยที่เลือกไม่มีอยู่ในร้านนี้ หรือไม่ตรงกับประเภทหลัก' });
            category = { id: data.id, type: normalizedType };
        }
        if (category && category.type && String(category.type || 'raw_material') !== normalizedType) return res.status(400).json({ error: 'หมวดย่อยต้องเป็นของประเภทหลักที่เลือก' });

        if (sku && String(sku).trim()) {
            const { data: skuMatch, error: skuError } = await db.from('inventory_items').select('id').eq('shop_id', shop_id).eq('sku', String(sku).trim()).maybeSingle();
            if (skuError) throw skuError;
            if (skuMatch) return res.status(400).json({ error: 'SKU นี้ถูกใช้แล้วในร้านนี้' });
        }

        const { data: shop, error: shopError } = await db.from('shops').select('id').eq('id', shop_id).maybeSingle();
        if (shopError) throw shopError;
        if (!shop) return res.status(400).json({ error: "ไม่พบร้านค้านี้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่" });

        const { data: createdItem, error } = await db.from('inventory_items').insert([{
            shop_id, category_id: category_id || null, name, quantity: quantity || 0, unit: encodeInventoryUnit(unit, package_size, package_unit), min_threshold: min_threshold || 0,
            image_url: image_url || null, sku: sku || null, cost: cost || 0, type: normalizedType, status: status || 'active'
        }]).select('id, quantity').single();
        if (error) throw error;
        const initialQuantity = Number(quantity || 0);
        if (createdItem && initialQuantity !== 0) {
            const { error: movementError } = await db.from('stock_movements').insert([{
                shop_id, inventory_item_id: createdItem.id, movement_type: 'INITIAL_STOCK',
                quantity: initialQuantity, balance_after: initialQuantity, reason: 'เพิ่มสินค้าเข้าคลัง'
            }]);
            if (movementError) throw movementError;
        }
        res.json({ success: true, message: "เพิ่มรายการเข้าคลังสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/items/:id', async (req, res) => {
    try {
        const { shop_id, category_id, name, quantity, unit, package_size, package_unit, min_threshold, image_url, sku, cost, type, status } = req.body;
        if (!shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        if (!category_id) return res.status(400).json({ error: 'กรุณาเลือกหมวดย่อยก่อนบันทึก' });
        const normalizedType = String(type || 'raw_material');
        if (!['raw_material', 'packaging'].includes(normalizedType)) return res.status(400).json({ error: 'ประเภทหลักไม่ถูกต้อง' });

        let category = null;
        try {
            const { data, error } = await db.from('inventory_categories').select('id, type').eq('id', category_id).eq('shop_id', shop_id).single();
            if (error) throw error;
            category = data;
        } catch (err) {
            const { data, error } = await db.from('inventory_categories').select('id').eq('id', category_id).eq('shop_id', shop_id).single();
            if (error || !data) return res.status(400).json({ error: 'หมวดย่อยที่เลือกไม่มีอยู่ในร้านนี้ หรือไม่ตรงกับประเภทหลัก' });
            category = { id: data.id, type: normalizedType };
        }
        if (category && category.type && String(category.type || 'raw_material') !== normalizedType) return res.status(400).json({ error: 'หมวดย่อยต้องเป็นของประเภทหลักที่เลือก' });

        if (sku && String(sku).trim()) {
            const { data: skuMatch, error: skuError } = await db.from('inventory_items').select('id').eq('shop_id', shop_id).eq('sku', String(sku).trim()).neq('id', req.params.id).maybeSingle();
            if (skuError) throw skuError;
            if (skuMatch) return res.status(400).json({ error: 'SKU นี้ถูกใช้แล้วในร้านนี้' });
        }

        const { data: existingItem, error: existingError } = await db.from('inventory_items').select('shop_id, quantity').eq('id', req.params.id).eq('shop_id', shop_id).single();
        if (existingError || !existingItem) return res.status(403).json({ error: 'ไม่พบวัตถุดิบนี้ในร้านของคุณ' });
        const updates = {
            category_id: category_id || null,
            name,
            unit: encodeInventoryUnit(unit, package_size, package_unit),
            min_threshold: min_threshold ?? 0,
            image_url: image_url || null,
            sku: sku || null,
            cost: cost ?? 0,
            type: normalizedType,
            status: status || 'active'
        };

        const { error } = await db.from('inventory_items').update(updates).eq('id', req.params.id).eq('shop_id', shop_id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/items/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('inventory_items').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/adjust', async (req, res) => {
    const { shop_id, item_id, user_id, adjust_qty, reason, note, expected_quantity } = req.body;
    try {
        const amount = Number(adjust_qty);
        if (!shop_id || !item_id || !Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'กรุณาระบุจำนวนที่ถูกต้อง' });
        const { data: item, error: itemErr } = await db.from('inventory_items').select('quantity, shop_id').eq('id', item_id).eq('shop_id', shop_id).single();
        if (itemErr || !item) throw new Error("ไม่พบวัตถุดิบในระบบ");
        const previousQuantity = Number(item.quantity || 0);
        if (expected_quantity !== undefined && Number(expected_quantity) !== previousQuantity) return res.status(409).json({ error: 'สต็อกถูกเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่' });
        const newQty = previousQuantity + amount;
        if (newQty < 0) return res.status(400).json({ error: 'จำนวนที่ลดไม่สามารถมากกว่าสต็อกปัจจุบันได้' });
        const { data: updatedItem, error: updateErr } = await db.from('inventory_items').update({ quantity: newQty }).eq('id', item_id).eq('shop_id', shop_id).eq('quantity', previousQuantity).select('quantity').single();
        if (updateErr) throw updateErr;
        if (!updatedItem) return res.status(409).json({ error: 'สต็อกถูกเปลี่ยนแปลงแล้ว กรุณาลองใหม่' });

        const { error: moveErr } = await db.from('stock_movements').insert([{
            shop_id, inventory_item_id: item_id, movement_type: amount > 0 ? 'STOCK_IN' : 'STOCK_OUT', quantity: amount, balance_before: previousQuantity, balance_after: newQty, reason: reason || 'ปรับสต็อก', note: note || null, created_by: user_id || null
        }]);
        if (moveErr) throw moveErr;
        await syncInventoryNotification({ shopId: shop_id, itemId: item_id, userId: user_id || null });
        res.json({ success: true, message: "ปรับปรุง Stock สำเร็จ", new_stock: newQty });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/:id', async (req, res) => {
    try {
        const shopId = req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { data, error } = await db.from('inventory_items').select('*').eq('id', req.params.id).eq('shop_id', shopId).single();
        if (error) throw error; res.json({ ...presentInventoryItem(data), stock: data.quantity, minStock: data.min_threshold || 10, sku: data.sku || `SKU-${data.id}`, movements: [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stock-movements', async (req, res) => {
    try {
        const { shop_id } = req.query;
        const { data, error } = await db.from('stock_movements').select('*').eq('shop_id', shop_id).order('created_at', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        const { data, error } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            const savedSettings = typeof data.settings_data === 'string' ? JSON.parse(data.settings_data) : data.settings_data;
            res.json({ shop_id: Number(shop_id), ...defaultSettings, ...(savedSettings || {}) });
        }
        else { res.json({ shop_id: Number(shop_id), ...defaultSettings }); }
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { error } = await db.from('shop_settings').upsert({ shop_id: req.body.shop_id, settings_data: req.body.data });
        if (error) throw error; res.json({ success: true, message: "บันทึกการตั้งค่าเรียบร้อยแล้วค่ะ" });
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

        res.json({ success: true, pin_enabled: Boolean(pin_enabled), user_id: Number(userId) });
    } catch (error) {
        res.status(500).json({ error: error.message || 'ไม่สามารถบันทึกสถานะ PIN ของพนักงานได้' });
    }
});

app.get('/api/payment-methods', async (req, res) => {
    try {
        const shopId = req.query.shop_id;
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
            return res.json(seeded.data || []);
        }
        return res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/payment-methods/:id', async (req, res) => {
    try {
        const { error } = await db.from('payment_methods').delete().eq('id', req.params.id).eq('shop_id', req.query.shop_id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/payment-methods', async (req, res) => {
    try {
        const results = await Promise.all(req.body.methods.map(m => db.from('payment_methods')
            .update({ is_enabled: m.is_enabled, display_order: m.display_order })
            .eq('id', m.id)
            .eq('shop_id', req.body.shop_id)));
        const failed = results.find(result => result.error);
        if (failed?.error) throw failed.error;
        res.json({ success: true, message: "อัปเดตช่องทางการชำระเงินเรียบร้อยแล้ว" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- 12. API โปรโมชั่น (Promotions) ---
// ==========================================
app.get('/api/promotions', async (req, res) => {
    try {
        const { data, error } = await db.from('promotions').select('*').eq('shop_id', req.query.shop_id).order('id', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/promotions', async (req, res) => {
    try {
        const { error } = await db.from('promotions').insert([req.body]);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/promotions/:id', async (req, res) => {
    try {
        const shopId = req.body.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('promotions').update(req.body).eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/promotions/:id', async (req, res) => {
    try {
        const shopId = req.body?.shop_id ?? req.query.shop_id;
        if (!shopId) return res.status(400).json({ error: 'ต้องระบุ shop_id' });
        const { error } = await db.from('promotions').delete().eq('id', req.params.id).eq('shop_id', shopId);
        if (error) throw error; res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff/:id/activity', async (req, res) => {
    const staffId = req.params.id;
    const shopId = req.query.shop_id;
    try {
        let activities = [];

        const { data: orders } = await db.from('orders')
            .select('bill_number, total_amount, created_at')
            .eq('staff_id', staffId)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(10);
            
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
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// --- 14. API สำหรับหน้า Dashboard Reports ---
// ==========================================

const getBangkokDateKey = (date) => {
    const shifted = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    return shifted.toISOString().slice(0, 10);
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

app.get('/api/reports/summary', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        
        const { data: orders } = await db.from('orders').select('id, total_amount')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end);
            
        const totalBills = orders ? orders.length : 0;
        const netSales = orders ? orders.reduce((sum, o) => sum + Number(o.total_amount), 0) : 0;
        const avgBill = totalBills > 0 ? netSales / totalBills : 0;
        
        const { data: items } = orders && orders.length > 0
            ? await db.from('order_items').select('quantity').in('order_id', orders.map(o => o.id))
            : { data: [] };
        const totalItems = items ? items.reduce((sum, i) => sum + Number(i.quantity), 0) : 0;

        res.json({ summary: { netSales, totalBills, avgBill, totalItems } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/sales', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: orders } = await db.from('orders').select('id, bill_number, created_at, total_amount, payment_method, staff(name)')
            .eq('shop_id', shop_id).eq('status', 'completed')
            .gte('created_at', start).lte('created_at', end).order('created_at', { ascending: true });
        
        const orderIds = (orders || []).map(order => order.id);
        const { data: orderItems } = orderIds.length > 0
            ? await db.from('order_items').select('order_id, quantity').in('order_id', orderIds)
            : { data: [] };
        const itemCountsByOrder = (orderItems || []).reduce((counts, item) => {
            counts[item.order_id] = (counts[item.order_id] || 0) + (Number(item.quantity) || 0);
            return counts;
        }, {});
        const startKey = getBangkokDateKey(new Date(start));
        const endKey = getBangkokDateKey(new Date(end));
        const rangeStart = new Date(`${startKey}T00:00:00+07:00`);
        const rangeEnd = new Date(`${endKey}T23:59:59.999+07:00`);
        if (rangeStart > new Date()) return res.json({ chart: [] });
        const rangeDays = Math.floor((rangeEnd - rangeStart) / 86400000) + 1;
        const granularity = rangeDays === 1 ? 'hour' : rangeDays <= 93 ? 'day' : rangeDays <= 730 ? 'week' : 'month';
        const getBucketKey = (date) => {
            const dateKey = getBangkokDateKey(new Date(date));
            if (granularity === 'hour') {
                const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(new Date(date));
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/payments', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: orders } = await db.from('orders').select('payment_method, total_amount')
            .eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/products', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: orders } = await db.from('orders').select('id').eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        
        if (!orders || orders.length === 0) return res.json([]);
        const { data: items } = await db.from('order_items').select('quantity, price, products(name, category_id)').in('order_id', orders.map(o => o.id));
        if (!items || items.length === 0) return res.json([]);

        const productSales = {};
        items.forEach(i => {
            const pName = i.products?.name || 'Unknown';
            if (!productSales[pName]) productSales[pName] = { qty: 0, sum: 0 };
            productSales[pName].qty += Number(i.quantity);
            productSales[pName].sum += (Number(i.quantity) * Number(i.price));
        });

        const topProducts = Object.keys(productSales).sort((a,b) => productSales[b].qty - productSales[a].qty).slice(0, 10).map(k => ({
            "ชื่อสินค้า": k, "ขายได้ (ชิ้น)": productSales[k].qty, "ยอดรวม (฿)": productSales[k].sum.toLocaleString()
        }));

        res.json(topProducts);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/inventory', async (req, res) => {
    try {
        const { shop_id } = req.query;
        const { data: inv } = await db.from('inventory_items').select('id, name, quantity, min_threshold, unit, type').eq('shop_id', shop_id);
        if (!inv) return res.json({ outOfStock: 0, lowStock: 0, table: [] });

        const outOfStock = inv.filter(i => Number(i.quantity) <= 0).length;
        const lowStock = inv.filter(i => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.min_threshold)).length;

        const table = inv.filter(i => Number(i.quantity) <= Number(i.min_threshold)).map(i => ({
            id: i.id,
            "ชื่อวัตถุดิบ": i.name, "คงเหลือ": `${i.quantity} ${i.unit}`, "ขั้นต่ำ": `${i.min_threshold} ${i.unit}`,
            "สถานะ": Number(i.quantity) <= 0 ? "หมด" : "ต่ำ"
        }));

        res.json({ totalItems: inv.length, outOfStock, lowStock, asOf: new Date().toISOString(), table });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/stock-movement', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: movements, error: movementError } = await db.from('stock_movements').select('id, created_at, movement_type, quantity, balance_after, reason, reference_id, inventory_item_id')
            .eq('shop_id', shop_id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(20);
        if (movementError) throw movementError;
        if (!movements || movements.length === 0) return res.json([]);

        const inventoryItemIds = [...new Set(movements.map(m => m.inventory_item_id).filter(Boolean))];
        const { data: inventoryItems, error: inventoryError } = inventoryItemIds.length > 0
            ? await db.from('inventory_items').select('id, name, unit').in('id', inventoryItemIds)
            : { data: [], error: null };
        if (inventoryError) throw inventoryError;
        const itemDetails = new Map((inventoryItems || []).map(item => [item.id, { ...item, ...decodeInventoryUnit(item.unit) }]));
        const movementLabels = {
            SALE: 'ใช้ไปจากการขาย',
            VOID_RETURN: 'คืนจากการยกเลิกบิล',
            ADJUSTMENT: 'ปรับ Stock',
            INITIAL_STOCK: 'เพิ่มเข้าคลัง'
        };

        res.json(movements.map(m => ({
            "วันที่": new Date(m.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }),
            "รายการวัตถุดิบ": itemDetails.get(m.inventory_item_id)?.name || '-',
            "ประเภท": movementLabels[m.movement_type] || m.movement_type,
            "จำนวนที่เปลี่ยน": Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity,
            "หน่วย": itemDetails.get(m.inventory_item_id)?.unit || 'หน่วย',
            "คงเหลือหลังรายการ": m.balance_after ?? '-',
            "รายละเอียด": m.reference_id ? `บิล #${m.reference_id}` : (m.reason || '-')
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/employees', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: orders } = await db.from('orders').select('staff_id, total_amount, staff(name)')
            .eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        
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
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/profit', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        
        const { data: orders } = await db.from('orders').select('id, total_amount').eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        const revenue = orders ? orders.reduce((sum, o) => sum + Number(o.total_amount), 0) : 0;

        const { data: exps } = await db.from('shift_expenses').select('amount').eq('shop_id', shop_id).gte('created_at', start).lte('created_at', end);
        const expenses = exps ? exps.filter(e => Number(e.amount) > 0).reduce((sum, e) => sum + Number(e.amount), 0) : 0;

        const orderIds = (orders || []).map(order => order.id);
        const { data: soldItems } = orderIds.length > 0
            ? await db.from('order_items').select('product_id, quantity').in('order_id', orderIds)
            : { data: [] };
        const productIds = [...new Set((soldItems || []).map(item => item.product_id).filter(Boolean))];
        const { data: recipes } = productIds.length > 0
            ? await db.from('recipes').select('product_id, quantity, inventory_items(cost)').in('product_id', productIds)
            : { data: [] };
        const recipesByProduct = (recipes || []).reduce((map, recipe) => {
            if (!map[recipe.product_id]) map[recipe.product_id] = [];
            map[recipe.product_id].push(recipe);
            return map;
        }, {});
        let cogs = 0;
        let cogsAvailable = orders.length === 0;
        (soldItems || []).forEach(item => {
            const productRecipes = recipesByProduct[item.product_id] || [];
            if (!item.product_id || productRecipes.length === 0 || productRecipes.some(recipe => recipe.inventory_items?.cost == null || Number(recipe.inventory_items.cost) <= 0 || Number.isNaN(Number(recipe.inventory_items.cost)))) {
                cogsAvailable = false;
                return;
            }
            cogsAvailable = true;
            productRecipes.forEach(recipe => {
                cogs += (Number(item.quantity) || 0) * (Number(recipe.quantity) || 0) * (Number(recipe.inventory_items?.cost) || 0);
            });
        });

        res.json({ revenue, expenses, cogs: cogsAvailable ? cogs : null, cogsAvailable, netProfit: cogsAvailable ? revenue - expenses - cogs : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/customers', (req, res) => res.json({ available: false, message: 'ยังไม่มีข้อมูลลูกค้าใน schema ปัจจุบัน' }));
app.get('/api/reports/tax', async (req, res) => {
    try {
        const { shop_id, period, startDate, endDate } = req.query;
        const { start, end } = getDateRange(period, startDate, endDate);
        const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        const data = settings?.settings_data || {};
        if (!data.vat_enabled) return res.json({ available: false, message: 'ยังไม่ได้เปิดใช้งานภาษีมูลค่าเพิ่ม' });
        const { data: orders } = await db.from('orders').select('total_amount').eq('shop_id', shop_id).eq('status', 'completed').gte('created_at', start).lte('created_at', end);
        const total = (orders || []).reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
        const rate = Number(data.vat_rate) || 0;
        const tax = data.prices_include_vat ? total * rate / (100 + rate) : total * rate / 100;
        res.json([{ "อัตราภาษี": `${rate}%`, "ฐานภาษี (฿)": (data.prices_include_vat ? total - tax : total).toLocaleString(), "ภาษี (฿)": tax.toLocaleString() }]);
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/reports/export', (req, res) => res.send("ระบบ Export กำลังอยู่ในช่วงพัฒนา"));

// ==========================================
// --- เริ่มการทำงานของ Server ---
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// ==========================================
// --- 10.5 API ศูนย์การแจ้งเตือน ---
// ==========================================
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

        const { data: inventoryItems, error: inventoryError } = await db.from('inventory_items').select('id').eq('shop_id', shopId);
        if (inventoryError) throw inventoryError;

        for (const item of inventoryItems || []) {
            await syncInventoryNotification({ shopId, itemId: item.id, userId });
        }

        let query = db.from('notifications').select('*', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true).order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Math.min(Number(limit), 100) - 1);
        if (unread_only === 'true') query = query.eq('is_read', false);
        if (type) query = query.eq('type', type);
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