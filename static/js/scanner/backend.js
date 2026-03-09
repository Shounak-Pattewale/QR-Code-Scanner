/**
 * backend.js
 * ----------
 * Handles all communication with the Python decoder API.
 *
 * This module is the only place in the frontend that knows about the
 * backend URL or the API response shape. If the endpoint changes,
 * only this file needs updating.
 *
 * Endpoints used:
 *   POST {DECODER_API_URL}/decoder/decode
 *     — accepts multipart/form-data with an "image" field
 *     — returns { found, code, engine, type, variant }
 *
 * Dependencies: ScannerConfig (config.js)
 */

const BackendDecoder = (() => {

  /**
   * Send an image file to the backend decoder API and return the result.
   *
   * Returns null if:
   *   - DECODER_API_URL is not configured
   *   - The network request fails
   *   - The server returns a non-OK response
   *
   * On success returns the full response object:
   *   {
   *     found:   boolean,
   *     code:    string,
   *     engine:  string,   // "pyzbar" | "pylibdmtx" | "zxing"
   *     type:    string,   // e.g. "CODE128", "DataMatrix"
   *     variant: string    // preprocessing stage that succeeded
   *   }
   *
   * @param {File} file  - the original image file from the file input
   * @returns {Promise<object|null>}
   */
  async function decode(file) {
    const url = ScannerConfig.DECODER_API_URL;

    if (!url) {
      console.debug("[BackendDecoder] DECODER_API_URL not set — skipping.");
      return null;
    }

    try {
      console.debug("[BackendDecoder] Sending image to backend:", url);

      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${url}/decoder/decode`, {
        method: "POST",
        body:   formData,
      });

      if (!response.ok) {
        console.warn("[BackendDecoder] Server responded with:", response.status);
        return null;
      }

      const data = await response.json();
      return data;

    } catch (err) {
      // Network error, CORS issue, or server is down
      console.warn("[BackendDecoder] Request failed:", err.message);
      return null;
    }
  }

  /**
   * Check if the backend is reachable by hitting the ping endpoint.
   * Useful for showing a warning if the backend is unavailable.
   *
   * @returns {Promise<boolean>}
   */
  async function ping() {
    const url = ScannerConfig.DECODER_API_URL;
    if (!url) return false;

    try {
      const response = await fetch(`${url}/decoder/ping`, { method: "GET" });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  // Public API
  return { decode, ping };

})();
