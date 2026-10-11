/**
 * Generates the OmniRestaurant brand assets from the sources in `brand-source/`.
 *
 * Inputs (committed, for reproducibility):
 *   brand-source/app-icon.png  → PWA icons + favicon + apple-touch-icon + mark
 *   brand-source/logo.png      → wordmark used in app (WebP + PNG fallback),
 *                                in two variants: dark (light backgrounds) and
 *                                light (dark backgrounds, e.g. the navy header).
 *
 * Icons are emitted into a VERSIONED directory (`public/icons/<ICON_VERSION>/`)
 * so a rebuilt icon is a new URL and already-installed PWAs refetch the bytes
 * instead of serving the stale cached copy. Legacy copies are also kept at
 * `public/icons/` so an install that still points at the old paths keeps a
 * working icon until its service worker + manifest catch up.
 *
 * Run with:  npm run assets:generate --workspace @gustopos/web
 * (see scripts/generate-assets.sh — it bootstraps `sharp`/`png-to-ico` into a
 * throwaway cache dir, so nothing is added to the dependency tree.)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

// Resolve the tooling through Node's CommonJS resolver, which honours
// NODE_PATH (ESM `import` does not), so the throwaway tools dir works without
// touching the dependency tree.
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..');
const sourceDir = join(webRoot, 'brand-source');
const publicDir = join(webRoot, 'public');
const iconsDir = join(publicDir, 'icons');
const brandOutDir = join(webRoot, 'src', 'assets', 'brand');

const APP_ICON = join(sourceDir, 'app-icon.png');
const LOGO = join(sourceDir, 'logo.png');

/** Bump to force installed PWAs to fetch fresh icon bytes (new URLs). */
const ICON_VERSION = 'v2';
const VERSIONED_ICONS_DIR = join(iconsDir, ICON_VERSION);

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Renders `src` into a `size`×`size` PNG with a solid background. The artwork
 * is scaled to fit inside `(1 - 2*padRatio)` of the canvas so maskable icons
 * keep the safe zone and "any" icons get a little breathing room.
 */
async function squarePng(src, size, { padRatio = 0, background = WHITE } = {}) {
  const inner = Math.max(1, Math.round(size * (1 - 2 * padRatio)));
  const content = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: content, gravity: 'center' }])
    .png()
    .toBuffer();
}

/**
 * Dark-background variant of artwork: dark navy is recolored to white while
 * the blue accents are preserved. The navy pixels are far darker than any blue
 * used by the brand, so a luminance threshold separates them cleanly.
 */
async function lightVariant(src, threshold = 70) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += info.channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const alpha = info.channels === 4 ? out[i + 3] : 255;
    if (alpha === 0) continue;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance < threshold) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}

/** Trims the transparent margins off `APP_ICON` and squares it on transparency. */
async function trimmedMarkSquare() {
  const trimmed = await sharp(APP_ICON).trim().png().toBuffer();
  const { width = 1, height = 1 } = await sharp(trimmed).metadata();
  const side = Math.max(width, height);
  return sharp(trimmed)
    .resize(side, side, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
}

/** Writes the full icon set (any + maskable + apple-touch) into `outDir`. */
async function emitIcons(outDir) {
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'icon-192.png'), await squarePng(APP_ICON, 192, { padRatio: 0.05 }));
  await writeFile(join(outDir, 'icon-512.png'), await squarePng(APP_ICON, 512, { padRatio: 0.05 }));
  await writeFile(join(outDir, 'icon-maskable-192.png'), await squarePng(APP_ICON, 192, { padRatio: 0.12 }));
  await writeFile(join(outDir, 'icon-maskable-512.png'), await squarePng(APP_ICON, 512, { padRatio: 0.12 }));
  await writeFile(join(outDir, 'apple-touch-icon.png'), await squarePng(APP_ICON, 180, { padRatio: 0.06 }));
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(brandOutDir, { recursive: true });

  // ── PWA icons / favicon ─────────────────────────────────────────────
  await emitIcons(VERSIONED_ICONS_DIR);
  await emitIcons(iconsDir); // legacy paths kept working for older installs

  const faviconSizes = await Promise.all(
    [16, 32, 48].map((size) => squarePng(APP_ICON, size, { padRatio: 0 })),
  );
  await writeFile(join(publicDir, 'favicon.ico'), await pngToIco(faviconSizes));

  // ── Header mark (icon only, transparent background) ─────────────────
  const markSquare = await trimmedMarkSquare();
  const MARK = 256;
  const markPng = await sharp(markSquare).resize(MARK, MARK, { fit: 'contain', background: TRANSPARENT }).png({ compressionLevel: 9 }).toBuffer();
  const markWebp = await sharp(markSquare).resize(MARK, MARK, { fit: 'contain', background: TRANSPARENT }).webp({ quality: 90 }).toBuffer();
  const markLightSource = await lightVariant(markSquare);
  const markLightPng = await sharp(markLightSource).resize(MARK, MARK, { fit: 'contain', background: TRANSPARENT }).png({ compressionLevel: 9 }).toBuffer();
  const markLightWebp = await sharp(markLightSource).resize(MARK, MARK, { fit: 'contain', background: TRANSPARENT }).webp({ quality: 90 }).toBuffer();

  await writeFile(join(brandOutDir, 'omni-mark.png'), markPng);
  await writeFile(join(brandOutDir, 'omni-mark.webp'), markWebp);
  await writeFile(join(brandOutDir, 'omni-mark-light.png'), markLightPng);
  await writeFile(join(brandOutDir, 'omni-mark-light.webp'), markLightWebp);

  // ── Wordmark (dark-background and light-background variants) ────────
  const LOGO_WIDTH = 900;
  const darkPng = await sharp(LOGO).resize({ width: LOGO_WIDTH }).png({ compressionLevel: 9 }).toBuffer();
  const darkWebp = await sharp(LOGO).resize({ width: LOGO_WIDTH }).webp({ quality: 88 }).toBuffer();

  const lightSource = await lightVariant(LOGO);
  const lightPng = await sharp(lightSource).resize({ width: LOGO_WIDTH }).png({ compressionLevel: 9 }).toBuffer();
  const lightWebp = await sharp(lightSource).resize({ width: LOGO_WIDTH }).webp({ quality: 88 }).toBuffer();

  await writeFile(join(brandOutDir, 'omni-restaurant-logo.png'), darkPng);
  await writeFile(join(brandOutDir, 'omni-restaurant-logo.webp'), darkWebp);
  await writeFile(join(brandOutDir, 'omni-restaurant-logo-light.png'), lightPng);
  await writeFile(join(brandOutDir, 'omni-restaurant-logo-light.webp'), lightWebp);

  console.log('[assets] generated:');
  console.log(`  public/icons/${ICON_VERSION}/{icon,icon-maskable}-{192,512}.png, apple-touch-icon.png`);
  console.log('  public/icons/*.png (legacy paths), public/favicon.ico');
  console.log('  src/assets/brand/omni-mark{,-light}.{png,webp}');
  console.log('  src/assets/brand/omni-restaurant-logo{,-light}.{png,webp}');
}

main().catch((error) => {
  console.error('[assets] generation failed:', error);
  process.exit(1);
});
