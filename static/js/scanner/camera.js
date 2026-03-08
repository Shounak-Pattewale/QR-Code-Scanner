/**
 * camera.js
 * ---------
 * Live camera lifecycle management and continuous scan loop.
 *
 * Responsibilities:
 *   - Request camera permission and open the stream
 *   - Display the stream in the <video> element
 *   - Run a self-rescheduling scan loop that captures frames
 *     and passes them through the decode pipeline
 *   - Lock scanning when a code is found and notify the app
 *   - Stop the stream cleanly (tracks released, DOM cleared)
 *   - Stop automatically when the browser tab is hidden
 *
 * Scan loop design:
 *   Uses setTimeout self-rescheduling instead of setInterval.
 *   This ensures the next tick only starts AFTER the current
 *   decode job finishes, preventing overlapping async jobs from
 *   queuing up and freezing the UI on slow mobile devices.
 *
 * Dependencies:
 *   ScannerConfig (config.js)
 *   CanvasUtils   (canvas.js)
 *   Preprocessor  (preprocessor.js)
 *   Pipeline      (pipeline.js)
 *   UI            (ui.js)
 */

const Camera = (() => {

  // ── Private state ─────────────────────────────────────────────────────────

  let _stream     = null;   // MediaStream — held so tracks can be stopped
  let _scanTimer  = null;   // setTimeout handle for the scan loop
  let _scanActive = false;  // true while the scan loop is running
  let _onDetected = null;   // callback(code, variantName) set by scanner.js

  // Convenience references set once at start()
  let _video    = null;
  let _readerDiv = null;

  // ── Public interface ──────────────────────────────────────────────────────

  /**
   * Register the callback to be called when a barcode is detected.
   * Must be called before start().
   *
   * @param {function(code: string, variant: string): void} fn
   */
  function onDetected(fn) {
    _onDetected = fn;
  }

  /**
   * Request the rear camera, start the video stream, and begin scanning.
   * Clears any existing image preview and shows the camera section.
   *
   * @returns {Promise<void>}
   */
  async function start() {
    try {
      UI.setStatus("Requesting camera access...");

      _video     = UI.getElement("cameraVideo");
      _readerDiv = UI.getElement("readerDiv");

      _stream = await navigator.mediaDevices.getUserMedia(
        ScannerConfig.CAMERA_CONSTRAINTS
      );

      _video.srcObject = _stream;
      await _video.play();

      // Clear stale upload preview before showing camera
      UI.clearPreview();
      UI.showCameraSection();

      // Brief warmup delay — prevents decoding a black/partial first frame
      await _sleep(ScannerConfig.CAMERA_WARMUP_MS);

      _startScanLoop();
      UI.setStatus("Camera active — point at barcode.");
    } catch (err) {
      console.error("[Camera] Failed to start:", err);
      UI.setStatus("Camera access denied or not available. Use upload instead.");
    }
  }

  /**
   * Stop the camera stream and clean up.
   * Safe to call even if the camera is not currently running.
   */
  function stop() {
    _stopScanLoop();

    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }

    if (_video) {
      _video.srcObject = null;
      _video = null;
    }

    _scanActive = false;

    UI.hideCameraSection();
    UI.setStatus("Camera stopped.");
  }

  /**
   * Returns true if the camera stream is currently open.
   *
   * @returns {boolean}
   */
  function isActive() {
    return _stream !== null;
  }

  // ── Scan loop ─────────────────────────────────────────────────────────────

  /**
   * Start the self-rescheduling scan loop.
   * Each tick captures one frame, runs it through the pipeline,
   * and reschedules itself only after the async decode completes.
   * This prevents overlapping decode jobs.
   */
  function _startScanLoop() {
    if (_scanActive) return;
    _scanActive = true;

    async function tick() {
      // Bail out if stopped externally between ticks
      if (!_scanActive) return;

      const frame = CanvasUtils.videoToCanvas(_video, ScannerConfig.LIVE_FRAME_MAX_DIM);

      if (frame) {
        const variants = Preprocessor.buildLiveVariants(frame);
        const result   = await Pipeline.run(variants, _readerDiv);

        if (result) {
          // Code found — stop scanning and notify the app
          _stopScanLoop();
          if (_onDetected) _onDetected(result.code, result.variant);
          return; // do not reschedule
        }
      }

      // Nothing found — reschedule only if still active
      if (_scanActive) {
        _scanTimer = setTimeout(tick, ScannerConfig.SCAN_INTERVAL_MS);
      }
    }

    _scanTimer = setTimeout(tick, ScannerConfig.SCAN_INTERVAL_MS);
  }

  /**
   * Stop the scan loop without stopping the camera stream.
   * Called internally when a code is detected, or as part of stop().
   */
  function _stopScanLoop() {
    if (_scanTimer) {
      clearTimeout(_scanTimer);
      _scanTimer = null;
    }
    _scanActive = false;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stop camera automatically when the tab is hidden (battery + privacy)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && isActive()) {
      stop();
    }
  });

  // Public API
  return {
    onDetected,
    start,
    stop,
    isActive,
  };

})();
