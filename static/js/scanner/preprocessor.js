/**
 * preprocessor.js
 * ---------------
 * Image preprocessing passes and variant builders.
 *
 * Each pass takes a canvas and returns a new canvas — the source is
 * never mutated. Passes are pure functions.
 *
 * Why preprocessing matters:
 *   Barcode decoders work best on clean, high-contrast images.
 *   Real-world package labels are often blurry, faded, poorly lit,
 *   or printed on reflective/damaged surfaces. Running multiple
 *   preprocessing variants dramatically improves decode success rate.
 *
 * Variant pipeline strategy:
 *   - Variants are ordered cheapest/fastest first.
 *   - Decoding stops as soon as any variant succeeds (early exit).
 *   - Expensive passes (sharpen, upscale, multi-threshold) only run
 *     when the fast passes have already failed.
 *   - The live camera uses a shorter subset for performance.
 *
 * Dependencies: CanvasUtils (canvas.js)
 */

const Preprocessor = (() => {

  const { createCanvas, getCtx, cloneCanvas } = CanvasUtils;

  // ── Individual passes ─────────────────────────────────────────────────────

  /**
   * Convert a colour canvas to luminance-only grayscale.
   * Uses the standard ITU-R BT.601 luma coefficients.
   * Most decoders perform better on grayscale than colour.
   *
   * @param {HTMLCanvasElement} src
   * @returns {HTMLCanvasElement}
   */
  function toGrayscale(src) {
    const out = cloneCanvas(src);
    const ctx = getCtx(out);
    const id  = ctx.getImageData(0, 0, out.width, out.height);
    const px  = id.data;

    for (let i = 0; i < px.length; i += 4) {
      const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = px[i + 1] = px[i + 2] = g;
    }

    ctx.putImageData(id, 0, 0);
    return out;
  }

  /**
   * Upscale a canvas by an integer factor using nearest-neighbour
   * interpolation (imageSmoothingEnabled = false).
   *
   * Why nearest-neighbour: bilinear/bicubic blurring softens bar edges,
   * which confuses decoders. Nearest-neighbour keeps bars pixel-crisp.
   *
   * When to use: barcodes that are small or far from the camera often
   * have bars only a few pixels wide. Upscaling 2x lets decoders
   * resolve the bars clearly.
   *
   * @param {HTMLCanvasElement} src
   * @param {number} [scale=2]
   * @returns {HTMLCanvasElement}
   */
  function toUpscaled(src, scale = 2) {
    const out = createCanvas(src.width * scale, src.height * scale);
    const ctx = getCtx(out);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  /**
   * Boost contrast around the midpoint (128) by a linear factor.
   * Converts to grayscale first so only luminance is amplified.
   *
   * Helps labels with low contrast due to poor lighting or faded ink.
   *
   * @param {HTMLCanvasElement} src
   * @param {number} [factor=1.6]  - values > 1 increase contrast
   * @returns {HTMLCanvasElement}
   */
  function toHighContrast(src, factor = 1.6) {
    const out = cloneCanvas(src);
    const ctx = getCtx(out);
    const id  = ctx.getImageData(0, 0, out.width, out.height);
    const px  = id.data;

    for (let i = 0; i < px.length; i += 4) {
      let g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      g = Math.max(0, Math.min(255, (g - 128) * factor + 128));
      px[i] = px[i + 1] = px[i + 2] = g;
    }

    ctx.putImageData(id, 0, 0);
    return out;
  }

  /**
   * Sharpen using a 3×3 unsharp-mask convolution kernel.
   * Applied to the grayscale version of the image.
   *
   *   Kernel:  0  -1   0
   *           -1   5  -1
   *            0  -1   0
   *
   * This enhances edges (bar boundaries) which helps decoders
   * resolve out-of-focus or motion-blurred labels.
   *
   * @param {HTMLCanvasElement} src
   * @returns {HTMLCanvasElement}
   */
  function toSharpened(src) {
    const w    = src.width;
    const h    = src.height;
    const gray = toGrayscale(src);
    const ctx  = getCtx(gray);
    const s    = ctx.getImageData(0, 0, w, h);
    const d    = ctx.createImageData(w, h);
    const sp   = s.data;
    const dp   = d.data;
    const k    = [0, -1, 0, -1, 5, -1, 0, -1, 0];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const sy = Math.min(h - 1, Math.max(0, y + ky - 1));
            const sx = Math.min(w - 1, Math.max(0, x + kx - 1));
            sum += sp[(sy * w + sx) * 4] * k[ky * 3 + kx];
          }
        }
        const oi = (y * w + x) * 4;
        const v  = Math.max(0, Math.min(255, sum));
        dp[oi] = dp[oi + 1] = dp[oi + 2] = v;
        dp[oi + 3] = 255;
      }
    }

    ctx.putImageData(d, 0, 0);
    return gray;
  }

  /**
   * Apply a global threshold to produce a pure black-and-white image.
   * Pixels at or above the threshold become white (255), others black (0).
   *
   * Three threshold levels are used in the full variant pipeline:
   *   - 140 (standard):  works for most well-lit labels
   *   - 100 (dark):      recovers detail on dark/underexposed labels
   *   - 180 (light):     recovers detail on faint/overexposed labels
   *
   * @param {HTMLCanvasElement} src
   * @param {number} [threshold=140]  - 0–255
   * @returns {HTMLCanvasElement}
   */
  function toThreshold(src, threshold = 140) {
    const out = cloneCanvas(src);
    const ctx = getCtx(out);
    const id  = ctx.getImageData(0, 0, out.width, out.height);
    const px  = id.data;

    for (let i = 0; i < px.length; i += 4) {
      const g  = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const bw = g >= threshold ? 255 : 0;
      px[i] = px[i + 1] = px[i + 2] = bw;
    }

    ctx.putImageData(id, 0, 0);
    return out;
  }

  /**
   * Invert all pixel values (255 - value).
   *
   * Some thermal printer labels, photocopied labels, or worn stickers
   * have light bars on a dark background. Decoders expect dark bars on
   * a light background, so inverting rescues these cases.
   *
   * @param {HTMLCanvasElement} src
   * @returns {HTMLCanvasElement}
   */
  function toInverted(src) {
    const out = cloneCanvas(src);
    const ctx = getCtx(out);
    const id  = ctx.getImageData(0, 0, out.width, out.height);
    const px  = id.data;

    for (let i = 0; i < px.length; i += 4) {
      px[i]     = 255 - px[i];
      px[i + 1] = 255 - px[i + 1];
      px[i + 2] = 255 - px[i + 2];
    }

    ctx.putImageData(id, 0, 0);
    return out;
  }

  // ── Variant builders ──────────────────────────────────────────────────────

  /**
   * Full variant pipeline — used for uploaded images.
   *
   * 10 variants ordered cheapest → most aggressive.
   * Early exit in the decoder means expensive passes rarely run
   * on clean, well-printed labels.
   *
   * useHtml5: true on variants most likely to help html5-qrcode
   * (which is slower but sometimes succeeds where ZXing fails).
   *
   * @param {HTMLCanvasElement} baseCanvas
   * @returns {Array<{name: string, canvas: HTMLCanvasElement, useHtml5: boolean}>}
   */
  function buildUploadVariants(baseCanvas) {
    const gray      = toGrayscale(baseCanvas);
    const upscaled  = toUpscaled(gray, 2);
    const contrast  = toHighContrast(gray);
    const sharpened = toSharpened(gray);
    const t140      = toThreshold(contrast, 140);
    const t100      = toThreshold(contrast, 100);
    const t180      = toThreshold(contrast, 180);
    const inverted  = toInverted(gray);
    const invThresh = toThreshold(inverted, 140);

    return [
      { name: "original",           canvas: baseCanvas, useHtml5: true  },
      { name: "grayscale",          canvas: gray,       useHtml5: true  },
      { name: "upscaled_2x",        canvas: upscaled,   useHtml5: false },
      { name: "high_contrast",      canvas: contrast,   useHtml5: false },
      { name: "sharpened",          canvas: sharpened,  useHtml5: true  },
      { name: "threshold_140",      canvas: t140,       useHtml5: false },
      { name: "threshold_100",      canvas: t100,       useHtml5: false },
      { name: "threshold_180",      canvas: t180,       useHtml5: false },
      { name: "inverted",           canvas: inverted,   useHtml5: false },
      { name: "inverted_threshold", canvas: invThresh,  useHtml5: false },
    ];
  }

  /**
   * Lightweight variant pipeline — used per live camera frame.
   *
   * 5 fast variants only. The sharpened and upscaled passes are
   * too expensive to run at 600ms intervals on mobile hardware.
   * If the camera consistently fails on a label, the operator
   * can fall back to "Choose Image" which uses the full pipeline.
   *
   * @param {HTMLCanvasElement} baseCanvas
   * @returns {Array<{name: string, canvas: HTMLCanvasElement, useHtml5: boolean}>}
   */
  function buildLiveVariants(baseCanvas) {
    const gray     = toGrayscale(baseCanvas);
    const contrast = toHighContrast(gray);
    const t140     = toThreshold(contrast, 140);
    const inverted = toInverted(gray);

    return [
      { name: "original",      canvas: baseCanvas, useHtml5: false },
      { name: "grayscale",     canvas: gray,       useHtml5: false },
      { name: "high_contrast", canvas: contrast,   useHtml5: false },
      { name: "threshold_140", canvas: t140,       useHtml5: false },
      { name: "inverted",      canvas: inverted,   useHtml5: false },
    ];
  }

  // Public API
  return {
    buildUploadVariants,
    buildLiveVariants,
  };

})();
