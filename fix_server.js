const fs = require('fs');
let content = fs.readFileSync('backend/server.js', 'utf8');

// We need to revert .order('sort_order', { ascending: true }).order('id', { ascending: false })
// back to .order('id', { ascending: false }) for everything EXCEPT categories.

// Let's just do a global replace back to id
content = content.replace(/\.order\('sort_order', \{ ascending: true \}\)\.order\('id', \{ ascending: false \}\)/g, ".order('id', { ascending: false })");

// And only put it back for categories.
// We'll find the line: db.from('categories').select('*').eq('shop_id', shop_id).order('id', { ascending: false });
content = content.replace(/db\.from\('categories'\)\.select\('\*'\)\.eq\('shop_id', shop_id\)\.order\('id', \{ ascending: false \}\)/, 
  "db.from('categories').select('*').eq('shop_id', shop_id).order('sort_order', { ascending: true }).order('id', { ascending: false })");

fs.writeFileSync('backend/server.js', content, 'utf8');
