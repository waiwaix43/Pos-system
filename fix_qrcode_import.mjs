import fs from 'fs';
let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

if (!content.includes('QrCode,')) {
    content = content.replace('} from "lucide-react";', '    QrCode\n} from "lucide-react";');
}

fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Added QrCode import");
