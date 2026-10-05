const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// สร้างตัวแปร db เพื่อใช้เชื่อมต่อกับ Supabase
const db = createClient(supabaseUrl, supabaseKey);

console.log('Database connection to Supabase completed.');

module.exports = db;