import fs from 'fs';

let content = fs.readFileSync('backend/src/routes/paymentRoutes.js', 'utf8');

const regex = /if \(config\.promptpay_payload\) \{[\s\S]*?qrData = payload \+ checksum;\n        \} else \{/;

const replacement = `if (config.qr_reference_number && config.qr_reference_number.length === 15) {
            let payload = '00020101021229390016A0000006770101110315' + config.qr_reference_number + '53037645802TH';
            const amtStr = amount.toFixed(2);
            const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
            payload += tag54;
            payload += '6304';
            const crc16 = require('crc/crc16ccitt');
            const checksum = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
            qrData = payload + checksum;
        } else if (config.promptpay_payload) {
            let payload = config.promptpay_payload;
            payload = payload.slice(0, -8);
            payload = payload.replace('010211', '010212');
            const amtStr = amount.toFixed(2);
            const tag54 = '54' + amtStr.length.toString().padStart(2, '0') + amtStr;
            payload += tag54;
            payload += '6304';
            const crc16 = require('crc/crc16ccitt');
            const checksum = crc16(payload).toString(16).toUpperCase().padStart(4, '0');
            qrData = payload + checksum;
        } else {`;

content = content.replace(regex, replacement);
fs.writeFileSync('backend/src/routes/paymentRoutes.js', content);
console.log("Patched paymentRoutes for qr_reference_number");
