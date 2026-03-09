/**
 * upload.js
 * ---------
 * Handles image file selection and runs the full decode pipeline on it.
 *
 * Flow:
 *   1. User selects a file via the gallery/camera file input
 *   2. File is loaded into an HTMLImageElement
 *   3. Image is downscaled to UPLOAD_MAX_DIM for mobile stability
 *   4. Full 10-variant preprocessing pipeline is built
 *   5. Pipeline runs decoders until a code is found
 *   6. Result is reported back via the onResult callback
 *
 * Dependencies:
 *   ScannerConfig (config.js)
 *   CanvasUtils   (canvas.js)
 *   Preprocessor  (preprocessor.js)
 *   Pipeline        (pipeline.js)
 *   BackendDecoder  (backend.js)
 *   UI              (ui.js)
 */

const Upload = (() => {

  let _onResult  = null;   // callback({code, variant} | null)
  let _readerDiv = null;

  /**
   * Register the callback to be called when decoding completes.
   * Called with { code, variant } on success, or null on failure.
   * Must be called before any file is processed.
   *
   * @param {function({code: string, variant: string}|null): void} fn
   */
  function onResult(fn) {
    _onResult  = fn;
    _readerDiv = UI.getElement("readerDiv");
  }

  /**
   * Process a selected image file:
   *   load → downscale → build variants → run pipeline → report result.
   *
   * Updates UI status messages throughout.
   * Always resets the file inputs on completion so the same file
   * can be re-selected if needed.
   *
   * @param {File} file
   * @returns {Promise<void>}
   */
  async function handleFile(file) {
    if (!file) return;

    try {
      UI.setStatus("Loading image...");
      UI.setCode("");

      // Load file into an image element
      const img = await CanvasUtils.fileToImage(file);

      // Show the preview immediately so the user sees feedback
      UI.showPreview(img.src);

      // Downscale for mobile stability — very large phone photos can
      // freeze the browser if processed at full resolution
      const baseCanvas = CanvasUtils.imageToCanvas(img, ScannerConfig.UPLOAD_MAX_DIM);

      UI.setStatus("Decoding image...");

      // Build full 10-variant pipeline.
      // runWithFallback tries all browser decoders first, then
      // automatically calls the backend if all browser passes fail.
      const variants = Preprocessor.buildUploadVariants(baseCanvas);
      const result   = await Pipeline.runWithFallback(variants, _readerDiv, file);

      if (_onResult) _onResult(result);
    } catch (err) {
      console.error("[Upload] handleFile failed:", err);
      UI.setStatus("Image processing failed. Please try again.");
    } finally {
      UI.resetFileInputs();
    }
  }

  /**
   * Advanced decode — skip browser decoders entirely and send the
   * file directly to the backend Python decoder.
   *
   * Used when the operator presses "Advanced Scan" on a label that
   * they know the browser won't be able to read (e.g. GS1 DataMatrix).
   *
   * @param {File} file
   * @returns {Promise<void>}
   */
  async function handleFileAdvanced(file) {
    if (!file) return;

    try {
      UI.setStatus("Sending to backend decoder...");
      UI.setCode("");

      const img = await CanvasUtils.fileToImage(file);
      UI.showPreview(img.src);

      if (!ScannerConfig.DECODER_API_URL) {
        UI.setStatus("Backend decoder is not configured.");
        return;
      }

      const backendResult = await BackendDecoder.decode(file);

      if (backendResult && backendResult.found) {
        if (_onResult) _onResult({
          code:    backendResult.code,
          variant: backendResult.variant,
          source:  "backend",
        });
      } else {
        if (_onResult) _onResult(null);
      }
    } catch (err) {
      console.error("[Upload] handleFileAdvanced failed:", err);
      UI.setStatus("Advanced decode failed. Please try again.");
    } finally {
      UI.resetFileInputs();
    }
  }

  // Public API
  return {
    onResult,
    handleFile,
    handleFileAdvanced,
  };

})();
