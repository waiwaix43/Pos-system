const express = require('express');
const router = express.Router();
const db = require('../db'); // Supabase client
const OmiseProvider = require('../services/omiseProvider');

// Helper to get provider instance based on shop settings
async function getProvider(shopId) {
    // In production, fetch config from DB where it is securely stored or ENV
    const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shopId).single();
    const config = settings?.settings_data?.payment_gateway || {};
    
    // Fallback to ENV variables for sandbox/testing if not set in DB
    const providerName = config.provider || process.env.PAYMENT_PROVIDER || 'OMISE';
    const secretKey = config.secretKey || process.env.PAYMENT_SECRET_KEY;
    const publicKey = config.publicKey || process.env.PAYMENT_PUBLIC_KEY;

    if (!secretKey) throw new Error("Payment Gateway credentials not configured.");

    if (providerName.toUpperCase() === 'OMISE') {
        return new OmiseProvider({ secretKey, publicKey });
    }
    
    throw new Error(`Unsupported payment provider: ${providerName}`);
}

// 1. Create Payment (Dynamic QR)
router.post('/create-qr', async (req, res) => {
    const { shop_id, order_id, amount, currency = 'THB' } = req.body;
    try {
        const { data: order, error: orderErr } = await db.from('orders').select('*').eq('id', order_id).eq('shop_id', shop_id).single();
        if (orderErr || !order) return res.status(404).json({ success: false, error: "Order not found" });

        const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single();
        const config = settings?.settings_data || {};
        
        let qrData = '';
        let txId = 'TX-' + Date.now();
        
        if (config.payment_qr_type !== 'promptpay' && config.qr_reference_number && config.qr_reference_number.length === 15) {
            let payload = '00020101021229390016A0000006770101110315' + config.qr_reference_number + '53037645802TH';
            const amtStr = amount.toFixed(2);
            const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
            payload += tag54;
            payload += '6304';
            const crc16 = require('crc/crc16ccitt');
            const checksum = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
            qrData = payload + checksum;
        } else if (config.promptpay_payload) {
            let payload = config.promptpay_payload;
            payload = payload.slice(0, -8);
            payload = payload.replace('010211', '010212');
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
    } catch (err) {
        console.error("Create QR Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Get Payment Status (Polling from Frontend)
router.get('/:id/status', async (req, res) => {
    try {
        const { data: tx, error } = await db.from('payment_transactions').select('*').eq('id', req.params.id).single();
        if (error || !tx) return res.status(404).json({ success: false, error: "Transaction not found" });
        
        // If it's already in a final state in our DB, return it
        if (['PAID', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(tx.status)) {
            return res.json({ success: true, status: tx.status });
        }

        // Optional: Actively poll the provider (usually we rely on webhooks, but this is a fallback)
        const provider = await getProvider(tx.shop_id);
        const providerStatus = await provider.getPaymentStatus(tx.provider_transaction_id);

        if (providerStatus.status !== tx.status) {
            // Update DB if status changed
            await db.from('payment_transactions').update({ 
                status: providerStatus.status,
                updated_at: new Date().toISOString()
            }).eq('id', tx.id);

            // If PAID, trigger order complete and inventory deduction
            if (providerStatus.status === 'PAID') {
                await processSuccessfulPayment(tx.id);
            }
            tx.status = providerStatus.status;
        }

        res.json({ success: true, status: tx.status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Webhook Endpoint
router.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        // For Omise, payload.key is 'event' and contains 'data' which is the charge object.
        // Identify the transaction
        if (payload.object !== 'event' || !payload.data || payload.data.object !== 'charge') {
            return res.status(400).send("Ignored");
        }

        const charge = payload.data;
        const provider_tx_id = charge.id;
        const status = charge.status; // 'successful', 'failed', 'pending'

        const { data: tx, error } = await db.from('payment_transactions').select('*').eq('provider_transaction_id', provider_tx_id).single();
        if (error || !tx) return res.status(404).send("Transaction not found");

        if (['PAID', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(tx.status)) {
            return res.send("Already processed (Idempotent)"); // Prevent duplicate processing
        }

        let newStatus = 'PENDING';
        if (status === 'successful') newStatus = 'PAID';
        else if (status === 'failed') newStatus = 'FAILED';

        await db.from('payment_transactions').update({ 
            status: newStatus,
            updated_at: new Date().toISOString(),
            paid_at: newStatus === 'PAID' ? new Date().toISOString() : null
        }).eq('id', tx.id);

        if (newStatus === 'PAID') {
            await processSuccessfulPayment(tx.id);
        }

        res.send("OK");
    } catch (err) {
        console.error("Webhook Error:", err);
        res.status(500).send("Webhook Error");
    }
});

// Helper function to process successful payment
async function processSuccessfulPayment(txId) {
    const { data: tx } = await db.from('payment_transactions').select('*').eq('id', txId).single();
    if (!tx) return;

    const { data: order } = await db.from('orders').select('*').eq('id', tx.order_id).single();
    if (!order || order.status !== 'PENDING_PAYMENT') return;

    // 1. Update Order Status
    await db.from('orders').update({ status: 'completed', received_amount: tx.amount }).eq('id', order.id);

    // 2. Deduct Inventory
    // In Happy POS, order items are stored in 'order_items' (Wait, in this system, they might be in `orders.cart` or `order_items`? The `cart` is mapped to order_items in `/api/orders`.)
    const { data: orderItems } = await db.from('order_items').select('*').eq('order_id', order.id);
    if (orderItems) {
        for (const item of orderItems) {
            const productId = item.product_id;
            const { data: recipes } = await db.from('recipes').select('inventory_item_id, quantity').eq('product_id', productId);
            for (const recipe of recipes || []) {
                const requiredQuantity = Number(recipe.quantity || 0) * Number(item.quantity || 0);
                if (requiredQuantity > 0) {
                    // Fetch current quantity
                    const { data: invItem } = await db.from('inventory_items').select('quantity').eq('id', recipe.inventory_item_id).single();
                    if (invItem) {
                        const newQty = Number(invItem.quantity) - requiredQuantity;
                        await db.from('inventory_items').update({ quantity: newQty }).eq('id', recipe.inventory_item_id);
                        // Record stock movement
                        await db.from('stock_movements').insert([{
                            shop_id: order.shop_id,
                            inventory_item_id: recipe.inventory_item_id,
                            movement_type: 'SALE',
                            quantity: -requiredQuantity,
                            balance_after: newQty,
                            reason: `ขายสินค้า POS (บิล ${order.bill_number})`,
                            reference_id: order.id
                        }]);
                    }
                }
            }
        }
    }
}

// 4. Test Connection
router.post('/test-connection', async (req, res) => {
    const { provider, secretKey, publicKey } = req.body;
    try {
        if (provider === 'OMISE') {
            const p = new OmiseProvider({ secretKey, publicKey });
            // Test by fetching account info
            const response = await require('axios').get(`${p.baseUrl}/account`, {
                headers: { 'Authorization': p.authHeader }
            });
            if (response.data && response.data.object === 'account') {
                return res.json({ success: true, message: "เชื่อมต่อสำเร็จ" });
            }
        }
        res.json({ success: false, message: "เชื่อมต่อไม่สำเร็จ: Provider ไม่ถูกต้อง" });
    } catch (err) {
        res.json({ success: false, message: "เชื่อมต่อไม่สำเร็จ: " + (err.response?.data?.message || err.message) });
    }
});


// 5. Manual Confirm (For Custom QR)
router.post('/:id/confirm', async (req, res) => {
    try {
        const { data: tx, error } = await db.from('payment_transactions').select('*').eq('id', req.params.id).single();
        if (error || !tx) return res.status(404).json({ success: false, error: "Transaction not found" });

        if (tx.status !== 'PENDING') return res.status(400).json({ success: false, error: "Payment is not pending" });

        await db.from('payment_transactions').update({ 
            status: 'PAID',
            updated_at: new Date().toISOString(),
            paid_at: new Date().toISOString()
        }).eq('id', tx.id);

        await processSuccessfulPayment(tx.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
module.exports = router;

