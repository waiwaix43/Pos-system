import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

const bankBlockStart = content.indexOf('<div className="mb-5 rounded-[16px] border border-gray-200 bg-gray-50 p-4">\n                            <p className="mb-3 text-[14px] font-bold text-gray-800">ข้อมูลบัญชีรับเงินของร้าน');

if (bankBlockStart !== -1) {
    const nextBlockStart = content.indexOf('<div className="mb-5 rounded-[16px] border border-gray-200 bg-gray-50 p-4">\n                            <p className="mb-3 text-[14px] font-bold text-gray-800">เพิ่มช่องทางการชำระเงิน</p>', bankBlockStart);
    
    if (nextBlockStart !== -1) {
        const bankBlock = content.slice(bankBlockStart, nextBlockStart);
        content = content.slice(0, bankBlockStart) + content.slice(nextBlockStart);
        
        // Find the end of the payment methods list
        const endOfList = content.indexOf('</div>\n                      </div>\n                    )}');
        if (endOfList !== -1) {
            content = content.slice(0, endOfList) + '\n' + bankBlock + content.slice(endOfList);
            fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
            console.log("Moved the bank block to the bottom of the list!");
        } else {
            console.log("Could not find end of list");
        }
    } else {
        console.log("Could not find next block");
    }
} else {
    console.log("Could not find bank block");
}
