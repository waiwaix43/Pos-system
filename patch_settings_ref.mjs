import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

// Remove handleQrExtract and its JSX
const oldExtractorRegex = /const handleQrExtract =[\s\S]*?reader\.readAsDataURL\(file\);\n    \}\n  \};\n/m;
content = content.replace(oldExtractorRegex, '');

const oldUIRegex = /<div>\s*<label className="block text-\[13px\] text-gray-600 mb-1">สแกนโค้ดจากแอปธนาคาร \(ดึงข้อมูลอัตโนมัติ\)<\/label>[\s\S]*?หรือระบุเบอร์พร้อมเพย์ด้วยตนเอง<\/label>/m;
const newUI = `<div>
                                    <label className="block text-[13px] text-gray-600 mb-1">เลขที่อ้างอิงจาก QR ธนาคาร (15 หลัก)</label>
                                    <input disabled={!isEditing} type="text" value={currentSettings?.qr_reference_number || ''} onChange={(e) => setCurrentSettings({...currentSettings, qr_reference_number: e.target.value})} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100" placeholder="เช่น 004999..." maxLength={20} />
                                    <p className="text-[11px] text-gray-500 mt-1">*ดูเลขที่อ้างอิงได้จากรูป QR Code ในแอปธนาคาร (ใต้ชื่อบัญชี)</p>
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">หรือระบุเบอร์พร้อมเพย์</label>`;

content = content.replace(oldUIRegex, newUI);

fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Patched settings to use QR reference number");
