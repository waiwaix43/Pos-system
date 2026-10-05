import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

const qrModalRegex = /<button onClick=\{\(\) => \{ if\(pollingInterval\) clearInterval\(pollingInterval\); setView\('payment'\); \}\} className="mt-8 w-full py-4 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">ยกเลิก<\/button>/;

const newQrButtons = `
                  <div className="w-full flex gap-3 mt-8">
                      <button onClick={() => { if(pollingInterval) clearInterval(pollingInterval); setView('payment'); }} className="flex-1 py-4 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">ยกเลิก</button>
                      <button onClick={async () => {
                          if (pollingInterval) clearInterval(pollingInterval);
                          try {
                              const res = await fetch(\`http://localhost:5000/api/payments/\${qrTransaction.id}/confirm\`, { method: 'POST' });
                              const data = await res.json();
                              if (data.success) {
                                  setView('success');
                                  if (shopSettings?.auto_print_receipt) {
                                      // Receipt print logic can go here
                                  }
                              } else {
                                  alert('เกิดข้อผิดพลาด: ' + data.error);
                              }
                          } catch(e) { alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
                      }} className="flex-1 py-4 rounded-xl bg-[#7a5c4e] text-white font-bold hover:bg-[#684c3f]">ยืนยันรับเงิน (เช็คสลิปแล้ว)</button>
                  </div>
`;

if (qrModalRegex.test(content)) {
    content = content.replace(qrModalRegex, newQrButtons);
    fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
    console.log("Patched QR Modal with Confirm Button");
} else {
    console.log("Could not find QR Modal cancel button");
}
