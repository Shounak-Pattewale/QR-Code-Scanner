/*
  UI helper functions.

  This file only handles user interface changes:
  - showing status text
  - showing detected code
  - toggling visible scanner area
  - copy feedback
*/

export function $(id) { return document.getElementById(id); }

export function setStatus(msg) {
  $("status").textContent = msg || "";
}

export function setCode(code) {
  const v = (code || "").trim();
  $("codeDisplay").value = v;
  $("btnCopy").disabled = !v;
}

export function showCopiedToast() {
  const t = $("toast");
  t.classList.remove("d-none");
  setTimeout(() => t.classList.add("d-none"), 900);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const inp = $("codeDisplay");
    inp.removeAttribute("readonly");
    inp.select();
    document.execCommand("copy");
    inp.setAttribute("readonly", "readonly");
    return true;
  }
}

export function setScanUiMode(mode) {
  const video = $("video");
  const reader = $("reader");
  const cropCanvas = $("cropCanvas");
  const cropControls = $("cropControls");

  video.style.display = (mode === "native") ? "block" : "none";
  reader.style.display = (mode === "html5") ? "block" : "none";
  cropCanvas.style.display = (mode === "crop") ? "block" : "none";
  cropControls.classList.toggle("d-none", mode !== "crop");
}