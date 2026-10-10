// Client-side image compression applied before every storage upload. Phone
// photos are routinely 3-10 MB; downsizing and re-encoding them cuts storage,
// upload time, and the bandwidth every viewer pays when the image is shown.
// Anything that isn't a raster photo/screenshot (PDFs, SVG, GIF) passes
// through untouched, and so does any file the re-encode fails to shrink.

const SKIP_TYPES = new Set(['image/svg+xml', 'image/gif']);

function replaceExtension(name, ext) {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${base}.${ext}`;
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path (older Safari, odd formats).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file, { maxDimension = 1600, quality = 0.8 } = {}) {
  if (!file || !file.type?.startsWith('image/') || SKIP_TYPES.has(file.type)) return file;
  try {
    const bitmap = await decode(file);
    const width = bitmap.width;
    const height = bitmap.height;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // PNGs may be logos with transparency: keep alpha (WebP, or PNG where the
    // browser can't encode WebP). Everything else becomes JPEG on white.
    const keepAlpha = file.type === 'image/png';
    let blob;
    if (keepAlpha) {
      ctx.drawImage(bitmap, 0, 0, w, h);
      blob = await toBlob(canvas, 'image/webp', quality);
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png');
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      blob = await toBlob(canvas, 'image/jpeg', quality);
    }
    bitmap.close?.();

    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], replaceExtension(file.name, ext), { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

// Receipts and payment proofs must stay legible (small print, reference
// numbers), so they keep more resolution than a cover photo does.
export const COVER_PHOTO = { maxDimension: 1920, quality: 0.8 };
export const DOCUMENT_PHOTO = { maxDimension: 1600, quality: 0.85 };
