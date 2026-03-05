import { CONFIG } from "./config.js";

export class Cropper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });

    this.image = null;
    this.rect = { x: 0, y: 0, w: 100, h: 80 };

    this.dragging = false;
    this.resizing = null; // "nw","ne","sw","se"
    this.last = { x: 0, y: 0 };

    this._bindEvents();
  }

  async loadFile(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    URL.revokeObjectURL(img.src);

    this.image = img;

    // Fit canvas to container width while preserving aspect
    const maxW = this.canvas.clientWidth || 600;
    const scale = maxW / img.width;
    this.canvas.width = Math.round(img.width * scale);
    this.canvas.height = Math.round(img.height * scale);

    // Default crop rectangle
    this.setRectByPercent(CONFIG.cropDefault);
    this.render();
  }

  setRectByPercent(p) {
    const W = this.canvas.width, H = this.canvas.height;
    this.rect = {
      x: Math.round(W * p.x),
      y: Math.round(H * p.y),
      w: Math.round(W * p.w),
      h: Math.round(H * p.h),
    };
  }

  autoCropGuess() {
    // Simple heuristic for “wide barcode”: focus on lower-middle strip
    this.setRectByPercent({ x: 0.08, y: 0.40, w: 0.84, h: 0.28 });
    this.render();
  }

  getCroppedCanvas() {
    // Create a new canvas containing cropped region in original canvas coords
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(this.rect.w));
    out.height = Math.max(1, Math.round(this.rect.h));

    const octx = out.getContext("2d", { willReadFrequently: true });
    octx.drawImage(
      this.canvas,
      this.rect.x, this.rect.y, this.rect.w, this.rect.h,
      0, 0, out.width, out.height
    );
    return out;
  }

//   render() {
//     const { ctx, canvas, image } = this;
//     if (!image) return;

//     // Draw image
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
//     ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

//     // Overlay + crop rectangle
//     ctx.save();
//     ctx.fillStyle = "rgba(0,0,0,0.35)";
//     ctx.fillRect(0, 0, canvas.width, canvas.height);

//     const r = this.rect;
//     ctx.clearRect(r.x, r.y, r.w, r.h);

//     // Border
//     ctx.strokeStyle = "rgba(0,255,0,0.9)";
//     ctx.lineWidth = 2;
//     ctx.strokeRect(r.x, r.y, r.w, r.h);

//     // Handles
//     const s = 10;
//     const handles = this._handles();
//     ctx.fillStyle = "rgba(0,255,0,0.9)";
//     for (const h of Object.values(handles)) {
//       ctx.fillRect(h.x - s/2, h.y - s/2, s, s);
//     }
//     ctx.restore();
//   }


// Test 1
render() {
  const { ctx, canvas, image } = this;
  if (!image) return;

  // Draw base image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const r = this.rect;

  // Overlay dark layer
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clip to crop rectangle and redraw image so it appears "clear"
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  ctx.clearRect(r.x, r.y, r.w, r.h); // clear overlay only (safe inside clip)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  ctx.restore();

  // Crop border
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,0,0.95)";
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);

  // Handles
  const s = 10;
  const handles = this._handles();
  ctx.fillStyle = "rgba(0,255,0,0.95)";
  for (const h of Object.values(handles)) {
    ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s);
  }
  ctx.restore();
}


// render() {
//   const { ctx, canvas, image } = this;
//   if (!image) return;

//   // 1) Draw the image to the canvas
//   this._drawImage();

//   // 2) Darken the entire image (overlay)
//   ctx.save();
//   ctx.fillStyle = "rgba(0,0,0,0.45)";
//   ctx.fillRect(0, 0, canvas.width, canvas.height);

//   // 3) Re-draw the image ONLY inside crop rectangle
//   //    (This is the critical fix vs clearRect)
//   const r = this.rect;
//   ctx.globalCompositeOperation = "source-over";
//   ctx.drawImage(
//     image,
//     0, 0, image.width, image.height,          // source (original image)
//     0, 0, canvas.width, canvas.height         // destination (fit to canvas)
//   );

