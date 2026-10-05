import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

// Replace the transfer_pending view to show the Static QR image if available
const transferViewRegex = /\{view === 'transfer_pending' && \([\s\S]*?ปิดหน้านี้<\/button>\s*<\/div>\s*<\/div>\s*\)\}/;

const newTransferView = `{view === 'transfer_pending' && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col p-6 items-center justify-center">
               <div className="max-w-md w-full bg-gray-50 border border-gray-200 rounded-3xl p-8 flex flex-col items-center text-center">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">โอนเงินเข้าบัญชี</h2>
                  <div className="w-full flex justify-between border-b border-gray-200 pb-4 mb-4">
                      <span className="text-gray-500">ยอดชำระ</span>
                      <span className="text-2xl font-bold text-[#7a5c4e]">฿{totalPrice.toFixed(2)}</span>
                  </div>
                  
                  {shopSettings?.qr_image && (
                      <div className="mb-4 bg-white p-2 rounded-xl shadow-sm inline-block">
                          <img src={shopSettings.qr_image} alt="QR สำหรับโอนเงิน" className="w-[200px] h-auto object-contain rounded-lg" />
                          <p className="text-sm font-bold mt-2 text-gray-700">สแกนเพื่อโอนเงิน</p>
                          <p className="text-xs text-red-500 mt-1">*กรุณาระบุยอดเงินเอง</p>
                      </div>
                  )}

                  <div className="text-left w-full bg-blue-50 p-4 rounded-xl mb-6">
                      <p className="text-sm font-bold text-gray-800 mb-1">ธนาคาร: {shopSettings?.bank_name || '-'}</p>
                      <p className="text-sm text-gray-700">เลขบัญชี: <span className="font-bold text-lg">{shopSettings?.bank_account || '-'}</span></p>
                      <p className="text-sm text-gray-700">ชื่อบัญชี: {shopSettings?.bank_account_name || '-'}</p>
                  </div>
                  
                  <p className="text-gray-600 mb-6 text-sm">กรุณาตรวจสอบสลิปการโอนเงินของลูกค้า หากถูกต้องแล้ว ให้ดำเนินการอัปเดตสถานะในระบบจัดการหลังบ้าน หรือกดยืนยันใบเสร็จ</p>
                  <button onClick={finishTransaction} className="w-full py-4 rounded-xl bg-[#7a5c4e] text-white font-bold hover:bg-[#684c3f]">ปิดหน้านี้ (โอนเงินสำเร็จแล้ว)</button>
               </div>
            </div>
          )}`;

if (transferViewRegex.test(content)) {
    content = content.replace(transferViewRegex, newTransferView);
    fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
    console.log("Patched POS transfer view.");
} else {
    console.log("Could not find transfer_pending view.");
}
