// Uses the global ZXing loaded via vendor script
export function hasZXing() {
  return typeof window.ZXing !== "undefined";
}

export function makeZXingReader() {
  // MultiFormat reader can decode many formats
  return new window.ZXing.BrowserMultiFormatReader();
}

export async function decodeImageElementZXing(imgEl) {
  const reader = makeZXingReader();
  const res = await reader.decodeFromImageElement(imgEl);
  return res.getText();
}

// Live decode from video: ZXing has decodeFromVideoDevice but it manages camera.
// Since we already manage camera, we do a frame-grab loop to an offscreen canvas.
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