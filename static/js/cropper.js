import { CONFIG } from "./config.js";

export class Cropper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });

    this.image = null;
    this.rect = { x: 0, y: 0, w: 100, h: 80 };

    this.dragging = false;
    this.resizing = null;
    this.last = { x: 0, y: 0 };

    this._bindEvents();
  }

  async loadFile(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    URL.revokeObjectURL(img.src);

    this.image = img;

    const maxW = this.canvas.clientWidth || 600;
    const scale = maxW / img.width;

    this.canvas.width = Math.round(img.width * scale);
    this.canvas.height = Math.round(img.height * scale);

    this.setRectByPercent(CONFIG.cropDefault);
    this.render();
  }

  setRectByPercent(p) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.rect = {
      x: Math.round(W * p.x),
      y: Math.round(H * p.y),
      w: Math.round(W * p.w),
      h: Math.round(H * p.h),
    };
  }

  autoCropGuess() {
    this.setRectByPercent({ x: 0.08, y: 0.40, w: 0.84, h: 0.28 });
    this.render();
  }

  getCroppedCanvas() {
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(this.rect.w));
    out.height = Math.max(1, Math.round(this.rect.h));

    const octx = out.getContext("2d", { willReadFrequently: true });
    octx.drawImage(
      this.canvas,
      this.rect.x,
      this.rect.y,
      this.rect.w,
      this.rect.h,
      0,
      0,
      out.width,
      out.height
    );

    return out;
  }

  render() {
    const { ctx, canvas, image } = this;
    if (!image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const r = this.rect;

    // Dark overlay outside crop area
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw image only inside crop area
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,0,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    // Resize handles
    const s = 10;
    const handles = this._handles();
    ctx.fillStyle = "rgba(0,255,0,0.95)";
    for (const h of Object.values(handles)) {
      ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s);
    }
    ctx.restore();
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

    for (const [key, point] of Object.entries(handles)) {
      const dx = x - point.x;
      const dy = y - point.y;

      if ((dx * dx + dy * dy) <= radius * radius) {
        return key;
      }
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

      return {
        x: pt.clientX - rect.left,
        y: pt.clientY - rect.top
      };
    };

    const down = (e) => {
      if (!this.image) return;

      const { x, y } = getXY(e);
      this.last = { x, y };

      const h = this._hitTestHandle(x, y);
      if (h) {
        this.resizing = h;
        this.dragging = false;

        // Only prevent default when crop interaction really starts
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (this._pointInRect(x, y)) {
        this.dragging = true;
        this.resizing = null;

        if (e.cancelable) e.preventDefault();
      }
    };

    const move = (e) => {
      if (!this.image) return;
      if (!this.dragging && !this.resizing) return;

      if (e.cancelable) e.preventDefault();

      const { x, y } = getXY(e);
      const dx = x - this.last.x;
      const dy = y - this.last.y;
      this.last = { x, y };

      const r = this.rect;

      if (this.dragging) {
        r.x += dx;
        r.y += dy;
      } else if (this.resizing) {
        if (this.resizing.includes("n")) {
          r.y += dy;
          r.h -= dy;
        }
        if (this.resizing.includes("w")) {
          r.x += dx;
          r.w -= dx;
        }
        if (this.resizing.includes("s")) {
          r.h += dy;
        }
        if (this.resizing.includes("e")) {
          r.w += dx;
        }
      }

      const min = 30;
      r.w = Math.max(min, r.w);
      r.h = Math.max(min, r.h);
      r.x = Math.max(0, Math.min(this.canvas.width - r.w, r.x));
      r.y = Math.max(0, Math.min(this.canvas.height - r.h, r.y));

      this.render();
    };

    const up = (e) => {
      // Only prevent default if user was actively dragging/resizing
      if (!this.dragging && !this.resizing) return;

      if (e.cancelable) e.preventDefault();

      this.dragging = false;
      this.resizing = null;
    };

    // Mouse
    c.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    // Touch
    c.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up, { passive: false });
    window.addEventListener("touchcancel", up, { passive: false });
  }
}