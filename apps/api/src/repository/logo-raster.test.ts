import test from "node:test";
import assert from "node:assert/strict";
import Jimp from "jimp";
import {
  imageBufferToLogoRaster,
  sniffImageType,
} from "./utils/logo-raster";
import { isValidLogoRaster } from "./utils/escpos-builder";

/** Build a solid-color PNG buffer via jimp (avoids hand-crafting PNG bytes). */
async function solidPng(width: number, height: number, color: number): Promise<Buffer> {
  const img = new Jimp(width, height, color);
  return img.getBufferAsync(Jimp.MIME_PNG);
}

test("sniffImageType detects PNG magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  assert.equal(sniffImageType(png), "image/png");
});

test("sniffImageType detects JPEG magic bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(sniffImageType(jpeg), "image/jpeg");
});

test("sniffImageType detects BMP magic bytes", () => {
  const bmp = Buffer.from([0x42, 0x4d, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(sniffImageType(bmp), "image/bmp");
});

test("sniffImageType detects GIF magic bytes", () => {
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(sniffImageType(gif), "image/gif");
});

test("sniffImageType does not accept WebP (jimp 0.22 cannot decode it)", () => {
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffImageType(webp), null);
});

test("sniffImageType rejects unknown magic bytes", () => {
  assert.equal(sniffImageType(Buffer.from("not an image at all, just text")), null);
  assert.equal(sniffImageType(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
});

test("solid black image produces a GS v 0 raster command with matching dimensions", async () => {
  const png = await solidPng(384, 128, 0x000000ff);
  const result = await imageBufferToLogoRaster(png, { width: 384, threshold: 160 });

  assert.equal(result.logoWidth, 384);
  assert.equal(result.logoHeight, 128);
  assert.ok(result.byteLength > 0);

  const bytes = Buffer.from(result.logoBitmap, "base64");
  // GS v 0 header: 1D 76 30 00 xL xH yL yH
  assert.deepEqual([...bytes.slice(0, 4)], [0x1d, 0x76, 0x30, 0x00]);
  const widthBytes = (bytes[4] | (bytes[5] << 8)) & 0xffff;
  const height = (bytes[6] | (bytes[7] << 8)) & 0xffff;
  assert.equal(widthBytes, 384 / 8);
  assert.equal(height, 128);
  assert.equal(bytes.length, 8 + widthBytes * height);
  // Solid black: every bit set in the raster data.
  assert.ok(bytes.slice(8).every((b) => b === 0xff), "solid black image should print all dots");
});

test("solid white image produces an empty raster (no dots)", async () => {
  const png = await solidPng(384, 64, 0xffffffff);
  const result = await imageBufferToLogoRaster(png, { width: 384, threshold: 160 });
  const bytes = Buffer.from(result.logoBitmap, "base64");
  assert.ok(bytes.slice(8).every((b) => b === 0x00), "solid white image should print no dots");
});

test("width is rounded down to a multiple of 8", async () => {
  const png = await solidPng(200, 100, 0x000000ff);
  const result = await imageBufferToLogoRaster(png, { width: 385, threshold: 160 });
  // 385 -> 384 (multiple of 8).
  assert.equal(result.logoWidth, 384);
});

test("width is clamped to the valid range", async () => {
  const png = await solidPng(100, 100, 0x000000ff);
  const tiny = await imageBufferToLogoRaster(png, { width: 2, threshold: 160 });
  assert.equal(tiny.logoWidth, 8);
  const huge = await imageBufferToLogoRaster(png, { width: 5000, threshold: 160 });
  assert.equal(huge.logoWidth, 576);
});

test("rejects non-image buffer", async () => {
  await assert.rejects(
    () => imageBufferToLogoRaster(Buffer.from("definitely not an image"), { width: 384, threshold: 160 }),
    /Unsupported or corrupted image/,
  );
});

test("isValidLogoRaster accepts a valid GS v 0 payload and rejects garbage", async () => {
  const png = await solidPng(16, 16, 0x000000ff);
  const { logoBitmap } = await imageBufferToLogoRaster(png, { width: 16, threshold: 160 });
  assert.equal(isValidLogoRaster(logoBitmap), true);
  assert.equal(isValidLogoRaster("not base64 !!!"), false);
  assert.equal(isValidLogoRaster(""), false);
  assert.equal(isValidLogoRaster(undefined), false);
  // Valid base64 but wrong content (not a GS v 0 command).
  assert.equal(isValidLogoRaster(Buffer.from("hello world").toString("base64")), false);
});

test("aspect ratio is preserved when scaling to the target width", async () => {
  const png = await solidPng(200, 100, 0x000000ff);
  const result = await imageBufferToLogoRaster(png, { width: 384, threshold: 160 });
  assert.equal(result.logoWidth, 384);
  assert.equal(result.logoHeight, 192); // 100/200 * 384
});
