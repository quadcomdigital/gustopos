// ─── Web Push / VAPID configuration ────────────────────────────────────────
//
// Keys come from the environment (generate with `npx web-push generate-vapid-keys`)
// and are shared by every tenant: they identify THIS deployment to the push
// services (FCM/APNs), they do not carry tenant data.
//
// Missing keys are NOT fatal — the API simply reports `configured: false` and
// the UI explains how to set them, so a fresh dev environment keeps booting.

const cached: { publicKey?: string | null; privateKey?: string | null; subject?: string } = {};

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

function readKey(name: "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY"): string | null {
  const cacheKey = name === "VAPID_PUBLIC_KEY" ? "publicKey" : "privateKey";
  if (cached[cacheKey] !== undefined) {
    return cached[cacheKey];
  }

  const raw = process.env[name]?.trim();
  if (!raw) {
    cached[cacheKey] = null;
    return null;
  }

  // web-push fails with a cryptic error on malformed keys; surface it early.
  if (!BASE64URL_RE.test(raw)) {
    console.warn(`[push] ${name} is not a base64url string — Web Push disabled`);
    cached[cacheKey] = null;
    return null;
  }

  cached[cacheKey] = raw;
  return raw;
}

export function getVapidPublicKey(): string | null {
  return readKey("VAPID_PUBLIC_KEY");
}

export function getVapidPrivateKey(): string | null {
  return readKey("VAPID_PRIVATE_KEY");
}

export function getVapidSubject(): string {
  const fromEnv = process.env.VAPID_SUBJECT?.trim();
  return fromEnv || "mailto:admin@example.com";
}

export function isPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
