/*
  Native BarcodeDetector scanner.

  This is usually the fastest and lightest option when supported
  by the browser/device.
*/

import { CONFIG } from "./config.js";

export function hasNativeBarcodeDetector() {
  return ("BarcodeDetector" in window);
}

export async function buildNativeDetector() {
  const desiredFormats = CONFIG.nativeFormats;

  if (window.BarcodeDetector.getSupportedFormats) {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = desiredFormats.filter(f => supported.includes(f));
    return new BarcodeDetector({ formats: formats.length ? formats : supported });
  }

  return new BarcodeDetector({ formats: desiredFormats });
}

export async function tryEnableTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;

  const caps = track.getCapabilities?.();
  if (!caps || !caps.torch) return false;

  await track.applyConstraints({ advanced: [{ torch: on }] });
  return true;
}