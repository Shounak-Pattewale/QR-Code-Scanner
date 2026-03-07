/*
  Central configuration file.

  Keep all tuneable values here so you do not have to search through
  all JS files later.
*/

export const CONFIG = {
  // We prefer the browser's native BarcodeDetector first because it is
  // fast and often works very well on Android devices.
  preferNative: true,

  // Stop scanner after first successful scan.
  // Good for this app because user scans one package and then sees details.
  stopAfterFirstSuccess: true,

  // Camera constraints: higher resolution improves long 1D barcode reading.
  cameraConstraints: {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  },

  // Barcode formats we want the browser to try if supported.
  nativeFormats: [
    "qr_code",
    "data_matrix",
    "code_128",
    "ean_13",
    "ean_8",
    "itf",
    "upc_a",
    "upc_e",
    "pdf417",
    "aztec"
  ],

  // Default crop rectangle used when user uploads an image.
  defaultCrop: {
    x: 0.10,
    y: 0.35,
    w: 0.80,
    h: 0.25
  },

  // Preprocessing scale for uploaded images.
  // Enlarging helps barcode decoders read thin bars.
  uploadScale: 2
};