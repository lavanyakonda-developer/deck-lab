// Reads a user-picked image file into a compressed JPEG data: URI (images
// live inside the deck in localStorage, so size matters - the same reason
// AI-generated images are JPEG). Browser-only.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export interface LoadedImage {
  url: string;
  width: number;
  height: number;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read that image"));
    el.src = source;
  });

  const ratio = Math.min(
    1,
    MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const width = Math.round(img.naturalWidth * ratio);
  const height = Math.round(img.naturalHeight * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { url: source, width, height };
  // White underlay so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { url: canvas.toDataURL("image/jpeg", JPEG_QUALITY), width, height };
}
