/**
 * canvas.js
 * ---------
 * Low-level canvas and image utilities used by the preprocessor
 * and the camera/upload modules.
 *
 * Nothing in this file knows about barcodes, the DOM (except canvas
 * creation), or application state. Pure image-manipulation helpers.
 */

const CanvasUtils = (() => {

  /**
   * Create a blank canvas with integer dimensions, minimum 1×1.
   *
   * @param {number} width
   * @param {number} height
   * @returns {HTMLCanvasElement}
   */
  function createCanvas(width, height) {
    const canvas   = document.createElement("canvas");
    canvas.width   = Math.max(1, Math.round(width));
    canvas.height  = Math.max(1, Math.round(height));
    return canvas;
  }

  /**
   * Return a 2D context with willReadFrequently: true.
   * This hint tells the browser to optimise for getImageData calls,
   * which we do heavily in the preprocessor.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {CanvasRenderingContext2D}
   */
  function getCtx(canvas) {
    return canvas.getContext("2d", { willReadFrequently: true });
  }

  /**
   * Pixel-copy a canvas into a new canvas of the same size.
   *
   * @param {HTMLCanvasElement} src
   * @returns {HTMLCanvasElement}
   */
  function cloneCanvas(src) {
    const out = createCanvas(src.width, src.height);
    getCtx(out).drawImage(src, 0, 0);
    return out;
  }

  /**
   * Load a File object into an HTMLImageElement and wait for decode.
   * Uses createObjectURL so large files are streamed, not base64-encoded.
   *
   * @param {File} file
   * @returns {Promise<HTMLImageElement>}
   */
  async function fileToImage(file) {
    const img = new Image();
    img.src   = URL.createObjectURL(file);
    await img.decode();
    return img;
  }

  /**
   * Draw an image onto a canvas, downscaling if either dimension exceeds
   * maxDimension. The aspect ratio is always preserved.
   * Images smaller than maxDimension are drawn at their natural size.
   *
   * @param {HTMLImageElement} img
   * @param {number} maxDimension  - pixel ceiling for the longest side
   * @returns {HTMLCanvasElement}
   */
  function imageToCanvas(img, maxDimension) {
    let w = img.width;
    let h = img.height;

    if (Math.max(w, h) > maxDimension) {
      const scale = maxDimension / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = createCanvas(w, h);
    getCtx(canvas).drawImage(img, 0, 0, w, h);
    return canvas;
  }

  /**
   * Capture the current frame of a <video> element onto a canvas,
   * downscaling if needed. Returns null if the video has no valid
   * dimensions yet (e.g. before the stream has started).
   *
   * @param {HTMLVideoElement} video
   * @param {number} maxDimension
   * @returns {HTMLCanvasElement|null}
   */
  function videoToCanvas(video, maxDimension) {
    let w = video.videoWidth;
    let h = video.videoHeight;

    if (!w || !h) return null;

    if (Math.max(w, h) > maxDimension) {
      const scale = maxDimension / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = createCanvas(w, h);
    getCtx(canvas).drawImage(video, 0, 0, w, h);
    return canvas;
  }

  /**
   * Convert a canvas to a File object (PNG).
   * Used to feed preprocessed canvas variants to html5-qrcode,
   * which only accepts File inputs.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} [filename="variant.png"]
   * @returns {Promise<File>}
   */
  function canvasToFile(canvas, filename = "variant.png") {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(new File([blob], filename, { type: "image/png" })),
        "image/png"
      );
    });
  }

  // Public API
  return {
    createCanvas,
    getCtx,
    cloneCanvas,
    fileToImage,
    imageToCanvas,
    videoToCanvas,
    canvasToFile,
  };

})();
