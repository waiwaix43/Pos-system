import fs from 'fs';

let content = fs.readFileSync('backend/src/server.js', 'utf8');
let lines = content.split('\n');

const start = lines.findIndex(l => l.includes("app.post('/api/orders', async (req, res) => {"));
const end = lines.findIndex((l, i) => i > start && l.startsWith("});"));

if (start !== -1 && end !== -1) {
    let orderBlock = lines.slice(start, end + 1).join('\n');

    // 1. Determine status before inserting order
    const statusLogic = `
        const isGateway = ['QR', 'PROMPTPAY', 'CREDIT_CARD', 'CARD'].includes(payment_method) || payment_method.includes('QR');
        const isTransfer = ['TRANSFER', 'โอนเงิน'].includes(payment_method) || payment_method.includes('โอนเงิน');
        let orderStatus = 'completed';
        if (isGateway) orderStatus = 'PENDING_PAYMENT';
        else if (isTransfer) orderStatus = 'PENDING_VERIFICATION';
`;

    // Replace the insert block
    const insertFind = `payment_method: payment_method || 'เงินสด', received_amount: received_amount || calculatedTotal, change_amount: change_amount || 0, status: 'completed'`;
    const insertReplace = `payment_method: payment_method || 'เงินสด', received_amount: received_amount || calculatedTotal, change_amount: change_amount || 0, status: orderStatus`;

    // Wrap inventory logic
    const invFind = `if (autoDeduct) {`;
    const invReplace = `if (autoDeduct && orderStatus === 'completed') {`;

    orderBlock = orderBlock.replace("let receiptSettingsSnapshot = null;", statusLogic + "\n        let receiptSettingsSnapshot = null;");
    orderBlock = orderBlock.replace(insertFind, insertReplace);
    orderBlock = orderBlock.replace(invFind, invReplace);
    
    // Include the orderStatus in the response to the frontend
    orderBlock = orderBlock.replace(`res.status(201).json({ success: true, message: "ชำระเงินสำเร็จ", billNumber });`, `res.status(201).json({ success: true, message: "สร้างออเดอร์สำเร็จ", billNumber, orderId, orderStatus });`);

    lines.splice(start, end - start + 1, ...orderBlock.split('\n'));
    fs.writeFileSync('backend/src/server.js', lines.join('\n'));
    console.log("Patched /api/orders successfully.");
} else {
    console.log("Could not find /api/orders block.");
}
