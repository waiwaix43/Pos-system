const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(        if (error) throw error; res.json(data);\n    } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }); }\n});\n\n\napp.put('/api/orders/:id', \napp.put('/api/orders/:id');
fs.writeFileSync('server.js', content, 'utf8');
