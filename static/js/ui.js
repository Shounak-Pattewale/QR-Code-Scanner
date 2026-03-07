/*
  UI helper functions.

  This file only handles user interface changes:
  - showing status text
  - showing detected code
  - toggling visible scanner area
  - copy feedback
*/

export function getEl(id) {
  return document.getElementById(id);
}

export function setStatus(message) {
  getEl("status").textContent = message || "";
}

export function setDetectedCode(code) {
  const value = (code || "").trim();

  getEl("codeDisplay").value = value;
  getEl("btnCopy").disabled = !value;
}

export function clearDetectedCode() {
  setDetectedCode("");
}

export function showCopiedToast() {
  const toast = getEl("toast");
  toast.classList.remove("d-none");

  setTimeout(() => {
    toast.classList.add("d-none");
  }, 900);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const input = getEl("codeDisplay");
    input.removeAttribute("readonly");
    input.select();
    document.execCommand("copy");
    input.setAttribute("readonly", "readonly");
    return true;
  }
}

export function setViewMode(mode) {
  /*
    mode:
    - "none"
    - "native"
    - "html5"
    - "crop"
  */

  const video = getEl("video");
  const reader = getEl("reader");
  const cropCanvas = getEl("cropCanvas");
  const cropControls = getEl("cropControls");

  video.style.display = mode === "native" ? "block" : "none";
  reader.style.display = mode === "html5" ? "block" : "none";
  cropCanvas.style.display = mode === "crop" ? "block" : "none";

  if (mode === "crop") {
    cropControls.classList.remove("d-none");
  } else {
    cropControls.classList.add("d-none");
  }
}