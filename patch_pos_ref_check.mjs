import fs from 'fs';
let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

content = content.replace(
    "{shopSettings?.promptpay_payload || shopSettings?.promptpay_id ? (", 
    "{shopSettings?.qr_reference_number || shopSettings?.promptpay_payload || shopSettings?.promptpay_id ? ("
);

fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
console.log("Patched POS page for qr_reference_number");
