const fs = require('fs');
let content = fs.readFileSync('frontend/app/pos/history/page.tsx', 'utf8');

content = content.replace("fetch(\http://localhost:5000/api/orders?shop_id=\\)", "fetch(\http://localhost:5000/api/orders?shop_id=\&limit=500\)");
content = content.replace("if (Array.isArray(data))", "if (data.data) data = data.data;\n          if (Array.isArray(data))");

fs.writeFileSync('frontend/app/pos/history/page.tsx', content, 'utf8');
console.log('History page updated');
