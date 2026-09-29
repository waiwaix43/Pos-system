const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

const DEMO_EMAIL = 'owner@happypostest.local';
const SHOP_NAME = 'Happy POS Demo Cafe';
const PASSWORD = 'HappyPOS_Test_2026!';

const isReset = process.argv.includes('--reset');

async function checkMissingTables() {
  const { error } = await db.from('customers').select('id').limit(1);
  if (error && error.message.includes("Could not find the table")) {
    console.warn("==================================================================");
    console.warn("⚠️  WARNING: Missing tables detected (customers, expenses, etc.)");
    console.warn("Please run the SQL migration in 'backend/seed_migration.sql' in your Supabase SQL Editor first!");
    console.warn("The seed will skip missing tables if you proceed.");
    console.warn("==================================================================");
    return false;
  }
  return true;
}

async function resetData() {
  const { data: shops } = await db.from('shops').select('id').eq('owner_email', DEMO_EMAIL);
  if (!shops || shops.length === 0) {
    console.log("No existing test data found to reset.");
    return;
  }
  for (const shop of shops) {
    const shopId = shop.id;
    console.log(`Resetting data for shop ID ${shopId}...`);
    // Delete in order to avoid FK constraints
    await db.from('order_items').delete().eq('order_id', 'in', `(select id from orders where shop_id=${shopId})`); // wait, supabase doesn't support subquery in delete well.
    
    // Simpler: just delete by shop_id
    const tables = [
      'notifications', 'stock_movements', 'order_items', 'orders', 'shifts', 
      'recipes', 'product_options', 'option_items', 'option_groups', 
      'products', 'categories', 'inventory_items', 'suppliers', 'promotions',
      'shop_settings', 'staff', 'customers', 'expenses', 'purchase_items', 'purchases', 'audit_logs'
    ];
    
    for (const table of tables) {
      // For order_items and purchase_items, they don't have shop_id directly. We will skip if error.
      const { error } = await db.from(table).delete().eq('shop_id', shopId);
      if (error) {
          // order_items deletion by shop_id might fail if shop_id doesn't exist.
      }
    }
    
    // Try to delete order_items and purchase_items by getting IDs first
    const { data: orders } = await db.from('orders').select('id').eq('shop_id', shopId);
    if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await db.from('order_items').delete().in('order_id', orderIds);
    }
    await db.from('orders').delete().eq('shop_id', shopId);
    
    await db.from('shops').delete().eq('id', shopId);
    console.log(`Reset complete for shop ID ${shopId}.`);
  }
}

