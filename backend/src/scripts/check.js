const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data: shops } = await db.from('shops').select('*');
  console.log("Shops:", shops);
  
  const { count: orderCount } = await db.from('orders').select('*', { count: 'exact', head: true });
  console.log("Total orders:", orderCount);

  const { data: orders } = await db.from('orders').select('shop_id').limit(5);
  console.log("Some order shop_ids:", orders);
}

run();
