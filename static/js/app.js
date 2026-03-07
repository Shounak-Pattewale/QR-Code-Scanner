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
const cameraInput = getEl("cameraInput");
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
// Device helpers
// -------------------------
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

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

  // On iPhone, native and ZXing live paths can be less stable.
  // Prefer html5-qrcode earlier there because it previously worked better.
  if (!isIOS() && CONFIG.preferNative && isNativeDetectorAvailable()) {
    try {
      await startNativeScanner();
      return;
    } catch (error) {
      console.error("Native scanner failed:", error);
      await stopScanning(false);
    }
  }

  if (!isIOS() && isZXingAvailable()) {
    try {
      await startZXingScanner();
      return;
    } catch (error) {
      console.error("ZXing live scanner failed:", error);
      await stopScanning(false);
    }
  }

  if (isHtml5QrcodeAvailable()) {
    try {
      await startHtml5Scanner();
      return;
    } catch (error) {
      console.error("html5-qrcode scanner failed:", error);
      await stopScanning(false);
    }
  }

  // On iPhone, if html5-qrcode also fails, try native last.
  if (isIOS() && CONFIG.preferNative && isNativeDetectorAvailable()) {
    try {
      await startNativeScanner();
      return;
    } catch (error) {
      console.error("Native scanner failed on iOS fallback:", error);
      await stopScanning(false);
    }
  }

  await stopScanning(false);
  alert("Camera could not be started on this device/browser. Try Upload Image or Take Photo.");
}

async function stopScanning(showMessage = true) {
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

  if (showMessage) {
    setStatus("Scanner stopped.");
  }
}

async function startNativeScanner() {
  currentMode = "native";
  setViewMode("native");
  setStatus("Starting camera...");

  nativeDetector = await createNativeDetector();
  mediaStream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);

  video.srcObject = mediaStream;

  // Important for iPhone / mobile browsers
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "true");
  video.muted = true;

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
      // ignore frame-level errors
    }

    animationId = requestAnimationFrame(scanLoop);
  };

  animationId = requestAnimationFrame(scanLoop);
  setStatus("Camera running. Point the camera at the label.");
}

async function startZXingScanner() {
  currentMode = "native";
  setViewMode("native");
  setStatus("Starting camera...");

  mediaStream = await navigator.mediaDevices.getUserMedia(CONFIG.cameraConstraints);

  video.srcObject = mediaStream;
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "true");
  video.muted = true;

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
      // ignore frame-level errors
    }

    animationId = requestAnimationFrame(scanLoop);
  };

  animationId = requestAnimationFrame(scanLoop);
  setStatus("Camera running. Point the camera at the label.");
}

async function startHtml5Scanner() {
  currentMode = "html5";
  setViewMode("html5");
  setStatus("Starting camera...");

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
      // ignore noisy frame errors
    }
  );

  setStatus("Camera running. Point the camera at the label.");
}

// -------------------------
// Upload / crop flow
// -------------------------
async function openCropper() {
  const file =
    (cameraInput && cameraInput.files && cameraInput.files[0]) ||
    (fileInput && fileInput.files && fileInput.files[0]);

  if (!file) {
    alert("Please choose an image or take a photo first.");
    return;
  }

  if (isScanning) {
    await stopScanning(false);
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
btnStop.addEventListener("click", () => stopScanning());

btnOpenCrop.addEventListener("click", openCropper);
btnCropDecode.addEventListener("click", decodeCropArea);
btnCropAuto.addEventListener("click", () => cropper.autoCropGuess());
btnCropCancel.addEventListener("click", cancelCropper);