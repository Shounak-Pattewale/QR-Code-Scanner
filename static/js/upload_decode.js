/*
  Decoding logic for uploaded / cropped images.

  Steps:
  1. Preprocess the image (scale + grayscale + contrast)
  2. Try BarcodeDetector
  3. Try ZXing
  4. Try html5-qrcode
*/

import { CONFIG } from "./config.js";
import { isNativeDetectorAvailable, createNativeDetector } from "./scanner_native.js";
import { isZXingAvailable, decodeFromImageElement } from "./scanner_zxing.js";
import { isHtml5QrcodeAvailable } from "./scanner_html5.js";

function preprocessCanvas(sourceCanvas) {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.round(sourceCanvas.width * CONFIG.uploadScale);
  outputCanvas.height = Math.round(sourceCanvas.height * CONFIG.uploadScale);

  const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(sourceCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Convert to grayscale
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Boost contrast slightly
    gray = (gray - 128) * 1.4 + 128;
    gray = Math.max(0, Math.min(255, gray));

    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return outputCanvas;
}

async function canvasToImage(canvas) {
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await image.decode();
  return image;
}

export async function decodeUploadedCanvas(croppedCanvas) {
  const processedCanvas = preprocessCanvas(croppedCanvas);

  // 1. Native BarcodeDetector
  if (isNativeDetectorAvailable()) {
    try {
      const detector = await createNativeDetector();
      const results = await detector.detect(processedCanvas);

      if (results && results.length && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch (error) {
      // ignore and continue fallback chain
    }
  }

  // 2. ZXing
  if (isZXingAvailable()) {
    try {
      const image = await canvasToImage(processedCanvas);
      const decodedText = await decodeFromImageElement(image);

      if (decodedText) {
        return decodedText;
      }
    } catch (error) {
      // ignore and continue fallback chain
    }
  }

  // 3. html5-qrcode
  if (isHtml5QrcodeAvailable()) {
    try {
      const blob = await new Promise((resolve) => {
        processedCanvas.toBlob(resolve, "image/png");
      });

      const file = new File([blob], "cropped-code.png", { type: "image/png" });

      const scanner = new Html5Qrcode("reader");
      const decodedText = await scanner.scanFile(file, true);

      try {
        await scanner.clear();
      } catch (error) {
        // ignore
      }

      if (decodedText) {
        return decodedText;
      }
    } catch (error) {
      // ignore
    }
  }

  return null;
}