const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DEMO_EMAIL = 'owner@happypostest.local';

async function run() {
  console.log("Validating Database Integrity for Test Shop...");
  
  const { data: shop } = await db.from('shops').select('id').eq('owner_email', DEMO_EMAIL).single();
  if (!shop) {
    console.error("Test shop not found. Please run seed script first.");
    return;
  }
  
  const shopId = shop.id;
  let errors = 0;

  // 1. Check Orders have valid Shift
  const { data: orders } = await db.from('orders').select('id, bill_number, shift_id').eq('shop_id', shopId);
  if (orders) {
    for (const o of orders) {
      if (!o.shift_id) {
        console.error(`Order ${o.bill_number} has no shift_id.`);
        errors++;
      }
    }
  }

  // 2. Check Order Items have valid Product
  const { data: orderItems } = await db.from('order_items').select('id, product_id, order_id').in('order_id', orders ? orders.map(o=>o.id) : []);
  if (orderItems) {
    for (const oi of orderItems) {
      if (!oi.product_id) {
        console.error(`Order Item ${oi.id} has no valid product_id.`);
        errors++;
      }
    }
  }

  // 3. Check Negative Stock
  const { data: inventory } = await db.from('inventory_items').select('sku, quantity, name').eq('shop_id', shopId);
  if (inventory) {
    for (const inv of inventory) {
      if (inv.quantity < 0) {
        console.warn(`Warning: Inventory item ${inv.sku} (${inv.name}) has negative stock (${inv.quantity}).`);
      }
    }
  }

  // 4. Duplicate SKU Check
  if (inventory) {
    const skus = inventory.map(i => i.sku).filter(s => !!s);
    const hasDupes = new Set(skus).size !== skus.length;
    if (hasDupes) {
      console.error("Duplicate SKUs found in inventory.");
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`Validation completed with ${errors} errors. You may need to reset the seed.`);
    process.exit(1);
  } else {
    console.log("✅ Validation passed. No orphaned records or integrity issues found.");
    process.exit(0);
  }
}

run().catch(console.error);
