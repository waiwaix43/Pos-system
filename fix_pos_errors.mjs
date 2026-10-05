import fs from 'fs';
let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

// Fix the -> syntax error
content = content.replace('การตั้งค่า -> การชำระเงิน', 'การตั้งค่า &gt; การชำระเงิน');

// Fix QrCode import
if (!content.includes('QrCode,')) {
    content = content.replace('AlertCircle } from "lucide-react";', 'AlertCircle, QrCode } from "lucide-react";');
}

fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
console.log("Fixed JSX syntax error and QrCode import");
