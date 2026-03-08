/**
 * scanner.js
 * ----------
 * Entry point for the barcode scanner app.
 *
 * This module's only job is to wire the other modules together:
 *   - Attach event listeners to UI elements
 *   - Register callbacks between modules
 *   - Handle results from Camera and Upload
 *   - Set the initial UI state
 *
 * No image processing, no DOM queries, no decode logic lives here.
 * If you need to understand how something works, find the relevant module:
 *
 *   config.js       — all tuneable constants
 *   canvas.js       — canvas/image utilities
 *   preprocessor.js — image variant transforms
 *   decoders.js     — BarcodeDetector, ZXing, html5-qrcode wrappers
 *   pipeline.js     — runs decoders across variants
 *   camera.js       — live camera stream and scan loop
 *   upload.js       — file selection and decode
 *   ui.js           — all DOM reads and writes
 *
 * Load order in HTML (each module depends on the ones above it):
 *   config.js → canvas.js → preprocessor.js → decoders.js →
 *   pipeline.js → ui.js → camera.js → upload.js → scanner.js
 */

(function () {

  // ── Wire: Camera ──────────────────────────────────────────────────────────

  // Called by Camera when a barcode is detected in a live frame
  Camera.onDetected(function (code, variant) {
    console.info(`[Scanner] Live scan success — variant: ${variant}`);

    // Stop the camera stream — user must press "Scan Code" to scan again
    Camera.stop();

    UI.setCode(code);
    UI.setStatus('Code detected. Press "Scan Code" to scan another.');
    UI.flashViewfinderSuccess();
  });

  // ── Wire: Upload ──────────────────────────────────────────────────────────

  // Called by Upload when file decoding completes (success or failure)
  Upload.onResult(function (result) {
    if (result) {
      console.info(`[Scanner] Upload scan success — variant: ${result.variant}`);
      UI.setCode(result.code);
      UI.setStatus(`Code detected from image (${result.variant}).`);
    } else {
      UI.setStatus("Could not detect a code. Try a clearer photo or enter the code manually.");
    }
  });

  // ── Event listeners ───────────────────────────────────────────────────────

  // Camera controls
  UI.getElement("btnStartCamera").addEventListener("click", () => Camera.start());
  UI.getElement("btnStopCamera").addEventListener("click",  () => Camera.stop());

  // File upload — triggers gallery/camera picker
  UI.getElement("btnChooseImage").addEventListener("click", () => {
    UI.getElement("galleryInput").click();
  });

  // File input change events
  UI.getElement("galleryInput").addEventListener("change", function () {
    Upload.handleFile(this.files?.[0]);
  });

  UI.getElement("cameraInput").addEventListener("change", function () {
    Upload.handleFile(this.files?.[0]);
  });

  // Manual code entry
  UI.getElement("btnUseManual").addEventListener("click", function () {
    const value = UI.getElement("manualInput").value.trim();
    if (!value) return;
    UI.setCode(value);
    UI.setStatus("Manual code set.");
  });

  UI.getElement("manualInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") UI.getElement("btnUseManual").click();
  });

  // Copy button
  UI.getElement("btnCopy").addEventListener("click", async function () {
    const code = UI.getCode();
    if (!code) return;
    await UI.copyToClipboard(code);
    UI.showCopyToast();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  UI.setStatus("Ready.");

})();
