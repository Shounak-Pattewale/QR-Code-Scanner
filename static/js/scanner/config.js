/**
 * config.js
 * ---------
 * Central configuration for the scanner app.
 * All tuneable values live here — no magic numbers scattered through the code.
 *
 * To adjust scan speed, image quality, or decoder behaviour,
 * change values here only.
 */

const ScannerConfig = {

  // ── Live camera ──────────────────────────────────────────────────────────

  /**
   * How many milliseconds to wait between frame capture attempts
   * during live camera scanning.
   * Lower = faster detection but higher CPU usage on mobile.
   * Recommended range: 400–800ms.
   */
  SCAN_INTERVAL_MS: 600,

  /**
   * Maximum pixel dimension (width or height) when downscaling a live
   * camera frame before decoding. Keeps the page responsive on mobile.
   * Higher = better decode accuracy but slower processing.
   */
  LIVE_FRAME_MAX_DIM: 1000,

  /**
   * Preferred rear camera constraints passed to getUserMedia.
   * facingMode "environment" selects the rear camera on phones.
   */
  CAMERA_CONSTRAINTS: {
    video: {
      facingMode: { ideal: "environment" },
      width:      { ideal: 1280 },
      height:     { ideal: 720  },
    },
  },

  /**
   * Milliseconds to wait after video.play() before starting the scan loop.
   * Prevents trying to decode a black or partially-loaded first frame.
   */
  CAMERA_WARMUP_MS: 400,

  // ── Upload / image decoding ───────────────────────────────────────────────

  /**
   * Maximum pixel dimension when downscaling an uploaded image.
   * Larger uploaded photos are scaled down to this before decoding,
   * which prevents the page from freezing on high-resolution phone photos.
   */
  UPLOAD_MAX_DIM: 1600,

  // ── Barcode formats ───────────────────────────────────────────────────────

  /**
   * Barcode formats requested from the native BarcodeDetector API.
   * Only formats that are also reported as supported by the browser will
   * actually be used (see decoders.js — buildNativeDetector).
   *
   * Covers all formats required by the client:
   *   Code128, GS1-128, GS1 DataMatrix, Data Matrix,
   *   QR Code, EAN-13, EAN-8, UPC
   */
  BARCODE_FORMATS: [
    "qr_code",
    "data_matrix",
    "code_128",
    "ean_13",
    "ean_8",
    "itf",
    "upc_a",
    "upc_e",
    "pdf417",
    "aztec",
  ],

};
