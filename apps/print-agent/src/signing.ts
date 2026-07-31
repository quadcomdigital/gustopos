import crypto from "node:crypto";

/**
 * Sign a JSON message for QZ Tray according to its verification protocol.
 *
 * QZ Tray's Java implementation:
 *   1. SHA-256 hash the JSON payload → hex string
 *   2. RSA-SHA512 sign the hex string with the private key
 *   3. Verify using the certificate (public key)
 *
 * This mirrors the print-bridge's /signing/sign-message endpoint exactly.
 */
export function signQzMessage(jsonPayload: string, privateKeyPem: string): string {
  const hash = crypto.createHash("sha256").update(jsonPayload).digest("hex");
  const sign = crypto.createSign("SHA512");
  sign.update(hash);
  return sign.sign(privateKeyPem, "base64");
}

/**
 * Fetch PEM data from the print-bridge over HTTP.
 * Uses the shared auth secret (X-Print-Bridge-Key header).
 */
export async function fetchBridgePem(
  bridgeBaseUrl: string,
  path: string,
  secret: string,
): Promise<string> {
  const url = `${bridgeBaseUrl.replace(/\/$/, "")}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { "X-Print-Bridge-Key": secret },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}: HTTP ${res.status}`);
    }
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}
