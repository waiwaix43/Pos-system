import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

const oldBlock = `{shopSettings?.promptpay_id ? (
                            <>
                                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                                    <QRCodeCanvas value={generatePayload(shopSettings.promptpay_id, { amount: totalPrice })} size={200} />
                                </div>
                                <span className="text-[18px] font-bold text-gray-800">สแกน QR เพื่อชำระเงิน</span>
                                <span className="text-[14px] text-gray-500 mt-1">พร้อมเพย์: {shopSettings.promptpay_id}</span>
                            </>
                        ) : (
                            <div className="text-red-500 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8" />
                                <span>ยังไม่ได้ตั้งค่าพร้อมเพย์ของร้าน</span>
                                <span className="text-sm">กรุณาตั้งค่าในเมนู "ข้อมูลบัญชีรับเงินของร้าน"</span>
                            </div>
                        )}`;

const newBlock = `{shopSettings?.promptpay_payload || shopSettings?.promptpay_id ? (
                            <div className="flex flex-col items-center">
                                <div className="bg-green-100 p-4 rounded-full mb-4">
                                    <QrCode className="w-12 h-12 text-green-600" />
                                </div>
                                <span className="text-[18px] font-bold text-gray-800">ระบบพร้อมสร้าง QR อัตโนมัติ</span>
                                <span className="text-[14px] text-gray-500 mt-2">กดยืนยันชำระเงินด้านล่าง เพื่อแสดง QR Code สำหรับสแกน</span>
                            </div>
                        ) : (
                            <div className="text-red-500 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8" />
                                <span>ยังไม่ได้ตั้งค่า QR รับเงินของร้าน</span>
                                <span className="text-sm">กรุณาอัปโหลดรูป QR ในเมนู "การตั้งค่า -> การชำระเงิน"</span>
                            </div>
                        )}`;

content = content.replace(oldBlock, newBlock);

// Also need to make sure QrCode is imported in page.tsx!
if (!content.includes('QrCode,')) {
    content = content.replace('Upload, User, Search', 'Upload, User, Search, QrCode');
    // If that fails, just try appending it to lucide-react imports
}

fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
console.log("Patched inline QR section completely");
