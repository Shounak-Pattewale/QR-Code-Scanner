import { CONFIG } from "./config.js";

export function hasNativeBarcodeDetector() {
  return ("BarcodeDetector" in window);
}

export async function buildNativeDetector() {
  const desired = CONFIG.nativeFormats;

  if (window.BarcodeDetector.getSupportedFormats) {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = desired.filter(f => supported.includes(f));
    return new BarcodeDetector({ formats: formats.length ? formats : supported });
  }
  return new BarcodeDetector({ formats: desired });
}

export async function tryEnableTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;

  const caps = track.getCapabilities?.();
  if (!caps || !caps.torch) return false;

  await track.applyConstraints({ advanced: [{ torch: on }] });
  return true;
}