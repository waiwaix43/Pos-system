import fs from 'fs';

let content = fs.readFileSync('backend/src/routes/paymentRoutes.js', 'utf8');

const createQrRouteRegex = /router\.post\('\/create-qr'[\s\S]*?res\.json\(\{ success: true, transaction: tx \}\);\n    \} catch \(err\) \{/m;

const newCreateQrRoute = `router.post('/create-qr', async (req, res) => {
    const { shop_id, order_id, amount, currency = 'THB' } = req.body;
    try {
        const { data: order, error: orderErr } = await db.from('orders').select('*').eq('id', order_id).eq('shop_id', shop_id).single();
        if (orderErr || !order) return res.status(404).json({ success: false, error: "Order not found" });

        const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        const config = settings?.settings_data || {};
        
        let qrData = '';
        let txId = 'TX-' + Date.now();
        
        if (config.promptpay_payload) {
            // Generate Dynamic QR from static payload string
            let payload = config.promptpay_payload;
            payload = payload.slice(0, -8); // Remove CRC (last 8 chars)
            payload = payload.replace('010211', '010212'); // Change to dynamic
            
            const amtStr = amount.toFixed(2);
            const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
            payload += tag54;
            
            payload += '6304';
            const crc16 = require('crc/crc16ccitt');
            const checksum = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
            qrData = payload + checksum;
        } else {
            // Fallback to Omise or fail
            const provider = await getProvider(shop_id);
            const qrResult = await provider.createQR({ amount, currency, metadata: { order_id, shop_id } });
            qrData = qrResult.qr_data;
            txId = qrResult.transaction_id;
        }

        const { data: tx, error: txErr } = await db.from('payment_transactions').insert([{
            shop_id,
            order_id,
            invoice_number: order.bill_number,
            provider: config.promptpay_payload ? 'CUSTOM_QR' : 'OMISE',
            provider_transaction_id: txId,
            payment_method: 'PROMPTPAY',
            amount,
            currency,
            status: 'PENDING',
            qr_data: qrData
        }]).select('*').single();

        if (txErr) throw txErr;

        res.json({ success: true, transaction: tx });
    } catch (err) {`;

content = content.replace(createQrRouteRegex, newCreateQrRoute);
fs.writeFileSync('backend/src/routes/paymentRoutes.js', content);
console.log("Patched create-qr logic");
