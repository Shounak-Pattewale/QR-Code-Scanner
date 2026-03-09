/**
 * pipeline.js
 * -----------
 * Runs the decoder trio (Native → ZXing → html5-qrcode) across
 * a list of preprocessed image variants, stopping as soon as any
 * decoder succeeds on any variant.
 *
 * This module is the bridge between the preprocessor (which produces
 * variants) and the decoders (which try to read each variant).
 * It has no knowledge of cameras, uploads, or the DOM.
 *
 * Dependencies: Decoders (decoders.js)
 */

const Pipeline = (() => {

  /**
   * Try all three decoders on a single canvas variant.
   * Returns the decoded code string on first success, or null.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string}            variantName  - used for debug logging only
   * @param {boolean}           useHtml5     - whether to also try html5-qrcode
   * @param {HTMLElement}       readerDiv    - #reader container for html5-qrcode
   * @returns {Promise<string|null>}
   */
  async function tryVariant(canvas, variantName, useHtml5, readerDiv) {
    let code;

    code = await Decoders.tryNative(canvas);
    if (code) {
      console.debug(`[Pipeline] BarcodeDetector hit on variant: ${variantName}`);
      return code;
    }

    code = await Decoders.tryZXing(canvas);
    if (code) {
      console.debug(`[Pipeline] ZXing hit on variant: ${variantName}`);
      return code;
    }

    if (useHtml5) {
      code = await Decoders.tryHtml5(canvas, readerDiv);
      if (code) {
        console.debug(`[Pipeline] html5-qrcode hit on variant: ${variantName}`);
        return code;
      }
    }

    return null;
  }

  /**
   * Run the full variant pipeline.
   * Iterates through the variants array in order and returns on the
   * first successful decode. Remaining variants are skipped.
   *
   * @param {Array<{name: string, canvas: HTMLCanvasElement, useHtml5: boolean}>} variants
   * @param {HTMLElement} readerDiv  - #reader container for html5-qrcode
   * @returns {Promise<{code: string, variant: string}|null>}
   *   Returns an object with the decoded code and the variant name that
   *   succeeded, or null if all variants failed.
   */
  async function run(variants, readerDiv) {
    for (const v of variants) {
      const code = await tryVariant(v.canvas, v.name, v.useHtml5, readerDiv);
      if (code) return { code, variant: v.name };
    }
    return null;
  }

  /**
   * Run the browser pipeline first. If all variants fail, automatically
   * send the original file to the backend Python decoder as a fallback.
   *
   * This is the standard path for upload decoding — browser is fast and
   * private, backend is powerful and handles damaged labels better.
   *
   * @param {Array<{name: string, canvas: HTMLCanvasElement, useHtml5: boolean}>} variants
   * @param {HTMLElement} readerDiv   - #reader container for html5-qrcode
   * @param {File}        file        - original file, sent to backend if needed
   * @returns {Promise<{code: string, variant: string, source: string}|null>}
   *   source is "browser" or "backend"
   */
  async function runWithFallback(variants, readerDiv, file) {
    // 1. Try browser pipeline first
    const browserResult = await run(variants, readerDiv);
    if (browserResult) {
      return { ...browserResult, source: "browser" };
    }

    // 2. Browser failed — try backend fallback if configured
    if (!ScannerConfig.DECODER_API_URL || !file) return null;

    console.debug("[Pipeline] Browser decoders failed — trying backend fallback.");

    const backendResult = await BackendDecoder.decode(file);
    if (backendResult && backendResult.found) {
      return {
        code:    backendResult.code,
        variant: backendResult.variant,
        source:  "backend",
      };
    }

    return null;
  }

  // Public API
  return { run, runWithFallback };

})();
