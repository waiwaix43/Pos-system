import fs from 'fs';

let content = fs.readFileSync('backend/src/routes/paymentRoutes.js', 'utf8');

const confirmRoute = `
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
`;

content = content.replace("module.exports = router;", confirmRoute);
fs.writeFileSync('backend/src/routes/paymentRoutes.js', content);
console.log("Added manual confirm route");
