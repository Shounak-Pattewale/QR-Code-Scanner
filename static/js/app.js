/*
  Main application file.

  This file connects:
  - buttons
  - scanner engines
  - cropper
  - UI updates
*/

import { CONFIG } from "./config.js";
import {
  getEl,
  setStatus,
  setDetectedCode,
  showCopiedToast,
  copyText,
  setViewMode
} from "./ui.js";
import {
  isNativeDetectorAvailable,
  createNativeDetector,
  toggleTorch
} from "./scanner_native.js";
import {
  isZXingAvailable,
  decodeFromVideoFrame
} from "./scanner_zxing.js";
import {
  isHtml5QrcodeAvailable,
  createHtml5Scanner
} from "./scanner_html5.js";
import { Cropper } from "./cropper.js";
import { decodeUploadedCanvas } from "./upload_decode.js";

// -------------------------
// DOM references
// -------------------------
const btnStart = getEl("btnStart");
const btnStop = getEl("btnStop");
const btnTorch = getEl("btnTorch");
const btnCopy = getEl("btnCopy");
const btnUseManual = getEl("btnUseManual");
const btnOpenCrop = getEl("btnOpenCrop");
const btnCropDecode = getEl("btnCropDecode");
const btnCropAuto = getEl("btnCropAuto");
const btnCropCancel = getEl("btnCropCancel");

const manualInput = getEl("manualInput");
const fileInput = getEl("fileInput");
const video = getEl("video");
const cropCanvas = getEl("cropCanvas");

// -------------------------
// App state
// -------------------------
let isScanning = false;
let currentMode = "none";

let mediaStream = null;
let nativeDetector = null;
let animationId = null;
let torchEnabled = false;

let html5Scanner = null;

const cropper = new Cropper(cropCanvas);

// -------------------------
// UI actions
// -------------------------
btnCopy.addEventListener("click", async () => {
  const value = getEl("codeDisplay").value.trim();
  if (!value) return;

  await copyText(value);
  showCopiedToast();
});

btnUseManual.addEventListener("click", () => {
  const value = manualInput.value.trim();
  if (!value) return;

  setDetectedCode(value);
  setStatus("Manual code set.");
});

manualInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    btnUseManual.click();
  }
});

// -------------------------
// Live scanning
// -------------------------
async function startScanning() {
  if (isScanning) return;

  isScanning = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnOpenCrop.disabled = true;

  // 1. Try native detector first
  if (CONFIG.preferNative && isNativeDetectorAvailable()) {
    try {
      await startNativeScanner();
      return;
    } catch (error) {
      await stopScanning();
    }
  }

  // 2. Then try ZXing live decoding
  if (isZXingAvailable()) {
    try {
      await startZXingScanner();
      return;
    } catch (error) {
      await stopScanning();
    }
  }

  // 3. Final fallback: html5-qrcode
  if (isHtml5QrcodeAvailable()) {
    try {
      await startHtml5Scanner();
      return;
    } catch (error) {
      await stopScanning();
    }
  }

  await stopScanning();
  alert("No scanner could be started in this browser.");
}

