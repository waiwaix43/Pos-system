import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

// 1. We remove qrPreview and qrFile from settings/page.tsx
content = content.replace("const [qrPreview, setQrPreview] = useState<string | null>(null);\n  const [qrFile, setQrFile] = useState<File | null>(null);", "");
content = content.replace("setQrPreview(data.settings_data?.qr_image || null);", "");
content = content.replace("setQrPreview(originalSettings?.qr_image || null);\n      setQrFile(null);", "");

// 2. Remove qr_image saving logic
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
content = content.replace(saveSettingsLogic, "const payloadSettings = { ...currentSettings, logo: finalLogoUrl };");
content = content.replace("setQrFile(null);", "");

// 3. Replace handleQrSelect with QR Extractor
const qrExtractor = `
  const handleQrExtract = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0, img.width, img.height);
                  const imageData = ctx.getImageData(0, 0, img.width, img.height);
                  const jsQR = require('jsqr');
                  const code = jsQR(imageData.data, imageData.width, imageData.height);
                  if (code && code.data) {
                      setCurrentSettings({...currentSettings, promptpay_payload: code.data});
                      setIsEditing(true);
                      setHasUnsavedChanges(true);
                      alert("ดึงข้อมูล QR Code สำเร็จ! ระบบจะสามารถสร้าง QR แบบระบุยอดเงินได้อัตโนมัติแล้วครับ");
                  } else {
                      alert("ไม่พบ QR Code ในรูปภาพ กรุณาลองใหม่อีกครั้ง");
                  }
              }
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };
`;
// Replace old handlers
const oldHandlersRegex = /const handleQrSelect =[\s\S]*?const handleRemoveQr =[\s\S]*?setHasUnsavedChanges\(true\);\n  };/m;
content = content.replace(oldHandlersRegex, qrExtractor);

// 4. Update UI
const oldUIRegex = /<div className="col-span-1 md:col-span-2 mb-2 p-4 border border-blue-100 bg-blue-50 rounded-xl">[\s\S]*?เบอร์พร้อมเพย์ \(กรณีต้องการสร้าง QR ระบุยอดเงิน\)<\/label>/m;
const newUI = `
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">สแกนโค้ดจากแอปธนาคาร (ดึงข้อมูลอัตโนมัติ)</label>
                                    <label className={\`block w-full text-center py-3 rounded-xl border border-blue-400 bg-blue-50 text-blue-700 font-bold cursor-pointer hover:bg-blue-100 transition-colors \${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}\`}>
                                        <Upload className="w-4 h-4 inline-block mr-2" />
                                        อัปโหลดรูป QR Code จากธนาคาร
                                        <input type="file" disabled={!isEditing} onChange={handleQrExtract} className="hidden" accept="image/*" />
                                    </label>
                                    {currentSettings?.promptpay_payload && <p className="text-xs text-green-600 mt-2 font-bold">✅ เชื่อมโยงบัญชีธนาคารแล้ว (สร้าง QR ระบุยอดอัตโนมัติได้)</p>}
                                </div>
                                <div>
                                    <label className="block text-[13px] text-gray-600 mb-1">หรือระบุเบอร์พร้อมเพย์ด้วยตนเอง</label>
`;
content = content.replace(oldUIRegex, newUI);

fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Patched settings for QR Extractor");
