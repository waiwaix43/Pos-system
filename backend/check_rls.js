const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:0ODh7HFGpLpB7Jg2@db.ecyzdbnbxzddwmltswmw.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('shops', 'staff', 'orders', 'products') AND relkind = 'r'");
  console.log(res.rows);
  await client.end();
}
run();
