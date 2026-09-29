const fs = require('fs');
let c = fs.readFileSync('seed.js', 'utf8');
c = c.replace(/type: 'material'/g, "type: 'raw_material'");
fs.writeFileSync('seed.js', c);

const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:0ODh7HFGpLpB7Jg2@db.ecyzdbnbxzddwmltswmw.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("UPDATE inventory_items SET type = 'raw_material' WHERE type = 'material'");
  console.log("Updated rows:", res.rowCount);
  await client.end();
}
run();
