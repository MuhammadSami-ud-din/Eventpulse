// Shrinks and re-encodes a chosen photo in the browser before upload, so a
// 12-megapixel phone picture becomes a ~100 KB file. The server still checks
// the result (type from its bytes, 1 MB limit); this just makes uploads small.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 1024 * 1024;
const QUALITY_STEPS = [0.86, 0.76, 0.64, 0.5];

// Largest size that fits inside max x max, keeping the shape. Never enlarges.
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// The centred square of a picture, for round avatars.
export function centerSquare(width, height) {
  const size = Math.min(width, height);
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
}

// A message for the user, or null if the file can be processed.
export function checkSourceFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Choose a JPEG, PNG or WebP image';
  if (file.size > MAX_SOURCE_BYTES) return 'That file is over 20 MB. Choose a smaller image.';
  return null;
}

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// Browser only (uses createImageBitmap and <canvas>). WebP where the browser
// can encode it, otherwise JPEG; quality is lowered until it fits in 1 MB.
export async function prepareImage(file, { maxSize, square = false }) {
  const problem = checkSourceFile(file);
  if (problem) throw new Error(problem);

  // "from-image" applies the camera's rotation, so phone photos are upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const crop = square ? centerSquare(bitmap.width, bitmap.height) : { x: 0, y: 0, size: null };
  const sourceWidth = crop.size ?? bitmap.width;
  const sourceHeight = crop.size ?? bitmap.height;
  const target = fitWithin(sourceWidth, sourceHeight, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  const webp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  if (!webp) {
    // JPEG has no transparency; without a fill, transparent areas turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, target.width, target.height);
  }
  context.drawImage(bitmap, crop.x, crop.y, sourceWidth, sourceHeight, 0, 0, target.width, target.height);
  bitmap.close();

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, webp ? 'image/webp' : 'image/jpeg', quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error('This image could not be made small enough. Try a different one.');
}
