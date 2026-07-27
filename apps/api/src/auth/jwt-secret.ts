import crypto from "node:crypto";

const MIN_SECRET_LENGTH = 32;

let cachedSecret: string | undefined;

export function getJwtSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    if (process.env.NODE_ENV === "production" && fromEnv.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`,
      );
    }
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  // Dev-only: generate random secret per startup
  const devSecret = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[SECURITY] Using auto-generated dev JWT_SECRET. Set JWT_SECRET env var for persistence across restarts.",
  );
  cachedSecret = devSecret;
  return cachedSecret;
}
