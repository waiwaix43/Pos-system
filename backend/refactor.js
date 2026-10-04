const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const cors_replace = "const cors = require('cors');\nconst jwt = require('jsonwebtoken');\nconst JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pos_key_2026';";
content = content.replace("const cors = require('cors');", cors_replace);
content = content.replace("app.use(cors());", "app.use(cors());\napp.options('*', cors());");

const putOrdersCode = `
app.put('/api/orders/:id', async (req, res) => {
    const { shop_id, staff_id, shift_id, order_type, total_amount, payment_method, received_amount, change_amount, cart } = req.body;
    try {
        if (!shop_id) return res.status(400).json({ error: 'ต้องระบู shop_id' });
        const { error: orderErr } = await db.from('orders').update({
            staff_id: staff_id || null, shift_id, order_type, total_amount, payment_method, received_amount, change_amount, updated_at: new Date().isoString()
        }).eq('id', req.params.id).eq('shop_id', shop_id);
        if (orderErr) throw orderErr;
        const { error: delErr } = await db.from('order_items').delete().eq('order_id', req.params.id);
        if (delErr) throw delErr;
        if (cart && cart.length > 0) {
            const itemsValues = cart.map(item => ({
                order_id: req.params.id, product_id: item.id || item.product_id, quantity: item.quantity, price: item.price, addon_name: item.optionsText || item.addon_name || null, addon_price: item.addon_price || 0, note: item.note || null
            }));
            const { error: itemsErr } = await db.from('order_items').insert(itemsValues);
            if (itemsErr) throw itemsErr;
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
`;
content = content.replace("app.delete('/api/orders/:id'", putOrdersCode + "\napp.delete('/api/orders/:id'");


const originalGetOrders = `app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await db.from('orders').select('*').eq('shop_id', req.query.shop_id).order('created_at', { ascending: false });
        if (error) throw error; res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});`;

const paginatedGetOrders = `app.get('/api/orders', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const { data, error, count } = await db.from('orders').select('*', { count: 'exact' }).eq('shop_id', req.query.shop_id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        if (error) throw error; res.json({ data, total: count });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});`;
content = content.replace(originalGetOrders, paginatedGetOrders);

content = content.replaceAll("res.status(500).json({ error: err.message })", "res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })");
content = content.replaceAll("res.status(500).json({ error: e.message })", "res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในิะบบ' })");

const middlewares = `
const authenticateToken = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'ไม่พบ Token ยืนยันตัวตู' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอาย�W' });
        req.user = user;
        next();
    });
};
app.use('/api', (req, res, next) => {
    if (req.path === '/login' || req.path === '/register') return next();
    authenticateToken(req, res, next);
});
`;
content = content.replace("app.post('/api/verify-pin'", middlewares + "\napp.post('/api-verify-pin'");

content = content.replace("user: { id: user.id", "token: jwt.sign({ id: user.id, shop_id: user.shop_id, role: user.role }, JWT_SECRET, { expiresIn: '12h' }),\n            user: { id: user.id");

fs.writeFileSync('server.js', content, 'utf8');