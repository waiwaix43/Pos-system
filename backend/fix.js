const fs = require('fs');
let code = fs.readFileSync('src/server.js', 'utf8');

code = code.replace(/const \{ data: orders \} = await db\.from\('orders'\)([\s\S]*?);/g, (match, p1) => {
    if (match.includes('.range(')) return match;
    return `const orders = await fetchAll(() => db.from('orders')${p1});`;
});

// For orderItems in /api/reports/sales
code = code.replace(/const \{ data: orderItems \} = orderIds\.length > 0\s*\n\s*\? await db\.from\('order_items'\)\.select\('order_id, quantity'\)\.in\('order_id', orderIds\)\s*\n\s*: \{ data: \[\] \};/g, `const orderItems = orderIds.length > 0
            ? await fetchAll(() => db.from('order_items').select('order_id, quantity').in('order_id', orderIds))
            : [];`);

// For items in /api/reports/summary
code = code.replace(/const \{ data: items \} = orders && orders\.length > 0\s*\n\s*\? await db\.from\('order_items'\)\.select\('quantity'\)\.in\('order_id', orders\.map\(o => o\.id\)\)\s*\n\s*: \{ data: \[\] \};/g, `const items = orders && orders.length > 0
            ? await fetchAll(() => db.from('order_items').select('quantity').in('order_id', orders.map(o => o.id)))
            : [];`);

fs.writeFileSync('src/server.js', code);
console.log('Fixed');
