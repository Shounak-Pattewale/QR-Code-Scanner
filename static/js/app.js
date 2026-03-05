import { CONFIG } from "./config.js";
import { $, setStatus, setCode, showCopiedToast, copyToClipboard, setScanUiMode } from "./ui.js";
import { hasNativeBarcodeDetector, buildNativeDetector, tryEnableTorch } from "./scanner_native.js";
import { hasZXing, decodeVideoFrameZXing } from "./scanner_zxing.js";
import { createHtml5Scanner, hasHtml5Qrcode } from "./scanner_html5.js";
import { Cropper } from "./cropper.js";
import { decodeFromCroppedCanvas } from "./upload_decode.js";

// Buttons
const btnStart = $("btnStart");
const btnStop = $("btnStop");
const btnTorch = $("btnTorch");
const btnCopy = $("btnCopy");
const btnUseManual = $("btnUseManual");
const btnOpenCrop = $("btnOpenCrop");

const btnCropDecode = $("btnCropDecode");
const btnCropAuto = $("btnCropAuto");
const btnCropCancel = $("btnCropCancel");

const manualInput = $("manualInput");
const fileInput = $("fileInput");
const videoEl = $("video");
const cropCanvas = $("cropCanvas");

// State
let running = false;
let mode = "none"; // "native" | "zxing" | "html5" | "crop" | "none"

let stream = null;
let detector = null;
let rafId = null;
let torchOn = false;

let html5 = null;
let cropper = new Cropper(cropCanvas);

// ------- Copy / Manual -------
btnCopy.addEventListener("click", async () => {
  const code = $("codeDisplay").value.trim();
  if (!code) return;
  await copyToClipboard(code);
  showCopiedToast();
});

btnUseManual.addEventListener("click", () => {
  const v = manualInput.value.trim();
  if (!v) return;
  setCode(v);
  setStatus("Manual code set.");
});

manualInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnUseManual.click();
});

// ------- Live scanning (best engine order) -------
async function startLive() {
  if (running) return;

  running = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnOpenCrop.disabled = true;

  // Prefer native BarcodeDetector if available
  if (CONFIG.preferNative && hasNativeBarcodeDetector()) {
    try {
      await startNativeLoop();
      return;
    } catch (_) {
      await stopLive();
      // fall through
    }
  }

  // Next: ZXing live frame decode (heavier CPU, but helpful on iOS when native missing)
  if (hasZXing()) {
    try {
      await startZXingLoop();
      return;
    } catch (_) {
      await stopLive();
    }
  }

  // Finally: html5-qrcode
  if (hasHtml5Qrcode()) {
    await startHtml5();
    return;
  }

  await stopLive();
  alert("No scanning engine available in this browser.");
}

async function stopLive() {
  running = false;
  mode = "none";

  // Stop native
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (videoEl) {
    try { videoEl.pause(); } catch (_) {}
    videoEl.srcObject = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  detector = null;

  // Stop html5-qrcode
  if (html5) {
    try { await html5.stop(); } catch (_) {}
    try { await html5.clear(); } catch (_) {}
    html5 = null;
    $("reader").innerHTML = "";
  }

  btnTorch.disabled = true;
  torchOn = false;
  btnTorch.textContent = "Torch";

  btnStart.disabled = false;
  btnStop.disabled = true;
  btnOpenCrop.disabled = false;

  setScanUiMode("none");
  setStatus("Scanner stopped.");
}

// Native loop
async function startNativeLoop() {
  mode = "native";
  setScanUiMode("native");
  setStatus("Starting camera (native)...");

  detector = await buildNativeDetector();
  stream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);

  videoEl.srcObject = stream;
  await videoEl.play();

  // Torch enable if supported
  btnTorch.disabled = false;
  btnTorch.onclick = async () => {
    torchOn = !torchOn;
    try {
      const ok = await tryEnableTorch(stream, torchOn);
      if (!ok) throw new Error("Torch not supported");
      btnTorch.textContent = torchOn ? "Torch: ON" : "Torch";
    } catch {
      torchOn = false;
      btnTorch.textContent = "Torch";
      btnTorch.disabled = true;
    }
  };

  const loop = async () => {
    if (!running || mode !== "native") return;

    try {
      const res = await detector.detect(videoEl);
      if (res && res.length && res[0].rawValue) {
        setCode(res[0].rawValue);
        setStatus("Code detected.");
        if (CONFIG.stopAfterFirst) await stopLive();
        return;
      }
    } catch (_) {}

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  setStatus("Camera running. Aim at barcode/QR.");
}

// ZXing live loop (frame-grab)
async function startZXingLoop() {
  mode = "zxing";
  setScanUiMode("native"); // uses video element
  setStatus("Starting camera (ZXing live)...");

  stream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);
  videoEl.srcObject = stream;
  await videoEl.play();

  const loop = async () => {
    if (!running || mode !== "zxing") return;

    try {
      const text = await decodeVideoFrameZXing(videoEl);
      if (text) {
        setCode(text);
        setStatus("Code detected.");
        if (CONFIG.stopAfterFirst) await stopLive();
        return;
      }
    } catch (_) {}

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  setStatus("Camera running. Aim at barcode/QR.");
}

// html5-qrcode
async function startHtml5() {
  mode = "html5";
  setScanUiMode("html5");
  setStatus("Starting camera (html5-qrcode)...");

  html5 = createHtml5Scanner("reader");
  await html5.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 340, height: 340 }, rememberLastUsedCamera: true },
    async (decodedText) => {
      setCode(decodedText);
      setStatus("Code detected.");
      if (CONFIG.stopAfterFirst) await stopLive();
    },
    (_err) => {}
  );

  setStatus("Camera running. Aim at barcode/QR.");
}

// ------- Crop flow -------
async function openCrop() {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return alert("Choose an image first.");

  // Stop live scanning if running
  if (running) await stopLive();

  mode = "crop";
  setScanUiMode("crop");
  setStatus("Adjust crop rectangle, then Decode.");

  await cropper.loadFile(file);
}

async function decodeCrop() {
  setStatus("Decoding cropped area...");
  const cropped = cropper.getCroppedCanvas();
  const decoded = await decodeFromCroppedCanvas(cropped);

  if (!decoded) {
    setStatus("");
    alert("Could not decode. Try a tighter crop around the code or a clearer photo.");
    return;
  }

  setCode(decoded);
  setStatus("Code detected from crop.");
  // stay in crop mode until user cancels, or auto-exit:
  // cancelCrop();
}

function cancelCrop() {
  mode = "none";
  setScanUiMode("none");
  setStatus("");
}

// ------- Button wiring -------
btnStart.addEventListener("click", startLive);
btnStop.addEventListener("click", stopLive);

btnOpenCrop.addEventListener("click", openCrop);
btnCropDecode.addEventListener("click", decodeCrop);
btnCropAuto.addEventListener("click", () => cropper.autoCropGuess());
btnCropCancel.addEventListener("click", cancelCrop);