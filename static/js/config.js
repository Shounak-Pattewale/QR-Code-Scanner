/*
  Central configuration file.

  Keep all tuneable values here so you do not have to search through
  all JS files later.
*/

export const CONFIG = {
  preferNative: true,
  stopAfterFirst: true,

  cameraConstraints: {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  },

  nativeFormats: [
    "qr_code", "data_matrix", "aztec", "pdf417",
    "code_128", "code_39", "code_93",
    "ean_13", "ean_8", "itf", "upc_a", "upc_e"
  ],

  cropDefault: { x: 0.1, y: 0.35, w: 0.8, h: 0.3 },
  uploadScale: 2
};