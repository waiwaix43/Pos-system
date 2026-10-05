import fs from 'fs';

let content = fs.readFileSync('backend/src/routes/paymentRoutes.js', 'utf8');

const regex = /await db\.from\('stock_movements'\)\.insert\(\[\{[\s\S]*?\}\]\);/m;

const replacement = `await db.from('stock_movements').insert([{
                            shop_id: order.shop_id,
                            inventory_item_id: recipe.inventory_item_id,
                            movement_type: 'SALE',
                            quantity: -requiredQuantity,
                            balance_after: newQty,
                            reason: \`ขายสินค้า POS (บิล \${order.bill_number})\`,
                            reference_id: order.id
                        }]);`;

content = content.replace(regex, replacement);

// ALSO, let's reset the stuck transaction to PENDING so the user can test again!
// We'll write a quick sql to reset it in the next command.

fs.writeFileSync('backend/src/routes/paymentRoutes.js', content);
console.log("Patched processSuccessfulPayment");
