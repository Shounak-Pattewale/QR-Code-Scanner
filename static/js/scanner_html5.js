/*
  html5-qrcode helper.

  This is our final browser-side fallback scanner.
*/

export function hasHtml5Qrcode() {
  return typeof window.Html5Qrcode !== "undefined";
}

export function createHtml5Scanner(mountId) {
  return new window.Html5Qrcode(mountId);
}