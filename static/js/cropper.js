/*
  Lightweight cropper.

  User uploads an image, then moves/resizes a green rectangle
  over the barcode/QR area before decoding.
*/

import { CONFIG } from "./config.js";

export class Cropper {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });

    this.image = null;

    this.rect = { x: 0, y: 0, w: 100, h: 80 };

    this.isDragging = false;
    this.resizeHandle = null;
    this.lastPointer = { x: 0, y: 0 };

    this.bindEvents();
  }

  async loadFile(file) {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    await image.decode();
    URL.revokeObjectURL(image.src);

    this.image = image;

    const maxWidth = this.canvas.clientWidth || 600;
    const scale = maxWidth / image.width;

    this.canvas.width = Math.round(image.width * scale);
    this.canvas.height = Math.round(image.height * scale);

    this.setDefaultCrop();
    this.render();
  }

  setDefaultCrop() {
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.rect = {
      x: Math.round(W * CONFIG.defaultCrop.x),
      y: Math.round(H * CONFIG.defaultCrop.y),
      w: Math.round(W * CONFIG.defaultCrop.w),
      h: Math.round(H * CONFIG.defaultCrop.h)
    };
  }

  autoCropGuess() {
    /*
      A simple default guess for long horizontal barcodes.
      User can still adjust manually afterwards.
    */
    this.rect = {
      x: Math.round(this.canvas.width * 0.08),
      y: Math.round(this.canvas.height * 0.40),
      w: Math.round(this.canvas.width * 0.84),
      h: Math.round(this.canvas.height * 0.22)
    };

    this.render();
  }

  getCroppedCanvas() {
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(this.rect.w));
    output.height = Math.max(1, Math.round(this.rect.h));

    const outputContext = output.getContext("2d", { willReadFrequently: true });

    outputContext.drawImage(
      this.canvas,
      this.rect.x,
      this.rect.y,
      this.rect.w,
      this.rect.h,
      0,
      0,
      output.width,
      output.height
    );

    return output;
  }

  render() {
    if (!this.image) return;

    const ctx = this.ctx;
    const canvas = this.canvas;
    const rect = this.rect;

    // Draw original image to canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

    // Dark overlay
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Show the image clearly inside crop area
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Crop border
    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 0, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // Resize handles
    const size = 10;
    const handles = this.getHandles();

    ctx.fillStyle = "rgba(0, 255, 0, 0.95)";
    for (const handle of Object.values(handles)) {
      ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    }

    ctx.restore();
  }

  getHandles() {
    const r = this.rect;

    return {
      nw: { x: r.x, y: r.y },
      ne: { x: r.x + r.w, y: r.y },
      sw: { x: r.x, y: r.y + r.h },
      se: { x: r.x + r.w, y: r.y + r.h }
    };
  }

  hitTestHandle(x, y) {
    const handles = this.getHandles();
    const radius = 14;

    for (const [name, point] of Object.entries(handles)) {
      const dx = x - point.x;
      const dy = y - point.y;

      if ((dx * dx + dy * dy) <= radius * radius) {
        return name;
      }
    }

    return null;
  }

  isInsideRect(x, y) {
    const r = this.rect;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  bindEvents() {
    const getPoint = (event) => {
      const box = this.canvas.getBoundingClientRect();
      const source = event.touches ? event.touches[0] : event;

      return {
        x: source.clientX - box.left,
        y: source.clientY - box.top
      };
    };

    const onDown = (event) => {
      if (!this.image) return;

      event.preventDefault();

      const point = getPoint(event);
      this.lastPointer = point;

      const handle = this.hitTestHandle(point.x, point.y);

      if (handle) {
        this.resizeHandle = handle;
        this.isDragging = false;
        return;
      }

      if (this.isInsideRect(point.x, point.y)) {
        this.isDragging = true;
        this.resizeHandle = null;
      }
    };

    const onMove = (event) => {
      if (!this.image) return;
      if (!this.isDragging && !this.resizeHandle) return;

      event.preventDefault();

      const point = getPoint(event);
      const dx = point.x - this.lastPointer.x;
      const dy = point.y - this.lastPointer.y;

      this.lastPointer = point;

      const r = this.rect;

      if (this.isDragging) {
        r.x += dx;
        r.y += dy;
      } else if (this.resizeHandle) {
        if (this.resizeHandle.includes("n")) {
          r.y += dy;
          r.h -= dy;
        }
        if (this.resizeHandle.includes("s")) {
          r.h += dy;
        }
        if (this.resizeHandle.includes("w")) {
          r.x += dx;
          r.w -= dx;
        }
        if (this.resizeHandle.includes("e")) {
          r.w += dx;
        }
      }

      const minSize = 30;

      r.w = Math.max(minSize, r.w);
      r.h = Math.max(minSize, r.h);
      r.x = Math.max(0, Math.min(this.canvas.width - r.w, r.x));
      r.y = Math.max(0, Math.min(this.canvas.height - r.h, r.y));

      this.render();
    };

    const onUp = (event) => {
      event.preventDefault();
      this.isDragging = false;
      this.resizeHandle = null;
    };

    this.canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    this.canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp, { passive: false });
  }
}