//   // To keep the overlay everywhere except the crop:
//   // We redraw the image in crop area by clipping to the crop rect.
//   // So redo step 2 properly using clip:
//   ctx.restore();

//   // Re-do properly using clip (clean + predictable):
//   // A) redraw base image again
//   this._drawImage();

//   // B) overlay
//   ctx.save();
//   ctx.fillStyle = "rgba(0,0,0,0.45)";
//   ctx.fillRect(0, 0, canvas.width, canvas.height);

//   // C) clip to crop rect and redraw image (making the crop area clear)
//   ctx.save();
//   ctx.beginPath();
//   ctx.rect(r.x, r.y, r.w, r.h);
//   ctx.clip();

//   this._drawImage(); // redraw image inside crop rect
//   ctx.restore();

//   // 4) Draw crop border
//   ctx.strokeStyle = "rgba(0,255,0,0.95)";
//   ctx.lineWidth = 2;
//   ctx.strokeRect(r.x, r.y, r.w, r.h);

//   // 5) Draw resize handles
//   const s = 10;
//   const handles = this._handles();
//   ctx.fillStyle = "rgba(0,255,0,0.95)";
//   for (const h of Object.values(handles)) {
//     ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s);
//   }

//   ctx.restore();
// }

/**
 * Draw the loaded image to fully cover the canvas.
 * We always fit the entire image into the canvas (no crop here).
 */
_drawImage() {
  const { ctx, canvas, image } = this;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}


  _handles() {
    const r = this.rect;
    return {
      nw: { x: r.x, y: r.y },
      ne: { x: r.x + r.w, y: r.y },
      sw: { x: r.x, y: r.y + r.h },
      se: { x: r.x + r.w, y: r.y + r.h },
    };
  }

  _hitTestHandle(x, y) {
    const handles = this._handles();
    const radius = 14;
    for (const [k, p] of Object.entries(handles)) {
      const dx = x - p.x, dy = y - p.y;
      if ((dx*dx + dy*dy) <= radius*radius) return k;
    }
    return null;
  }

  _pointInRect(x, y) {
    const r = this.rect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  _bindEvents() {
    const c = this.canvas;

    const getXY = (e) => {
      const rect = c.getBoundingClientRect();
      const pt = (e.touches && e.touches[0]) ? e.touches[0] : e;
      return { x: pt.clientX - rect.left, y: pt.clientY - rect.top };
    };

    const down = (e) => {
      if (!this.image) return;
      e.preventDefault();

      const { x, y } = getXY(e);
      this.last = { x, y };

      const h = this._hitTestHandle(x, y);
      if (h) {
        this.resizing = h;
        this.dragging = false;
        return;
      }

      if (this._pointInRect(x, y)) {
        this.dragging = true;
        this.resizing = null;
        return;
      }
    };

    const move = (e) => {
      if (!this.image) return;
      if (!this.dragging && !this.resizing) return;

      e.preventDefault();
      const { x, y } = getXY(e);
      const dx = x - this.last.x;
      const dy = y - this.last.y;
      this.last = { x, y };

      const r = this.rect;

      if (this.dragging) {
        r.x += dx; r.y += dy;
      } else if (this.resizing) {
        // Resize by corner
        if (this.resizing.includes("n")) { r.y += dy; r.h -= dy; }
        if (this.resizing.includes("w")) { r.x += dx; r.w -= dx; }
        if (this.resizing.includes("s")) { r.h += dy; }
        if (this.resizing.includes("e")) { r.w += dx; }
      }

      // Clamp and minimum size
      const min = 30;
      r.w = Math.max(min, r.w);
      r.h = Math.max(min, r.h);
      r.x = Math.max(0, Math.min(this.canvas.width - r.w, r.x));
      r.y = Math.max(0, Math.min(this.canvas.height - r.h, r.y));

      this.render();
    };

    const up = (e) => {
      if (!this.image) return;
      e.preventDefault();
      this.dragging = false;
      this.resizing = null;
    };

    c.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    c.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up, { passive: false });
  }
}