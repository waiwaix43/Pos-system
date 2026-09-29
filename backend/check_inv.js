const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:0ODh7HFGpLpB7Jg2@db.ecyzdbnbxzddwmltswmw.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("SELECT type, count(*) FROM inventory_items WHERE shop_id = 14 GROUP BY type");
  console.log(res.rows);
  await client.end();
}
run();