async function stopScanning() {
  isScanning = false;
  currentMode = "none";

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (video) {
    try {
      video.pause();
    } catch (error) {
      // ignore
    }
    video.srcObject = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  nativeDetector = null;

  if (html5Scanner) {
    try {
      await html5Scanner.stop();
    } catch (error) {
      // ignore
    }

    try {
      await html5Scanner.clear();
    } catch (error) {
      // ignore
    }

    html5Scanner = null;
    getEl("reader").innerHTML = "";
  }

  btnTorch.disabled = true;
  btnTorch.textContent = "Torch";
  torchEnabled = false;

  btnStart.disabled = false;
  btnStop.disabled = true;
  btnOpenCrop.disabled = false;

  setViewMode("none");
  setStatus("Scanner stopped.");
}

async function startNativeScanner() {
  currentMode = "native";
  setViewMode("native");
  setStatus("Starting native scanner...");

  nativeDetector = await createNativeDetector();
  mediaStream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);

  video.srcObject = mediaStream;
  await video.play();

  btnTorch.disabled = false;

  btnTorch.onclick = async () => {
    torchEnabled = !torchEnabled;

    try {
      const success = await toggleTorch(mediaStream, torchEnabled);

      if (!success) {
        throw new Error("Torch not supported");
      }

      btnTorch.textContent = torchEnabled ? "Torch: ON" : "Torch";
    } catch (error) {
      torchEnabled = false;
      btnTorch.disabled = true;
      btnTorch.textContent = "Torch";
    }
  };

  const scanLoop = async () => {
    if (!isScanning || currentMode !== "native") return;

    try {
      const results = await nativeDetector.detect(video);

      if (results && results.length && results[0].rawValue) {
        setDetectedCode(results[0].rawValue);
        setStatus("Code detected.");

        if (CONFIG.stopAfterFirstSuccess) {
          await stopScanning();
        }
        return;
      }
    } catch (error) {
      // Ignore frame-level failures and continue scanning
    }

    animationId = requestAnimationFrame(scanLoop);
  };

  animationId = requestAnimationFrame(scanLoop);
  setStatus("Camera running. Point the camera at the label.");
}

async function startZXingScanner() {
  currentMode = "native";
  setViewMode("native");
  setStatus("Starting ZXing scanner...");

  mediaStream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);
  video.srcObject = mediaStream;
  await video.play();

  const scanLoop = async () => {
    if (!isScanning) return;

    try {
      const decodedText = await decodeFromVideoFrame(video);

      if (decodedText) {
        setDetectedCode(decodedText);
        setStatus("Code detected.");

        if (CONFIG.stopAfterFirstSuccess) {
          await stopScanning();
        }
        return;
      }
    } catch (error) {
      // Ignore frame-level failures and continue scanning
    }

    animationId = requestAnimationFrame(scanLoop);
  };

  animationId = requestAnimationFrame(scanLoop);
  setStatus("Camera running. Point the camera at the label.");
}

async function startHtml5Scanner() {
  currentMode = "html5";
  setViewMode("html5");
  setStatus("Starting html5-qrcode scanner...");

  html5Scanner = createHtml5Scanner("reader");

  await html5Scanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 340, height: 340 },
      rememberLastUsedCamera: true
    },
    async (decodedText) => {
      setDetectedCode(decodedText);
      setStatus("Code detected.");

      if (CONFIG.stopAfterFirstSuccess) {
        await stopScanning();
      }
    },
    () => {
      // Ignore noisy per-frame errors
    }
  );

  setStatus("Camera running. Point the camera at the label.");
}

// -------------------------
// Upload / crop flow
// -------------------------
async function openCropper() {
  const file = fileInput.files && fileInput.files[0];

  if (!file) {
    alert("Please choose an image first.");
    return;
  }

  if (isScanning) {
    await stopScanning();
  }

  currentMode = "crop";
  setViewMode("crop");
  setStatus("Adjust the crop area, then decode.");

  await cropper.loadFile(file);
}

async function decodeCropArea() {
  setStatus("Trying to decode cropped image...");

  const croppedCanvas = cropper.getCroppedCanvas();
  const decodedText = await decodeUploadedCanvas(croppedCanvas);

  if (!decodedText) {
    setStatus("");
    alert("Could not decode. Try a tighter crop or a clearer image.");
    return;
  }

  setDetectedCode(decodedText);
  setStatus("Code detected from uploaded image.");
}

function cancelCropper() {
  currentMode = "none";
  setViewMode("none");
  setStatus("");
}

// -------------------------
// Button bindings
// -------------------------
btnStart.addEventListener("click", startScanning);
btnStop.addEventListener("click", stopScanning);

btnOpenCrop.addEventListener("click", openCropper);
btnCropDecode.addEventListener("click", decodeCropArea);
btnCropAuto.addEventListener("click", () => cropper.autoCropGuess());
btnCropCancel.addEventListener("click", cancelCropper);