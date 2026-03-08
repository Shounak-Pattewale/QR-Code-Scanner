/**
 * decoders.js
 * -----------
 * Wrappers for the three barcode decoding libraries.
 *
 * Each decoder is tried in order of speed:
 *   1. BarcodeDetector  — native browser API, fastest (GPU-accelerated on Android)
 *   2. ZXing            — pure JS, broad format support, TRY_HARDER mode enabled
 *   3. html5-qrcode     — slowest, last resort, only used on selected variants
 *
 * All decoder functions return the decoded string on success, or null on failure.
 * Errors are caught and logged — a failed decoder never throws to the caller.
 *
 * Dependencies: CanvasUtils (canvas.js), ScannerConfig (config.js)
 */

const Decoders = (() => {

  const { canvasToFile } = CanvasUtils;

  // ── BarcodeDetector (native) ──────────────────────────────────────────────

  // Cached detector instance — built once, reused across all decode calls.
  // Building it is async (getSupportedFormats), so caching avoids repeated
  // overhead on every frame during live scanning.
  let _nativeDetector = null;

  /**
   * Check whether the browser supports the native BarcodeDetector API.
   * Chrome on Android supports it with GPU acceleration.
   * Safari and Firefox do not currently support it.
   *
   * @returns {boolean}
   */
  function hasNativeDetector() {
    return "BarcodeDetector" in window;
  }

  /**
   * Build (or return cached) BarcodeDetector instance.
   * Intersects our desired format list with the browser's supported formats
   * so we never request a format the browser can't handle.
   *
   * @returns {Promise<BarcodeDetector>}
   */
  async function buildNativeDetector() {
    if (_nativeDetector) return _nativeDetector;

    let formats = ScannerConfig.BARCODE_FORMATS;

    if (window.BarcodeDetector.getSupportedFormats) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const filtered  = ScannerConfig.BARCODE_FORMATS.filter(f => supported.includes(f));
      formats = filtered.length ? filtered : supported;
    }

    _nativeDetector = new BarcodeDetector({ formats });
    return _nativeDetector;
  }

  /**
   * Attempt to decode a barcode from a canvas using the native BarcodeDetector.
   * Returns the first result's rawValue if found, otherwise null.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<string|null>}
   */
  async function tryNative(canvas) {
    if (!hasNativeDetector()) return null;

    try {
      const detector = await buildNativeDetector();
      const results  = await detector.detect(canvas);

      if (results && results.length && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch (err) {
      console.debug("[Decoders] BarcodeDetector failed:", err.message);
    }

    return null;
  }

  // ── ZXing ─────────────────────────────────────────────────────────────────

  /**
   * Attempt to decode a barcode from a canvas using ZXing.
   *
   * TRY_HARDER hint is enabled: tells ZXing to spend more effort
   * searching the image. This is worth the CPU cost on mobile because
   * ZXing only runs after BarcodeDetector has already failed.
   *
   * The canvas is converted to an <img> element because ZXing's
   * BrowserMultiFormatReader.decodeFromImageElement requires an HTMLImageElement.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<string|null>}
   */
  async function tryZXing(canvas) {
    if (typeof window.ZXing === "undefined") return null;

    try {
      const img = new Image();
      img.src   = canvas.toDataURL("image/png");
      await img.decode();

      const hints = new Map();
      if (window.ZXing.DecodeHintType) {
        hints.set(window.ZXing.DecodeHintType.TRY_HARDER, true);
      }

      const reader = new window.ZXing.BrowserMultiFormatReader(hints);
      const result = await reader.decodeFromImageElement(img);
      return result.getText();
    } catch (err) {
      // ZXing throws on "not found" — that is normal, not an error
      console.debug("[Decoders] ZXing failed:", err.message);
    }

    return null;
  }

  // ── html5-qrcode ─────────────────────────────────────────────────────────

  /**
   * Attempt to decode a barcode using html5-qrcode.
   *
   * Accepts either a File object (from upload) or a canvas (from a
   * preprocessed variant). Canvases are converted to File via canvasToFile.
   *
   * html5-qrcode requires a hidden <div id="reader"> in the DOM to
   * mount its internal scanner. It is cleared after each use.
   *
   * This decoder is the slowest of the three and is only run on
   * selected variants where it is most likely to add value.
   *
   * @param {File|HTMLCanvasElement} fileOrCanvas
   * @param {HTMLElement} readerDiv  - the hidden #reader container in the DOM
   * @returns {Promise<string|null>}
   */
  async function tryHtml5(fileOrCanvas, readerDiv) {
    if (typeof window.Html5Qrcode === "undefined") return null;

    let scanner = null;

    try {
      const file = fileOrCanvas instanceof File
        ? fileOrCanvas
        : await canvasToFile(fileOrCanvas);

      scanner    = new Html5Qrcode("reader");
      const text = await scanner.scanFile(file, true);
      return text || null;
    } catch (err) {
      console.debug("[Decoders] html5-qrcode failed:", err.message);
      return null;
    } finally {
      // Always clean up — html5-qrcode leaves DOM nodes if not cleared
      if (scanner) {
        try { await scanner.clear(); } catch (_) {}
      }
      if (readerDiv) readerDiv.innerHTML = "";
    }
  }

  // Public API
  return {
    tryNative,
    tryZXing,
    tryHtml5,
  };

})();
