// ─── Thermal Logo Raster Conversion ─────────────────────────────────────
// Converts an uploaded logo image into a 1-bit monochrome bitmap and packs
// it as a full ESC/POS raster command (GS v 0: 1D 76 30 m xL xH yL yH d...).
// The resulting base64 is stored in settings.printing.logoBitmap; receipt
// builders splice the bytes verbatim (no image decoder needed at print time).

export interface LogoRasterResult {
  /** Base64 of the complete ESC/POS raster command (GS v 0) — ready to splice. */
  logoBitmap: string;
  logoWidth: number;
  logoHeight: number;
  byteLength: number;
}

/** Allowed upload MIME types (multer filter + magic-byte validation). */
// NOTE: jimp 0.22 decodes png/jpeg/bmp/gif/tiff only — WebP is NOT supported,
// so it must not be advertised here (a WebP would pass validation and then
// fail inside Jimp.read). Keep this list in sync with the UI `accept`.
export const LOGO_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/bmp",
  "image/gif",
]);

/** Max uploaded logo size (2 MB) — plenty for a small thermal logo. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Sniff the magic bytes so a spoofed extension/mimetype cannot smuggle an
 * arbitrary file through the decoder.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "image/bmp";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "image/gif";
  return null;
}

const MIN_LOGO_WIDTH = 8;
const MAX_LOGO_WIDTH = 576;
const MAX_LOGO_HEIGHT = 2048;

/**
 * Convert a raw image buffer into the ESC/POS raster command.
 *
 * @param buffer  decoded image bytes (PNG/JPEG/BMP/GIF/WebP)
 * @param opts.width  desired logo width in dots (rounded down to a multiple
 *                    of 8, clamped to [8, 576])
 * @param opts.threshold  luminance threshold 0-255: pixels darker than this
 *                        print as dots (1), lighter stay white (0)
 */
export async function imageBufferToLogoRaster(
  buffer: Buffer,
  opts: { width: number; threshold: number },
): Promise<LogoRasterResult> {
  const targetWidth = Math.max(MIN_LOGO_WIDTH, Math.min(MAX_LOGO_WIDTH, Math.floor(opts.width / 8) * 8));
  const threshold = Math.max(0, Math.min(255, Math.round(opts.threshold)));

  // jimp is a heavy pure-JS dependency tree; load it lazily so an API boot
  // that never uses the logo does not pay for it (same convention as xlsx).
  const Jimp = (await import("jimp")).default;

  let image: InstanceType<typeof Jimp>;
  try {
    image = await Jimp.read(buffer);
  } catch {
    throw new Error("Unsupported or corrupted image file");
  }

  if (image.getWidth() < 1 || image.getHeight() < 1) {
    throw new Error("Image has no pixels");
  }

  // Preserve aspect ratio; scale height proportionally from the target width.
  const scale = targetWidth / image.getWidth();
  const targetHeight = Math.max(1, Math.round(image.getHeight() * scale));
  if (targetHeight > MAX_LOGO_HEIGHT) {
    throw new Error("Logo too tall after scaling (max 2048 dots)");
  }
  image.resize(targetWidth, targetHeight);

  const { data, width, height } = image.bitmap;
  const widthBytes = Math.ceil(width / 8);
  const raster = Buffer.alloc(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Perceived luminance (Rec. 601), directly from RGBA.
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const visible = data[idx + 3] >= 128; // treat near-transparent as white
      if (visible && lum < threshold) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        raster[byteIdx] |= 0x80 >> (x % 8);
      }
    }
  }

  // GS v 0 m xL xH yL yH d1..dk — m=0 (normal), x = width in bytes, y = height in dots.
  const command = Buffer.alloc(8 + raster.length);
  command[0] = 0x1d;
  command[1] = 0x76;
  command[2] = 0x30;
  command[3] = 0x00;
  command[4] = widthBytes & 0xff;
  command[5] = (widthBytes >> 8) & 0xff;
  command[6] = height & 0xff;
  command[7] = (height >> 8) & 0xff;
  raster.copy(command, 8);

  return {
    logoBitmap: command.toString("base64"),
    logoWidth: width,
    logoHeight: height,
    byteLength: command.length,
  };
}


