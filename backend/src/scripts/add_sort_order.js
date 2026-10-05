const { Client } = require('pg');
const connectionString = 'postgresql://postgres:0ODh7HFGpLpB7Jg2@db.ecyzdbnbxzddwmltswmw.supabase.co:5432/postgres';
async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query('ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;');
    console.log('Added sort_order to categories');
  } catch (err) { console.error(err); } finally { await client.end(); }
}
run();
