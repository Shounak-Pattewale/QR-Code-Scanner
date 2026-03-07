/*
  ZXing helper.

  ZXing is useful as a fallback scanner, especially when native detection
  is missing or weak for some devices.
*/

export function isZXingAvailable() {
  return typeof window.ZXing !== "undefined";
}

export async function decodeFromImageElement(imageElement) {
  const reader = new window.ZXing.BrowserMultiFormatReader();
  const result = await reader.decodeFromImageElement(imageElement);
  return result.getText();
}

export async function decodeFromVideoFrame(videoElement) {
  /*
    We capture the current video frame into an offscreen canvas,
    convert that canvas to an image, and let ZXing try to decode it.
  */
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await image.decode();

  return decodeFromImageElement(image);
}