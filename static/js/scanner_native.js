/*
  Native BarcodeDetector scanner.

  This is usually the fastest and lightest option when supported
  by the browser/device.
*/

import { CONFIG } from "./config.js";

export function isNativeDetectorAvailable() {
  return "BarcodeDetector" in window;
}

export async function createNativeDetector() {
  // Some browsers expose supported formats.
  if (window.BarcodeDetector.getSupportedFormats) {
    const supportedFormats = await window.BarcodeDetector.getSupportedFormats();

    const wantedFormats = CONFIG.nativeFormats.filter(format =>
      supportedFormats.includes(format)
    );

    return new BarcodeDetector({
      formats: wantedFormats.length ? wantedFormats : supportedFormats
    });
  }

  // Fallback if browser does not expose supported formats.
  return new BarcodeDetector({
    formats: CONFIG.nativeFormats
  });
}

export async function toggleTorch(stream, enabled) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;

  const capabilities = track.getCapabilities?.();
  if (!capabilities || !capabilities.torch) return false;

  await track.applyConstraints({
    advanced: [{ torch: enabled }]
  });

  return true;
}