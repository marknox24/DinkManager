// Resizes + re-encodes an image file client-side before it ever reaches
// Supabase Storage, so a 10MB phone photo doesn't become a 10MB banner that
// slows down every page that renders it. Every upload in the app (cover
// photos, category images, ID photos, sponsor logos) goes through
// ImageDropzone.jsx, which is the one place this is wired in — no call site
// needs to know this happens.
//
// Shares its decode/resize step with utils/imageCompress.js (the other
// compressor in this app, used directly by storage-upload call sites in
// data/eventsApi.js) rather than duplicating that canvas/createImageBitmap
// logic a second time. The two keep separate public functions on purpose:
// this one always flattens to JPEG and has a "don't bother re-encoding a
// small file" floor that imageCompress.js's callers don't want; merging the
// two fully would mean either changing this file's long-standing output
// format for its existing upload surfaces, or losing imageCompress.js's
// alpha-preserving WebP path — a bigger, riskier change than the actual
// problem (duplicated mechanics) called for.
import { decodeToResizedCanvas, replaceExtension } from './imageCompress';

const MAX_DIMENSION = 1920;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 300 * 1024; // not worth re-encoding a file this small
const SKIP_MIME_TYPES = new Set(['image/gif', 'image/svg+xml']); // animation / vector — rasterizing would break or add nothing

export async function compressImage(file) {
  if (!file || !file.type.startsWith('image/') || SKIP_MIME_TYPES.has(file.type) || file.size < SKIP_BELOW_BYTES) {
    return file;
  }

  try {
    const canvas = await decodeToResizedCanvas(file, MAX_DIMENSION);
    const ctx = canvas.getContext('2d');
    // JPEG has no alpha channel — flatten any transparent source pixels
    // (e.g. a PNG logo) onto white rather than letting the browser default
    // them to black. 'destination-over' fills behind what's already drawn.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file; // compression didn't help — keep the original

    return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Any failure (unsupported format, canvas error) falls back to the
    // original file — an optimization must never block the actual upload.
    return file;
  }
}
