import crypto from "node:crypto";

const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
};

const KEYLEN = 64;

function scryptAsync(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(value, salt, KEYLEN, SCRYPT_PARAMS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

export function isHashedPin(value: string): boolean {
  return value.startsWith("scrypt$");
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = await scryptAsync(pin, salt);
  return `scrypt$${salt}$${digest.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!isHashedPin(stored)) {
    return false;
  }

  const parts = stored.split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scryptAsync(pin, salt);

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}
