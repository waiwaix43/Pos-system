const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

const DEMO_EMAIL = 'crema@gmail.com';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  console.log("Starting to generate 6 months of historical data...");

  // 1. Get Shop
  const { data: shopRes, error: shopErr } = await db.from('shops').select('id').eq('owner_email', DEMO_EMAIL).single();
  if (shopErr || !shopRes) {
    console.error("Shop not found. Please run seed.js first.");
    process.exit(1);
  }
  const shopId = shopRes.id;
  
  // 2. Get Staff
  const { data: staffRes, error: staffErr } = await db.from('staff').select('id, role').eq('shop_id', shopId);
  if (staffErr || !staffRes || staffRes.length === 0) {
    console.error("Staff not found.");
    process.exit(1);
  }
  const cashiers = staffRes.filter(s => s.role === 'พนักงานแคชเชียร์' || s.role === 'เจ้าของร้าน');
  const cashierIds = cashiers.length > 0 ? cashiers.map(c => c.id) : staffRes.map(s => s.id);

  // 3. Get Products
  const { data: products, error: prodErr } = await db.from('products').select('id, price, category_id').eq('shop_id', shopId);
  if (prodErr || !products || products.length === 0) {
    console.error("Products not found.");
    process.exit(1);
  }

  // 4. Generate data day by day for the last 180 days
  const today = new Date('2026-10-09T00:00:00Z');
  let currentBillNum = 20000; // start bill number to avoid collision with seed.js

  const BATCH_SIZE = 100;
  let ordersToInsert = [];
  let orderItemsToInsert = [];
  let shiftsToInsert = [];

  for (let i = 180; i >= 1; i--) {
    const currentDay = new Date(today);
    currentDay.setDate(today.getDate() - i);
    
    // Create 1 shift for the day
    // Shift opens at 08:00 and closes at 18:00
    const shiftOpen = new Date(currentDay);
    shiftOpen.setHours(8, 0, 0, 0);
    
    const shiftClose = new Date(currentDay);
    shiftClose.setHours(18, 0, 0, 0);
    
    const cashierId = randomChoice(cashierIds);

    // Number of orders per day (randomly between 20 to 60)
    // Weekend logic: Saturday and Sunday might have more orders
    const dayOfWeek = currentDay.getDay();
    let numOrders = randomInt(20, 45);
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      numOrders = randomInt(40, 70); // Weekends are busier
    }

    // Shift data
    let dailyTotalSales = 0;
    const shiftId = 'shift_' + i; // Temporary ID for mapping, will replace after insert or we can just not use foreign key for shift_id if not strictly required.
    // Actually, order needs a valid shift_id if it's a foreign key. Let's insert shift first.
    
    const { data: shiftIns, error: shiftErr } = await db.from('shifts').insert([{
      shop_id: shopId,
      staff_id: cashierId,
      opened_at: shiftOpen.toISOString(),
      closed_at: shiftClose.toISOString(),
      opening_cash: 1000,
      status: 'CLOSED'
    }]).select('id').single();

    if (shiftErr) {
      console.error("Error inserting shift:", shiftErr);
      continue;
    }
    const realShiftId = shiftIns.id;

    // Insert orders and items
    // Since we need to map order ID to items, we can either insert one by one or insert batch and match by a unique field.
    // bill_number is unique!
    let batchOrdersToInsert = [];
    let itemsByBillNumber = {};

    for (let o = 0; o < numOrders; o++) {
      const orderTime = new Date(currentDay);
      orderTime.setHours(8, randomInt(0, 590), randomInt(0, 59), 0); 

      const numItems = randomInt(1, 4);
      let orderTotal = 0;
      let orderItems = [];
      
      const pMethod = randomChoice(['เงินสด', 'QR PromptPay', 'Credit Card']);
      const orderType = randomChoice(['dine_in', 'takeaway', 'delivery']);

      for (let item = 0; item < numItems; item++) {
        const prod = randomChoice(products);
        const qty = randomInt(1, 3);
        orderTotal += prod.price * qty;
        
        orderItems.push({
          product_id: prod.id,
          quantity: qty,
          price: prod.price
        });
      }

      currentBillNum++;
      const billNumber = `HIST-${currentDay.toISOString().slice(0,10).replace(/-/g,'')}-${currentBillNum}`;

      dailyTotalSales += orderTotal;

      batchOrdersToInsert.push({
        bill_number: billNumber,
        shop_id: shopId,
        staff_id: cashierId,
        shift_id: realShiftId,
        order_type: orderType,
        total_amount: orderTotal,
        payment_method: pMethod,
        received_amount: orderTotal,
        change_amount: 0,
        status: 'completed',
        created_at: orderTime.toISOString()
      });

      itemsByBillNumber[billNumber] = orderItems;
    }

    // Update shift with daily total
    await db.from('shifts').update({
      closing_cash: 1000 + (dailyTotalSales * 0.4), 
      expected_cash: 1000 + (dailyTotalSales * 0.4),
      cash_difference: 0,
      total_sales: dailyTotalSales
    }).eq('id', realShiftId);
    
    // Insert orders
    const { data: insertedOrders, error: ordersErr } = await db.from('orders').insert(batchOrdersToInsert).select('id, bill_number');
    if (ordersErr) {
      console.error("Error inserting orders:", ordersErr);
      continue;
    }

    // Prepare order items
    let batchOrderItemsToInsert = [];
    for (const order of insertedOrders) {
      const items = itemsByBillNumber[order.bill_number];
      if (items) {
        for (const item of items) {
          batchOrderItemsToInsert.push({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
          });
        }
      }
    }

    // Insert order items
    if (batchOrderItemsToInsert.length > 0) {
      const { error: itemsErr } = await db.from('order_items').insert(batchOrderItemsToInsert);
      if (itemsErr) {
        console.error("Error inserting order items:", itemsErr);
      }
    }

    if (i % 10 === 0) {
       console.log(`Generated data for ${i} days ago... (${currentDay.toISOString().slice(0,10)})`);
    }
  }

  console.log("Done generating data!");
}

run();
