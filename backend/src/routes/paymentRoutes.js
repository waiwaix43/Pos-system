const express = require('express');
const router = express.Router();
const db = require('../db'); // Supabase client
const OmiseProvider = require('../services/omiseProvider');
const statusChecksInFlight = new Set();

// Helper to get provider instance based on shop settings
async function getProvider(shopId, settingsData = null) {
    // In production, fetch config from DB where it is securely stored or ENV
    if (!settingsData) {
        const { data: settings } = await db.from('shop_settings').select('settings_data').eq('shop_id', shopId).single();
        settingsData = settings?.settings_data;
    }
    const config = settingsData?.payment_gateway || {};
    
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
        const [orderResult, settingsResult] = await Promise.all([
            db.from('orders').select('*').eq('id', order_id).eq('shop_id', shop_id).single(),
            db.from('shop_settings').select('settings_data').eq('shop_id', shop_id).single()
        ]);
        const { data: order, error: orderErr } = orderResult;
        if (orderErr || !order) return res.status(404).json({ success: false, error: "Order not found" });

        const { data: settings } = settingsResult;
        const config = settings?.settings_data || {};
        
        let qrData = '';
        let txId = 'TX-' + Date.now();
        let transactionProvider = 'OMISE';
        
        if (config.payment_qr_type !== 'promptpay' && config.qr_reference_number && config.qr_reference_number.length === 15) {
            transactionProvider = 'CUSTOM_QR';
            let payload = '00020101021229390016A0000006770101110315' + config.qr_reference_number + '53037645802TH';
            const amtStr = amount.toFixed(2);
            const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
            payload += tag54;
            payload += '6304';
            const crc16 = require('crc/crc16ccitt');
            const checksum = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
            qrData = payload + checksum;
        } else if (config.promptpay_payload) {
            transactionProvider = 'CUSTOM_QR';
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
            const provider = await getProvider(shop_id, config);
            const qrResult = await provider.createQR({ amount, currency, metadata: { order_id, shop_id } });
            qrData = qrResult.qr_data;
            txId = qrResult.transaction_id;
        }

        const { data: tx, error: txErr } = await db.from('payment_transactions').insert([{
            shop_id,
            order_id,
            invoice_number: order.bill_number,
            provider: transactionProvider,
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
        const { data: tx, error } = await db.from('payment_transactions')
            .select('id, shop_id, provider, provider_transaction_id, status')
            .eq('id', req.params.id)
            .single();
        if (error || !tx) return res.status(404).json({ success: false, error: "Transaction not found" });
        
        // If it's already in a final state in our DB, return it
        if (['PAID', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(tx.status)) {
            return res.json({ success: true, status: tx.status });
        }

        // Return the cached status immediately; provider checks are only a fallback to webhooks.
        if (tx.provider === 'OMISE' && !statusChecksInFlight.has(tx.id)) {
            statusChecksInFlight.add(tx.id);
            void (async () => {
                try {
                    const provider = await getProvider(tx.shop_id);
                    const providerStatus = await provider.getPaymentStatus(tx.provider_transaction_id);
                    if (providerStatus.status === 'PENDING') return;

                    const { data: updatedTx, error: updateError } = await db.from('payment_transactions')
                        .update({
                            status: providerStatus.status,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', tx.id)
                        .eq('status', 'PENDING')
                        .select('id')
                        .maybeSingle();
                    if (updateError) throw updateError;
                    if (updatedTx && providerStatus.status === 'PAID') {
                        await processSuccessfulPayment(tx.id);
                    }
                } catch (refreshError) {
                    console.error("Payment status refresh error:", refreshError);
                } finally {
                    statusChecksInFlight.delete(tx.id);
                }
            })();
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

const getInventoryPackageSize = (unitValue) => {
    const parts = String(unitValue || '').split('|');
    return parts.length === 3 && Number(parts[1]) > 0 ? Number(parts[1]) : 1;
};

// Helper function to process successful payment
async function processSuccessfulPayment(txId) {
    const { data: tx } = await db.from('payment_transactions').select('*').eq('id', txId).single();
    if (!tx) return;

    const { data: order } = await db.from('orders').select('*').eq('id', tx.order_id).single();
    if (!order || order.status !== 'PENDING_PAYMENT') return;

    await completeOrder(order, tx.amount, 'PENDING_PAYMENT');
}

async function completeOrder(order, receivedAmount, expectedStatus) {
    const { data: completedOrder, error: completionError } = await db.from('orders')
        .update({ status: 'completed', received_amount: receivedAmount })
        .eq('id', order.id)
        .eq('status', expectedStatus)
        .select('id')
        .maybeSingle();
    if (completionError) throw completionError;
    if (!completedOrder) return false;

    const { data: orderItems } = await db.from('order_items').select('*').eq('order_id', order.id);
    if (orderItems) {
        for (const item of orderItems) {
            const productId = item.product_id;
            const { data: recipes } = await db.from('recipes').select('inventory_item_id, quantity').eq('product_id', productId);
            for (const recipe of recipes || []) {
                const requiredSubUnit = Number(recipe.quantity || 0) * Number(item.quantity || 0);
                if (requiredSubUnit <= 0) continue;

                const { data: invItem } = await db.from('inventory_items').select('quantity, unit, name').eq('id', recipe.inventory_item_id).single();
                if (!invItem) continue;

                const pkgSize = getInventoryPackageSize(invItem.unit);
                const currentSubUnitTotal = Number(invItem.quantity || 0) * pkgSize;
                if (currentSubUnitTotal < requiredSubUnit) {
                    console.warn(`Skipping stock deduction for ${invItem.name || recipe.inventory_item_id}: available ${currentSubUnitTotal}, required ${requiredSubUnit}`);
                    continue;
                }

                const baseUnitDeduction = requiredSubUnit / pkgSize;
                const previousQty = Number(invItem.quantity || 0);
                const newQty = Number((previousQty - baseUnitDeduction).toFixed(6));
                const { data: updatedInventory, error: inventoryUpdateError } = await db.from('inventory_items')
                    .update({ quantity: newQty })
                    .eq('id', recipe.inventory_item_id)
                    .select('quantity')
                    .single();
                if (inventoryUpdateError) throw inventoryUpdateError;
                if (Math.abs(Number(updatedInventory.quantity) - newQty) > 0.000000001) {
                    throw new Error(`Inventory quantity was not stored accurately for item ${recipe.inventory_item_id}`);
                }

                await db.from('stock_movements').insert([{
                    shop_id: order.shop_id,
                    inventory_item_id: recipe.inventory_item_id,
                    movement_type: 'SALE',
                    quantity: newQty - previousQty,
                    balance_after: Number(updatedInventory.quantity),
                    reason: `ขายสินค้า POS (บิล ${order.bill_number})`,
                    reference_id: order.id
                }]);

                await require('../notificationService').syncInventoryNotification({
                    shopId: order.shop_id,
                    itemId: recipe.inventory_item_id,
                    userId: null
                });
            }
        }
    }
    return true;
}

router.completeOrder = completeOrder;

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

