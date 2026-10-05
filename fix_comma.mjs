import fs from 'fs';
let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

content = content.replace('LocateFixed\n    QrCode', 'LocateFixed,\n    QrCode');

fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Fixed comma");
