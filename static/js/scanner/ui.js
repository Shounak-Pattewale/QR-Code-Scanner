/**
 * ui.js
 * -----
 * All DOM interaction for the scanner page.
 *
 * This module owns every read and write to the DOM.
 * No other module touches the DOM directly — they call UI methods instead.
 * This makes the rest of the codebase testable and keeps concerns separated.
 *
 * Sections:
 *   - Element references (queried once at init)
 *   - Status / feedback
 *   - Code display
 *   - Image preview
 *   - Camera section visibility
 *   - Button state
 *   - File input helpers
 */

const UI = (() => {

  // ── Element references ────────────────────────────────────────────────────
  // Queried once. If an element is missing the app will log a clear error
  // rather than silently failing later.

  function el(id) {
    const element = document.getElementById(id);
    if (!element) console.error(`[UI] Element not found: #${id}`);
    return element;
  }

  const elements = {
    // Inputs
    galleryInput:   el("galleryInput"),
    cameraInput:    el("cameraInput"),
    manualInput:    el("manualInput"),

    // Buttons
    btnChooseImage: el("btnChooseImage"),
    btnUseManual:   el("btnUseManual"),
    btnCopy:        el("btnCopy"),
    btnStartCamera: el("btnStartCamera"),
    btnStopCamera:  el("btnStopCamera"),

    // Output
    codeDisplay:    el("codeDisplay"),
    statusMessage:  el("statusMessage"),
    copyToast:      el("copyToast"),
    previewImage:   el("previewImage"),

    // Camera section
    cameraSection:  el("cameraSection"),
    cameraVideo:    el("cameraVideo"),

    // html5-qrcode hidden mount point
    readerDiv:      el("reader"),
  };

  // ── Status message ────────────────────────────────────────────────────────

  /**
   * Set the status message shown below the code display.
   * Pass an empty string or null to clear it.
   *
   * @param {string} text
   */
  function setStatus(text) {
    elements.statusMessage.textContent = text || "";
  }

  // ── Code display ──────────────────────────────────────────────────────────

  /**
   * Show a detected/manual code in the output field.
   * Enables the Copy button if a non-empty value is set.
   *
   * @param {string} text
   */
  function setCode(text) {
    const value = (text || "").trim();
    elements.codeDisplay.value = value;
    elements.btnCopy.disabled  = !value;
  }

  /**
   * Return the current value in the code display field.
   *
   * @returns {string}
   */
  function getCode() {
    return elements.codeDisplay.value.trim();
  }

  /**
   * Show the "Copied!" toast briefly.
   */
  function showCopyToast() {
    elements.copyToast.classList.remove("d-none");
    setTimeout(() => elements.copyToast.classList.add("d-none"), 900);
  }

  /**
   * Copy text to the clipboard.
   * Falls back to execCommand for older mobile browsers.
   *
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // execCommand fallback for browsers without Clipboard API
      elements.codeDisplay.removeAttribute("readonly");
      elements.codeDisplay.select();
      document.execCommand("copy");
      elements.codeDisplay.setAttribute("readonly", "readonly");
    }
  }

  // ── Image preview ─────────────────────────────────────────────────────────

  /**
   * Show an uploaded image preview.
   *
   * @param {string} src  - object URL from URL.createObjectURL()
   */
  function showPreview(src) {
    elements.previewImage.src          = src;
    elements.previewImage.style.display = "block";
  }

  /**
   * Hide and clear the image preview.
   * Called when live camera starts so old upload previews don't linger.
   */
  function clearPreview() {
    elements.previewImage.src          = "";
    elements.previewImage.style.display = "none";
  }

  // ── Camera section ────────────────────────────────────────────────────────

  /**
   * Show the camera video section and switch button states to
   * reflect that the camera is active.
   */
  function showCameraSection() {
    elements.cameraSection.style.display  = "block";
    elements.btnStartCamera.style.display = "none";
    elements.btnStopCamera.style.display  = "inline-block";
  }

  /**
   * Hide the camera video section and reset button states.
   */
  function hideCameraSection() {
    elements.cameraSection.style.display  = "none";
    elements.btnStartCamera.style.display = "inline-block";
    elements.btnStopCamera.style.display  = "none";
  }

  /**
   * Briefly flash the viewfinder overlay green to give visual
   * feedback when a code is successfully detected.
   */
  function flashViewfinderSuccess() {
    const overlay = el("viewfinderOverlay");
    if (!overlay) return;
    overlay.classList.add("detected");
    setTimeout(() => overlay.classList.remove("detected"), 700);
  }

  // ── File input helpers ────────────────────────────────────────────────────

  /**
   * Reset file inputs so the same file can be re-selected.
   * Without this, onChange does not fire if the user picks the
   * same file twice.
   */
  function resetFileInputs() {
    elements.cameraInput.value  = "";
    elements.galleryInput.value = "";
  }

  // ── Public element accessors ──────────────────────────────────────────────
  // Exposing elements directly lets other modules attach event listeners
  // without needing to query the DOM themselves.

  function getElement(name) {
    return elements[name] || null;
  }

  // Public API
  return {
    // Feedback
    setStatus,

    // Code
    setCode,
    getCode,
    showCopyToast,
    copyToClipboard,

    // Preview
    showPreview,
    clearPreview,

    // Camera
    showCameraSection,
    hideCameraSection,
    flashViewfinderSuccess,

    // Inputs
    resetFileInputs,

    // Element access for event wiring
    getElement,
  };

})();
