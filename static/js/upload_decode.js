/*
  Decoding logic for uploaded / cropped images.

  Steps:
  1. Preprocess the image (scale + grayscale + contrast)
  2. Try BarcodeDetector
  3. Try ZXing
  4. Try html5-qrcode
*/

import { CONFIG } from "./config.js";
import { hasNativeBarcodeDetector, buildNativeDetector } from "./scanner_native.js";
import { hasZXing, decodeImageElementZXing } from "./scanner_zxing.js";
import { hasHtml5Qrcode } from "./scanner_html5.js";

function preprocessCanvas(srcCanvas) {
  const scale = CONFIG.uploadScale;

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(srcCanvas.width * scale));
  out.height = Math.max(1, Math.round(srcCanvas.height * scale));

  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(srcCanvas, 0, 0, out.width, out.height);

  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = (0.299*r + 0.587*g + 0.114*b);
    y = (y - 128) * 1.4 + 128;
    y = Math.max(0, Math.min(255, y));
    d[i] = d[i+1] = d[i+2] = y;
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

async function canvasToImage(canvas) {
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  await img.decode();
  return img;
}

export async function decodeFromCroppedCanvas(cropCanvas) {
  const processed = preprocessCanvas(cropCanvas);

  if (hasNativeBarcodeDetector()) {
    try {
      const det = await buildNativeDetector();
      const res = await det.detect(processed);
      if (res && res.length && res[0].rawValue) return res[0].rawValue;
    } catch (_) {}
  }

  if (hasZXing()) {
    try {
      const img = await canvasToImage(processed);
      const text = await decodeImageElementZXing(img);
      if (text) return text;
    } catch (_) {}
  }

  if (hasHtml5Qrcode()) {
    try {
      const blob = await new Promise((resolve) => processed.toBlob(resolve, "image/png"));
      const file = new File([blob], "crop.png", { type: "image/png" });

      const tmp = new Html5Qrcode("reader");
      const decoded = await tmp.scanFile(file, true);
      try { await tmp.clear(); } catch (_) {}
      if (decoded) return decoded;
    } catch (_) {}
  }

  return null;
}