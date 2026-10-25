// ยูทิลิตี้ย่อ/บีบอัดรูปภาพฝั่งเบราว์เซอร์ ก่อนแปลงเป็น Base64 เก็บลงฐานข้อมูล
// เพื่อป้องกันสตริงขนาดหลาย MB ไหลไปกับ API / localStorage ทุกครั้ง

export interface CompressOptions {
  /** ด้านที่ยาวที่สุดของรูปหลังย่อ (px) */
  maxSize?: number;
  /** คุณภาพ JPEG 0-1 */
  quality?: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
    image.src = src;
  });

/** วาดรูปลง canvas ที่ย่อให้พอดี maxSize (พื้นหลังขาว กัน PNG โปร่งใสกลายเป็นสีดำเมื่อเป็น JPEG) แล้วส่งออกเป็น data URL แบบ JPEG */
export function drawToCompressedDataUrl(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  { maxSize = 512, quality = 0.82 }: CompressOptions = {}
): string | null {
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** ย่อและบีบอัดไฟล์รูป แล้วคืนค่าเป็น data URL (JPEG) */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const result = drawToCompressedDataUrl(image, 0, 0, image.naturalWidth, image.naturalHeight, options);
    if (!result) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
