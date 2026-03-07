/*
  Upload / cropped image decoding pipeline.

  Purpose:
  - Improve decoding reliability for uploaded photos and cropped label regions
  - Try multiple preprocessing passes before giving up

  Decoder order for each image variant:
  1. Native BarcodeDetector
  2. ZXing
  3. html5-qrcode

  Image variants tried:
  - original
  - grayscale
  - high contrast grayscale
  - binary threshold
  - rotated 90 / 180 / 270
*/

import { CONFIG } from "./config.js";
import { hasNativeBarcodeDetector, buildNativeDetector } from "./scanner_native.js";
import { hasZXing, decodeImageElementZXing } from "./scanner_zxing.js";
import { hasHtml5Qrcode } from "./scanner_html5.js";


/* =========================================================
   1) BASIC CANVAS HELPERS
   ========================================================= */

/**
 * Create a new canvas of a given size.
 */
function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * Convert a canvas into an Image element.
 * Needed for ZXing decode.
 */
async function canvasToImage(canvas) {
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  await img.decode();
  return img;
}

/**
 * Convert a canvas into a Blob.
 * Needed for html5-qrcode scanFile fallback.
 */
async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas toBlob failed"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Scale up the cropped image.
 * Enlarging helps thin 1D bars become easier to read.
 */
function upscaleCanvas(sourceCanvas, scale = CONFIG.uploadScale) {
  const out = createCanvas(sourceCanvas.width * scale, sourceCanvas.height * scale);
  const ctx = out.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0, out.width, out.height);
  return out;
}


/* =========================================================
   2) IMAGE PROCESSING PASSES
   ========================================================= */

/**
 * Create a grayscale version of the image.
 */
function toGrayscaleCanvas(sourceCanvas) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = out.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/**
 * Create a higher-contrast grayscale image.
 * Useful for faded labels and weak prints.
 */
function toHighContrastCanvas(sourceCanvas, contrastFactor = 1.6) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = out.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Increase contrast around mid-point 128
    gray = (gray - 128) * contrastFactor + 128;
    gray = Math.max(0, Math.min(255, gray));

    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/**
 * Create a black/white thresholded image.
 * Useful when there is enough contrast but the label is noisy.
 */
function toThresholdCanvas(sourceCanvas, threshold = 140) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = out.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const bw = gray >= threshold ? 255 : 0;

    pixels[i] = bw;
    pixels[i + 1] = bw;
    pixels[i + 2] = bw;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/**
 * Rotate a canvas by 90 / 180 / 270 degrees.
 * Helpful when uploaded images are sideways.
 */
function rotateCanvas(sourceCanvas, angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;

  const swapSides = angleDegrees === 90 || angleDegrees === 270;
  const out = createCanvas(
    swapSides ? sourceCanvas.height : sourceCanvas.width,
    swapSides ? sourceCanvas.width : sourceCanvas.height
  );

  const ctx = out.getContext("2d", { willReadFrequently: true });

  ctx.save();

  if (angleDegrees === 90) {
    ctx.translate(out.width, 0);
  } else if (angleDegrees === 180) {
    ctx.translate(out.width, out.height);
  } else if (angleDegrees === 270) {
    ctx.translate(0, out.height);
  }

  ctx.rotate(radians);
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return out;
}


/* =========================================================
   3) DECODER ATTEMPTS
   ========================================================= */

/**
 * Try native BarcodeDetector on a canvas.
 */
async function tryNativeDecode(canvas) {
  if (!hasNativeBarcodeDetector()) return null;

  try {
    const detector = await buildNativeDetector();
    const results = await detector.detect(canvas);

    if (results && results.length && results[0].rawValue) {
      return results[0].rawValue;
    }
  } catch (error) {
    console.log("Native detector failed:", error);
  }

  return null;
}

/**
 * Try ZXing on a canvas by first converting the canvas to an image element.
 */
async function tryZXingDecode(canvas) {
  if (!hasZXing()) return null;

  try {
    const img = await canvasToImage(canvas);
    const text = await decodeImageElementZXing(img);

    if (text) {
      return text;
    }
  } catch (error) {
    console.log("ZXing failed:", error);
  }

  return null;
}

/**
 * Try html5-qrcode on a canvas by converting the canvas to a File.
 */
async function tryHtml5Decode(canvas) {
  if (!hasHtml5Qrcode()) return null;

  let scanner = null;

  try {
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], "cropped-code.png", { type: "image/png" });

    scanner = new Html5Qrcode("reader");
    const text = await scanner.scanFile(file, true);

    if (text) {
      return text;
    }
  } catch (error) {
    console.log("html5-qrcode failed:", error);
  } finally {
    if (scanner) {
      try {
        await scanner.clear();
      } catch (_) {
        // ignore cleanup failures
      }
    }
  }

  return null;
}

/**
 * For one image variant, try all decoders in priority order.
 */
async function tryAllDecoders(canvas, variantName = "unknown") {
  console.log(`Trying variant: ${variantName}`);

  let text = await tryNativeDecode(canvas);
  if (text) {
    console.log(`Decoded with native detector using variant: ${variantName}`);
    return text;
  }

  text = await tryZXingDecode(canvas);
  if (text) {
    console.log(`Decoded with ZXing using variant: ${variantName}`);
    return text;
  }

  text = await tryHtml5Decode(canvas);
  if (text) {
    console.log(`Decoded with html5-qrcode using variant: ${variantName}`);
    return text;
  }

  return null;
}


/* =========================================================
   4) VARIANT PIPELINE
   ========================================================= */

/**
 * Build all image variants we want to try.
 * We keep the order intentional:
 * - easy / cheap attempts first
 * - heavier / rotated attempts later
 */
function buildVariants(cropCanvas) {
  const variants = [];

  // Always start from an enlarged version to help thin bars
  const base = upscaleCanvas(cropCanvas);

  variants.push({ name: "original_upscaled", canvas: base });

  const gray = toGrayscaleCanvas(base);
  variants.push({ name: "grayscale", canvas: gray });

  const contrast = toHighContrastCanvas(base);
  variants.push({ name: "high_contrast", canvas: contrast });

  const threshold = toThresholdCanvas(contrast);
  variants.push({ name: "threshold_black_white", canvas: threshold });

  // Rotated versions
  variants.push({ name: "rotated_90", canvas: rotateCanvas(base, 90) });
  variants.push({ name: "rotated_180", canvas: rotateCanvas(base, 180) });
  variants.push({ name: "rotated_270", canvas: rotateCanvas(base, 270) });

  // Also try rotated thresholded version because some cameras save sideways images
  variants.push({ name: "threshold_rotated_90", canvas: rotateCanvas(threshold, 90) });
  variants.push({ name: "threshold_rotated_180", canvas: rotateCanvas(threshold, 180) });
  variants.push({ name: "threshold_rotated_270", canvas: rotateCanvas(threshold, 270) });

  return variants;
}


/* =========================================================
   5) PUBLIC FUNCTION
   ========================================================= */

/**
 * Main exported function used by app.js
 * Takes the cropped canvas and tries all image-processing passes.
 */
export async function decodeFromCroppedCanvas(cropCanvas) {
  const variants = buildVariants(cropCanvas);

  for (const variant of variants) {
    const decodedText = await tryAllDecoders(variant.canvas, variant.name);

    if (decodedText) {
      return decodedText;
    }
  }

  return null;
}