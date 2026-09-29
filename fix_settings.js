const fs = require('fs');
let content = fs.readFileSync('frontend/app/pos/settings/page.tsx', 'utf8');
content = content.replace('branch: string;', 'branch: string;\n  pin_enabled?: boolean;');
fs.writeFileSync('frontend/app/pos/settings/page.tsx', content, 'utf8');
