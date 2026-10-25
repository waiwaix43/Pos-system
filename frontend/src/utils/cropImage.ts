export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

import { drawToCompressedDataUrl } from './imageCompress';

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
  const image = await createImage(imageSrc);

  // ตัดรูปตามวงกลม แล้วย่อไม่เกิน 400px + บีบอัด JPEG เพื่อให้ Base64 เล็ก (หลักสิบ KB แทนที่จะเป็นหลาย MB)
  return drawToCompressedDataUrl(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    { maxSize: 400, quality: 0.8 }
  );
}