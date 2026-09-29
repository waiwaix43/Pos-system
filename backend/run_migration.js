const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:0ODh7HFGpLpB7Jg2@db.ecyzdbnbxzddwmltswmw.supabase.co:5432/postgres';

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    const sql = fs.readFileSync(path.join(__dirname, 'seed_migration.sql'), 'utf8');
    
    console.log('Executing migration...');
    await client.query(sql);
    console.log('Migration executed successfully.');
    
    // Check if the tables were actually created
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('customers', 'expenses', 'purchases', 'purchase_items', 'audit_logs')
    `);
    console.log('Created tables:', res.rows.map(r => r.table_name).join(', '));
    
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
