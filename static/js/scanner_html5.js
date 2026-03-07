/*
  html5-qrcode helper.

  This is our final browser-side fallback scanner.
*/

export function isHtml5QrcodeAvailable() {
  return typeof window.Html5Qrcode !== "undefined";
}

export function createHtml5Scanner(mountElementId) {
  return new window.Html5Qrcode(mountElementId);
}