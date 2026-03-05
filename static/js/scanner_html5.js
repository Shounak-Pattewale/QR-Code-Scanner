export function hasHtml5Qrcode() {
  return typeof window.Html5Qrcode !== "undefined";
}

export function createHtml5Scanner(mountId) {
  return new window.Html5Qrcode(mountId);
}