import fs from 'fs';
import path from 'path';

const file = 'frontend/src/app/pos/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                          <div className="mb-4 text-[14px] text-gray-500 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2">
                             <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                             <p>กำหนดช่องทางการชำระเงินที่ต้องการแสดงในหน้า POS สามารถเปิด-ปิด และจัดเรียงลำดับได้ ข้อมูลนี้จะถูกบันทึกลงในบิลขายจริง</p>
                          </div>`;

const replaceStr = targetStr + `
                          
                          <div className="mb-5 rounded-[16px] border border-gray-200 bg-gray-50 p-4">
                            <p className="mb-3 text-[14px] font-bold text-gray-800">ข้อมูลบัญชีรับเงินของร้าน (สำหรับ QR และโอนเงิน)</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">พร้อมเพย์ / เบอร์โทรศัพท์ (สำหรับสร้าง QR)</label>
                                    <input disabled={!isEditing} type="text" value={currentSettings?.promptpay_id || ''} onChange={(e) => setCurrentSettings({...currentSettings, promptpay_id: e.target.value})} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100" placeholder="08xxxxxxxx" />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">ธนาคาร (สำหรับโอนเงิน)</label>
                                    <input disabled={!isEditing} type="text" value={currentSettings?.bank_name || ''} onChange={(e) => setCurrentSettings({...currentSettings, bank_name: e.target.value})} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100" placeholder="เช่น กสิกรไทย" />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">เลขบัญชีธนาคาร</label>
                                    <input disabled={!isEditing} type="text" value={currentSettings?.bank_account || ''} onChange={(e) => setCurrentSettings({...currentSettings, bank_account: e.target.value})} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100" placeholder="xxx-x-xxxxx-x" />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">ชื่อบัญชี</label>
                                    <input disabled={!isEditing} type="text" value={currentSettings?.bank_account_name || ''} onChange={(e) => setCurrentSettings({...currentSettings, bank_account_name: e.target.value})} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100" placeholder="นาย ตัวอย่าง ทดสอบ" />
                                </div>
                            </div>
                          </div>`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync(file, content);
console.log("Replaced setting content!");
