const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace("app.use(cors());", "app.use(cors());\napp.options('*', cors());");
fs.writeFileSync('server.js', content, 'utf8');
