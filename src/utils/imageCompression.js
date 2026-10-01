// Resizes + re-encodes an image file client-side before it ever reaches
// Supabase Storage, so a 10MB phone photo doesn't become a 10MB banner that
// slows down every page that renders it. Every upload in the app (cover
// photos, category images, ID photos, sponsor logos) goes through
// ImageDropzone.jsx, which is the one place this is wired in — no call site
// needs to know this happens.
const MAX_DIMENSION = 1920;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 300 * 1024; // not worth re-encoding a file this small
const SKIP_MIME_TYPES = new Set(['image/gif', 'image/svg+xml']); // animation / vector — rasterizing would break or add nothing

export async function compressImage(file) {
  if (!file || !file.type.startsWith('image/') || SKIP_MIME_TYPES.has(file.type) || file.size < SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file; // compression didn't help — keep the original

    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Any failure (unsupported format, canvas error) falls back to the
    // original file — an optimization must never block the actual upload.
    return file;
  }
}
