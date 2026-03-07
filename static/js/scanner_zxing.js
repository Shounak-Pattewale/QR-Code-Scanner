/*
  ZXing helper.

  ZXing is useful as a fallback scanner, especially when native detection
  is missing or weak for some devices.
*/

export function hasZXing() {
  return typeof window.ZXing !== "undefined";
}

export function makeZXingReader() {
  return new window.ZXing.BrowserMultiFormatReader();
}

export async function decodeImageElementZXing(imgEl) {
  const reader = makeZXingReader();
  const res = await reader.decodeFromImageElement(imgEl);
  return res.getText();
}

export async function decodeVideoFrameZXing(videoEl) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  await img.decode();

  return decodeImageElementZXing(img);
}