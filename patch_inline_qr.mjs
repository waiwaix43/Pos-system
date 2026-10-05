import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

const qrSectionRegex = /\{shopSettings\?\.promptpay_id \? \([\s\S]*?\}<\/div>\s*\)\s*:\s*selectedPaymentConfig\?\.type === 'TRANSFER' \? \(/;

const newQrSection = `{shopSettings?.promptpay_payload || shopSettings?.promptpay_id ? (
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
                                <span className="text-sm">กรุณาตั้งค่าในเมนู "การตั้งค่า -> การชำระเงิน"</span>
                            </div>
                        )}
                    </div>
                  ) : selectedPaymentConfig?.type === 'TRANSFER' ? (`;

if (qrSectionRegex.test(content)) {
    content = content.replace(qrSectionRegex, newQrSection);
    fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
    console.log("Patched inline QR section");
} else {
    console.log("Could not find inline QR section");
}