async function run() {
  const tablesExist = await checkMissingTables();
  if (isReset) {
    await resetData();
    console.log("Reset finished.");
    process.exit(0);
  }
  
  const { data: existingShop } = await db.from('shops').select('id').eq('owner_email', DEMO_EMAIL).single();
  if (existingShop) {
    console.log("Test data already exists. Run 'npm run db:reset' to clear it first, or use '--reset' flag.");
    process.exit(0);
  }

  console.log("Starting database seed...");
  
  // 1. Create Shop
  const { data: shopRes, error: shopErr } = await db.from('shops').insert([{ 
    shop_name: SHOP_NAME, 
    branch: 'Main Demo Branch', 
    owner_email: DEMO_EMAIL 
  }]).select('id').single();
  if (shopErr) throw shopErr;
  const shopId = shopRes.id;
  console.log(`✅ Created Shop (ID: ${shopId})`);

  // 2. Create Staff / Employees
  const salt = await bcrypt.genSalt(10);
  const hashPass = await bcrypt.hash(PASSWORD, salt);
  const ownerPin = await bcrypt.hash('1234', salt);
  const managerPin = await bcrypt.hash('2345', salt);
  const cashierPin = await bcrypt.hash('3456', salt);
  const staffPin = await bcrypt.hash('4567', salt);

  const staffData = [
    { shop_id: shopId, name: 'Demo Owner', email: DEMO_EMAIL, password: hashPass, role: 'เจ้าของร้าน', pin: ownerPin, status: 'active', phone: '0800000001' },
    { shop_id: shopId, name: 'Demo Manager 1', email: 'manager1@happypostest.local', password: hashPass, role: 'ผู้จัดการ', pin: managerPin, status: 'active', phone: '0800000002' },
    { shop_id: shopId, name: 'Demo Manager 2', email: 'manager2@happypostest.local', password: hashPass, role: 'ผู้จัดการ', pin: managerPin, status: 'active', phone: '0800000003' },
    { shop_id: shopId, name: 'Demo Cashier 1', email: 'cashier1@happypostest.local', password: hashPass, role: 'พนักงานแคชเชียร์', pin: cashierPin, status: 'active', phone: '0800000004' },
    { shop_id: shopId, name: 'Demo Cashier 2', email: 'cashier2@happypostest.local', password: hashPass, role: 'พนักงานแคชเชียร์', pin: cashierPin, status: 'active', phone: '0800000005' },
    { shop_id: shopId, name: 'Demo Staff', email: 'staff@happypostest.local', password: hashPass, role: 'พนักงานทั่วไป', pin: staffPin, status: 'active', phone: '0800000006' }
  ];
  const { data: staffRes, error: staffErr } = await db.from('staff').insert(staffData).select();
  if (staffErr) throw staffErr;
  console.log(`✅ Created ${staffRes.length} Staff members`);
  const cashierId = staffRes.find(s => s.role === 'พนักงานแคชเชียร์').id;

  // 3. Shop Settings
  const defaultSettings = {
    shop_name: SHOP_NAME, branch_name: 'Main Demo Branch',
    address: '123 Demo Street, Bangkok', phone: '080-000-0000', email: DEMO_EMAIL,
    allow_negative_stock: false, auto_deduct_stock: true, auto_print_receipt: true,
    receipt_prefix: "DEMO-", receipt_start_number: "10001",
    pin_enabled: true, pin_settings: {},
    payment_cash_enabled: true, payment_qr_enabled: true, payment_transfer_enabled: true, payment_credit_enabled: true,
    alert_low_stock: true, low_stock_threshold: 20, vat_enabled: true, vat_rate: 7, prices_include_vat: true,
    notify_low_stock: true, notify_out_of_stock: true, notify_refund: true, notify_cancel_bill: true,
    currency: "THB", timezone: "Asia/Bangkok"
  };
  await db.from('shop_settings').insert([{ shop_id: shopId, settings_data: defaultSettings }]);
  console.log(`✅ Created Shop Settings`);

  // 4. Categories
  const catNames = ['Coffee', 'Tea', 'Non-Coffee', 'Cocoa', 'Smoothie', 'Soda', 'Bakery', 'Cake', 'Food', 'Add-ons'];
  const { data: catsRes } = await db.from('categories').insert(catNames.map(name => ({ shop_id: shopId, name, status: 'active' }))).select();
  console.log(`✅ Created ${catsRes.length} Categories`);
  const getCatId = (name) => catsRes.find(c => c.name === name).id;

  // 5. Suppliers
  const supplierData = [
    { shop_id: shopId, name: 'Premium Coffee Roasters', contact_name: 'John Doe', phone: '02000001', status: 'active' },
    { shop_id: shopId, name: 'Dairy & Milk Supply', contact_name: 'Jane Smith', phone: '02000002', status: 'active' },
    { shop_id: shopId, name: 'Eco Packaging Co.', contact_name: 'Bob Box', phone: '02000003', status: 'active' },
    { shop_id: shopId, name: 'Fresh Bakery Hub', contact_name: 'Alice Bread', phone: '02000004', status: 'active' },
    { shop_id: shopId, name: 'General Market', contact_name: 'Tom Mart', phone: '02000005', status: 'active' }
  ];
  const { data: supRes } = await db.from('suppliers').insert(supplierData).select();
  console.log(`✅ Created ${supRes.length} Suppliers`);

  // 6. Inventory Items (Raw Materials & Packaging)
  const invData = [
    // Coffee
    { shop_id: shopId, category_id: null, name: 'Coffee Beans (Espresso)', quantity: 5000, unit: 'g', min_threshold: 1000, cost: 0.5, sku: 'RAW-TEST-001', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Coffee Beans (Filter)', quantity: 2000, unit: 'g', min_threshold: 500, cost: 0.8, sku: 'RAW-TEST-002', type: 'material', supplier_id: supRes[0].id, status: 'active' },
    // Dairy
    { shop_id: shopId, category_id: null, name: 'Fresh Milk', quantity: 10000, unit: 'ml', min_threshold: 2000, cost: 0.05, sku: 'RAW-TEST-003', type: 'material', supplier_id: supRes[1].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Condensed Milk', quantity: 5000, unit: 'ml', min_threshold: 1000, cost: 0.08, sku: 'RAW-TEST-004', type: 'material', supplier_id: supRes[1].id, status: 'active' },
    // Syrups & Others
    { shop_id: shopId, category_id: null, name: 'Vanilla Syrup', quantity: 3000, unit: 'ml', min_threshold: 500, cost: 0.2, sku: 'RAW-TEST-005', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Matcha Powder', quantity: 1000, unit: 'g', min_threshold: 200, cost: 1.5, sku: 'RAW-TEST-006', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Cocoa Powder', quantity: 1500, unit: 'g', min_threshold: 300, cost: 0.8, sku: 'RAW-TEST-007', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    // Packaging
    { shop_id: shopId, category_id: null, name: '16 oz Cup', quantity: 1000, unit: 'pcs', min_threshold: 200, cost: 2, sku: 'PKG-TEST-001', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Cup Lid', quantity: 1000, unit: 'pcs', min_threshold: 200, cost: 0.5, sku: 'PKG-TEST-002', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Straw', quantity: 2000, unit: 'pcs', min_threshold: 500, cost: 0.2, sku: 'PKG-TEST-003', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Paper Bag', quantity: 500, unit: 'pcs', min_threshold: 100, cost: 1.5, sku: 'PKG-TEST-004', type: 'packaging', supplier_id: supRes[2].id, status: 'active' },
    // Scenario data: Low Stock & Out of Stock
    { shop_id: shopId, category_id: null, name: 'Caramel Syrup', quantity: 150, unit: 'ml', min_threshold: 500, cost: 0.2, sku: 'RAW-TEST-LOW', type: 'material', supplier_id: supRes[4].id, status: 'active' },
    { shop_id: shopId, category_id: null, name: 'Oat Milk', quantity: 0, unit: 'ml', min_threshold: 1000, cost: 0.1, sku: 'RAW-TEST-OUT', type: 'material', supplier_id: supRes[1].id, status: 'active' }
  ];
  const { data: invRes } = await db.from('inventory_items').insert(invData).select();
  console.log(`✅ Created ${invRes.length} Inventory Items`);
  
  const getInvId = (sku) => invRes.find(i => i.sku === sku)?.id;

  // 7. Products
  const prodData = [
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Americano (Hot)', price: 50, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Americano (Iced)', price: 60, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Latte (Hot)', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Latte (Iced)', price: 75, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Cappuccino (Hot)', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Coffee'), name: 'Mocha (Iced)', price: 80, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Thai Tea (Iced)', price: 55, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Tea'), name: 'Matcha Latte (Iced)', price: 85, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cocoa'), name: 'Signature Cocoa (Iced)', price: 70, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Smoothie'), name: 'Strawberry Smoothie', price: 90, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Bakery'), name: 'Butter Croissant', price: 65, status: 'active' },
    { shop_id: shopId, category_id: getCatId('Cake'), name: 'Chocolate Fudge Cake', price: 120, status: 'active' }
  ];
  const { data: prodsRes } = await db.from('products').insert(prodData).select();
  console.log(`✅ Created ${prodsRes.length} Products`);

  // 8. Recipes
  let recipeData = [];
  const addRecipe = (prodName, items) => {
    const pId = prodsRes.find(p => p.name === prodName)?.id;
    if (pId) {
      items.forEach(i => recipeData.push({ product_id: pId, inventory_item_id: i.id, quantity: i.qty, unit: i.unit }));
    }
  };
  
  // Americano Hot: 18g beans, 1 cup
  addRecipe('Americano (Hot)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('PKG-TEST-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-TEST-002'), qty: 1, unit: 'pcs' }
  ]);
  // Latte Iced: 18g beans, 150ml milk, 1 cup, 1 lid, 1 straw
  addRecipe('Latte (Iced)', [
    { id: getInvId('RAW-TEST-001'), qty: 18, unit: 'g' },
    { id: getInvId('RAW-TEST-003'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-TEST-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-TEST-002'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-TEST-003'), qty: 1, unit: 'pcs' }
  ]);
  // Matcha Latte: 10g matcha, 150ml milk, cup, lid, straw
  addRecipe('Matcha Latte (Iced)', [
    { id: getInvId('RAW-TEST-006'), qty: 10, unit: 'g' },
    { id: getInvId('RAW-TEST-003'), qty: 150, unit: 'ml' },
    { id: getInvId('PKG-TEST-001'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-TEST-002'), qty: 1, unit: 'pcs' },
    { id: getInvId('PKG-TEST-003'), qty: 1, unit: 'pcs' }
  ]);
  
  if(recipeData.length > 0) {
    await db.from('recipes').insert(recipeData);
    console.log(`✅ Created Recipes for products`);
  }

  // 9. Option Groups & Items
  const { data: ogRes } = await db.from('option_groups').insert([
    { shop_id: shopId, name: 'Sweetness', type: 'single', is_required: true, status: 'active' },
    { shop_id: shopId, name: 'Toppings', type: 'multiple', is_required: false, status: 'active' }
  ]).select();
  const sweetId = ogRes.find(o => o.name === 'Sweetness').id;
  const topId = ogRes.find(o => o.name === 'Toppings').id;
  
  await db.from('option_items').insert([
    { option_group_id: sweetId, name: '0%', price: 0, status: 'active' },
    { option_group_id: sweetId, name: '50%', price: 0, status: 'active' },
    { option_group_id: sweetId, name: '100%', price: 0, status: 'active' },
    { option_group_id: topId, name: 'Extra Shot', price: 15, status: 'active' },
    { option_group_id: topId, name: 'Brown Sugar Jelly', price: 10, status: 'active' }
  ]);
  console.log(`✅ Created Option Groups & Items`);

  // 10. Promotions
  await db.from('promotions').insert([
    { shop_id: shopId, name: 'Opening 10% Off', discount_type: 'percent', discount_value: 10, start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' },
    { shop_id: shopId, name: '15 THB Off', discount_type: 'amount', discount_value: 15, start_date: '2026-01-01', end_date: '2026-12-31', status: 'active' }
  ]);
  console.log(`✅ Created Promotions`);

  // 11. Shifts
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);
  const { data: shiftRes } = await db.from('shifts').insert([
    { shop_id: shopId, staff_id: cashierId, opened_at: pastDate.toISOString(), closed_at: pastDate.toISOString(), opening_cash: 1000, closing_cash: 2500, expected_cash: 2500, cash_difference: 0, total_sales: 1500, status: 'CLOSED' },
    { shop_id: shopId, staff_id: cashierId, opened_at: new Date().toISOString(), opening_cash: 1000, total_sales: 0, status: 'OPEN' }
  ]).select();
  console.log(`✅ Created Shifts (1 Closed, 1 Open)`);
  
  const closedShift = shiftRes.find(s => s.status === 'CLOSED').id;
  const openShift = shiftRes.find(s => s.status === 'OPEN').id;

  // 12. Orders & Order Items
  console.log(`Generating test orders...`);
  let ordersData = [];
  let orderItemsData = [];
  let stockMovementsData = [];
  
  // Create 30 historical orders and 5 current orders
  for(let i = 1; i <= 35; i++) {
    const isPast = i <= 30;
    const shift = isPast ? closedShift : openShift;
    const itemIdx = i % prodsRes.length;
    const prod = prodsRes[itemIdx];
    const qty = (i % 3) + 1;
    const total = prod.price * qty;
    
    // Distribute payment methods
    const methods = ['เงินสด', 'QR PromptPay', 'Credit Card'];
    const pMethod = methods[i % 3];
    
    ordersData.push({
      bill_number: `DEMO-100${String(i).padStart(2, '0')}`,
      shop_id: shopId,
      staff_id: cashierId,
      shift_id: shift,
      order_type: (i%2===0) ? 'dine_in' : 'takeaway',
      total_amount: total,
      payment_method: pMethod,
      received_amount: total,
      change_amount: 0,
      status: 'completed'
    });
  }
  const { data: ordRes } = await db.from('orders').insert(ordersData).select();
  
  for (let i = 0; i < ordRes.length; i++) {
    const ord = ordRes[i];
    const prod = prodsRes[i % prodsRes.length];
    const qty = (i % 3) + 1;
    
    orderItemsData.push({
      order_id: ord.id,
      product_id: prod.id,
      quantity: qty,
      price: prod.price
    });
    
    // Simulate stock movement for recipe
    const recs = recipeData.filter(r => r.product_id === prod.id);
    for(const r of recs) {
      stockMovementsData.push({
        shop_id: shopId,
        inventory_item_id: r.inventory_item_id,
        movement_type: 'SALE',
        quantity: -(r.quantity * qty),
        balance_after: 0, // Mocked for speed
        reference_id: ord.id,
        reason: `ขายสินค้า POS (บิล ${ord.bill_number})`,
        created_by: cashierId
      });
    }
  }
  
  await db.from('order_items').insert(orderItemsData);
  if(stockMovementsData.length > 0) {
    await db.from('stock_movements').insert(stockMovementsData);
  }
  console.log(`✅ Created ${ordRes.length} Orders with Items and Stock Movements`);

  // 13. Notifications
  await db.from('notifications').insert([
    { shop_id: shopId, type: 'LOW_STOCK', priority: 'WARNING', title: 'สต็อกใกล้หมด', message: 'Caramel Syrup ใกล้หมด (เหลือ 150 ml)', dedupe_key: `LOW_STOCK_RAW-TEST-LOW` },
    { shop_id: shopId, type: 'OUT_OF_STOCK', priority: 'CRITICAL', title: 'สต็อกหมด', message: 'Oat Milk หมดแล้ว!', dedupe_key: `OUT_OF_STOCK_RAW-TEST-OUT` }
  ]);
  console.log(`✅ Created Notifications`);

  // 14. Optional missing tables (customers, expenses, audit_logs)
  if (tablesExist) {
    try {
      await db.from('customers').insert([
        { shop_id: shopId, name: 'VIP Customer', phone: '0901112222', member_level: 'VIP', points: 500, total_purchase: 5000 }
      ]);
      await db.from('expenses').insert([
        { shop_id: shopId, expense_category: 'Rent', amount: 15000, expense_date: new Date().toISOString(), created_by: cashierId }
      ]);
      await db.from('audit_logs').insert([
        { shop_id: shopId, staff_id: cashierId, action: 'OPEN_SHIFT', entity_type: 'SHIFT', entity_id: openShift }
      ]);
      const { data: purchaseData } = await db.from('purchases').insert([
        { shop_id: shopId, supplier_id: supRes[0].id, purchase_date: new Date().toISOString(), total_amount: 5000, status: 'completed', created_by: cashierId }
      ]).select('id').single();
      if (purchaseData) {
        await db.from('purchase_items').insert([
          { purchase_id: purchaseData.id, inventory_item_id: getInvId('RAW-TEST-001'), quantity: 10, unit_price: 500, total_price: 5000 }
        ]);
      }
      console.log(`✅ Seeded optional data (Customers, Expenses, Purchases, Audit Logs)`);
    } catch(e) {
      console.log(`⚠️  Skipped optional tables due to error: ${e.message}`);
    }
  }

  console.log("================================================");
  console.log("🎉 Seed completed successfully!");
  console.log("Use credentials:");
  console.log(`Owner Email: ${DEMO_EMAIL} (Role: Owner, PIN: 1234)`);
  console.log(`Cashier Email: cashier1@happypostest.local (Role: Cashier, PIN: 3456)`);
  console.log(`Password for all: ${PASSWORD}`);
  console.log("================================================");
  process.exit(0);
}

run().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
