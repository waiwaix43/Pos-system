import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

// 1. Add states
content = content.replace(
    "const [logoFile, setLogoFile] = useState<File | null>(null);",
    "const [logoFile, setLogoFile] = useState<File | null>(null);\n  const [qrPreview, setQrPreview] = useState<string | null>(null);\n  const [qrFile, setQrFile] = useState<File | null>(null);"
);

// 2. Initialize state in useEffect
content = content.replace(
    "setLogoPreview(data.settings_data?.logo || null);",
    "setLogoPreview(data.settings_data?.logo || null);\n          setQrPreview(data.settings_data?.qr_image || null);"
);

// 3. handleCancelEdit
content = content.replace(
    "setLogoFile(null);",
    "setLogoFile(null);\n      setQrPreview(originalSettings?.qr_image || null);\n      setQrFile(null);"
);

// 4. Save Settings logic
const saveSettingsLogic = `
      let finalQrUrl = currentSettings.qr_image;
      if (qrFile) {
        finalQrUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(qrFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      } else if (qrPreview === null) {
        finalQrUrl = '';
      }
      const payloadSettings = { ...currentSettings, logo: finalLogoUrl, qr_image: finalQrUrl };
`;
content = content.replace(
    "const payloadSettings = { ...currentSettings, logo: finalLogoUrl };",
    saveSettingsLogic
);
content = content.replace(
    "setLogoFile(null);",
    "setLogoFile(null);\n        setQrFile(null);"
);

// 5. Handlers
const handlers = `
  const handleQrSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setQrPreview(reader.result as string);
      reader.readAsDataURL(file);
      setIsEditing(true);
      setHasUnsavedChanges(true);
    }
  };
  const handleRemoveQr = () => {
    setQrFile(null);
    setQrPreview(null);
    setIsEditing(true);
    setHasUnsavedChanges(true);
  };
`;
content = content.replace(
    "const handleRemoveLogo = () => {",
    handlers + "\n  const handleRemoveLogo = () => {"
);

// 6. UI Injection
const targetUI = `<label className="block text-[13px] text-gray-600 mb-1">พร้อมเพย์ / เบอร์โทรศัพท์ (สำหรับสร้าง QR)</label>`;
const newUI = `
                                <div className="col-span-1 md:col-span-2 mb-2 p-4 border border-blue-100 bg-blue-50 rounded-xl">
                                    <h4 className="text-[14px] font-bold text-gray-800 mb-2">อัปโหลดรูป QR Code ของร้าน (สำหรับให้ลูกค้าสแกนโอนเงิน)</h4>
                                    <p className="text-[12px] text-gray-600 mb-3">หากไม่มีเบอร์พร้อมเพย์ สามารถเซฟรูป QR Code จากแอปธนาคารมาอัปโหลดที่นี่ได้ ระบบจะแสดงรูปนี้บนหน้าจอ POS ให้ลูกค้าสแกนแทนครับ</p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 bg-white border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
                                            {qrPreview ? <img src={qrPreview} alt="QR" className="w-full h-full object-contain" /> : <QrCode className="w-8 h-8 text-gray-300" />}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className={\`px-3 py-2 text-[13px] font-bold rounded-lg cursor-pointer text-center \${!isEditing ? 'bg-gray-100 text-gray-400' : 'bg-white border border-gray-300 hover:bg-gray-50'}\`}>
                                                อัปโหลดรูป QR
                                                <input type="file" disabled={!isEditing} onChange={handleQrSelect} className="hidden" accept="image/*" />
                                            </label>
                                            {qrPreview && isEditing && (
                                                <button type="button" onClick={handleRemoveQr} className="px-3 py-2 text-[13px] font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100">ลบรูป</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">เบอร์พร้อมเพย์ (กรณีต้องการสร้าง QR ระบุยอดเงิน)</label>
`;
content = content.replace(targetUI, newUI);

// 7. Icon import
if (!content.includes('QrCode')) {
    content = content.replace('Upload, Store', 'Upload, Store, QrCode');
}

fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Patched settings QR upload.");
