const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const putOrderAPI = `
app.put('/api/orders/:id', async (req, res) => {
    const { shop_id, staff_id, shift_id, order_type, total_amount, payment_method, received_amount, change_amount, cart } = req.body;
    try {
        if (!shop_id) return res.status(400).json({ error: 'ต้องระบุ shop_id' });

        // Update Order
        const { error: orderErr } = await db.from('orders').update({
            staff_id: staff_id || null, 
            shift_id, 
            order_type, 
            total_amount,
            payment_method, 
            received_amount, 
            change_amount, 
            updated_at: new Date().toISOString()
        }).eq('id', req.params.id).eq('shop_id', shop_id);
        
        if (orderErr) throw orderErr;

        // Delete old items
        const { error: delErr } = await db.from('order_items').delete().eq('order_id', req.params.id);
        if (delErr) throw delErr;

        // Insert new items
        if (cart && cart.length > 0) {
            const itemsValues = cart.map(item => ({
                order_id: req.params.id, 
                product_id: item.id || item.product_id, 
                quantity: item.quantity, 
                price: item.price, 
                addon_name: item.optionsText || item.addon_name || null, 
                addon_price: item.addon_price || 0, 
                note: item.note || null
            }));
            const { error: itemsErr } = await db.from('order_items').insert(itemsValues);
            if (itemsErr) throw itemsErr;
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});
`;

if(!content.includes("app.put('/api/orders/:id'")) {
    content = content.replace("app.get('/api/orders/single/:id',", putOrderAPI + "\napp.get('/api/orders/single/:id',");
}

// Update GET /api/orders to include pagination
const getOrdersRegex = /app\.get\('\/api\/orders',\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?\}\);/;
const paginatedGetOrders = `app.get('/api/orders', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const shopId = req.query.shop_id;
        
        const { data, error, count } = await db.from('orders')
            .select('*', { count: 'exact' })
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
            
        if (error) throw error; 
        res.json({ data, total: count });
    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }
});`;

content = content.replace(getOrdersRegex, paginatedGetOrders);

fs.writeFileSync('server.js', content, 'utf8');
console.log('Orders APIs updated successfully');
