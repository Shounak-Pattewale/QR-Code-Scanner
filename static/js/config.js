export const CONFIG = {
  // Live scanning
  preferNative: true,
  stopAfterFirst: true,

  // Camera constraints (higher res helps 1D barcodes)
  cameraConstraints: {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  },

  // Native detector formats (browser will ignore unsupported)
  nativeFormats: [
    "qr_code", "data_matrix", "pdf417", "aztec",
    "code_128", "code_39", "code_93",
    "ean_13", "ean_8", "itf", "upc_a", "upc_e"
  ],

  // Crop defaults (percentage of canvas)
  cropDefault: { x: 0.1, y: 0.35, w: 0.8, h: 0.3 },

  // Preprocess scaling for uploaded decode
  uploadScale: 2
};