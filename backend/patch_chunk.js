const fs = require('fs');
let code = fs.readFileSync('src/server.js', 'utf8');

const fetchAllInChunksStr = `const fetchAllInChunks = async (qFn, col, vals) => {
    if (!vals || vals.length === 0) return [];
    let all = [];
    const sz = 200;
    for(let i=0; i<vals.length; i+=sz) {
        let c = vals.slice(i, i+sz);
        all = all.concat(await fetchAll(() => qFn().in(col, c)));
    }
    return all;
};`;

if (!code.includes('fetchAllInChunks')) {
    code = code.replace('const fetchAll = async', fetchAllInChunksStr + '\n\nconst fetchAll = async');
}

// 1. /api/reports/summary
code = code.replace(/await fetchAll\(\(\) => db\.from\('order_items'\)\.select\('quantity'\)\.in\('order_id', orders\.map\(o => o\.id\)\)\)/g, 
    `fetchAllInChunks(() => db.from('order_items').select('quantity'), 'order_id', orders.map(o => o.id))`);

// 2. /api/reports/sales
code = code.replace(/await fetchAll\(\(\) => db\.from\('order_items'\)\.select\('order_id, quantity'\)\.in\('order_id', orderIds\)\)/g, 
    `fetchAllInChunks(() => db.from('order_items').select('order_id, quantity'), 'order_id', orderIds)`);

// 3. /api/reports/products
code = code.replace(/const \{ data: items \} = await db\.from\('order_items'\)\.select\('quantity, price, products\(name, category_id\)'\)\.in\('order_id', orders\.map\(o => o\.id\)\);/g, 
    `const items = await fetchAllInChunks(() => db.from('order_items').select('quantity, price, products(name, category_id)'), 'order_id', orders.map(o => o.id));`);

// 4. /api/reports/profit (soldItems)
code = code.replace(/const \{ data: soldItems \} = orderIds\.length > 0[\s\S]*?\? await db\.from\('order_items'\)\.select\('product_id, quantity'\)\.in\('order_id', orderIds\)[\s\S]*?: \{ data: \[\] \};/g, 
    `const soldItems = await fetchAllInChunks(() => db.from('order_items').select('product_id, quantity'), 'order_id', orderIds);`);

// 5. /api/reports/profit (recipes)
code = code.replace(/const \{ data: recipes \} = productIds\.length > 0[\s\S]*?\? await db\.from\('recipes'\)\.select\('product_id, quantity, inventory_items\(cost, unit\)'\)\.in\('product_id', productIds\)[\s\S]*?: \{ data: \[\] \};/g, 
    `const recipes = await fetchAllInChunks(() => db.from('recipes').select('product_id, quantity, inventory_items(cost, unit)'), 'product_id', productIds);`);

fs.writeFileSync('src/server.js', code);
console.log('Patched chunking');
