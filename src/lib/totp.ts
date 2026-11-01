import { createHmac, randomInt } from "node:crypto";

/**
 * Time-based one-time passwords, compatible with pragmarx/google2fa as the Laravel app
 * uses it: base32 secrets of 32 characters, SHA-1, 6 digits, 30-second steps, and a code
 * accepted one step either side of now.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const WINDOW = 1;

/** Google2FA::generateSecretKey(). */
export function generateSecret(length = 32): string {
  return Array.from({ length }, () => BASE32[randomInt(32)]).join("");
}

function base32Decode(secret: string): Buffer {
  let bits = "";

  for (const character of secret.toUpperCase().replace(/=+$/, "")) {
    const index = BASE32.indexOf(character);

    if (index === -1) {
      throw new Error("Invalid characters in the base32 string.");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = bits.match(/.{8}/g) ?? [];

  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
}

/** The code for one 30-second step (Google2FA::oathTotp()). */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);

  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;

  return String(binary).padStart(6, "0");
}

/** Google2FA::verifyKey(): the code for now, or one step before or after. */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  const step = Math.floor(now / 1000 / PERIOD);

  for (let candidate = step - WINDOW; candidate <= step + WINDOW; candidate++) {
    if (totpAt(secret, candidate) === code) {
      return true;
    }
  }

  return false;
}

/** The otpauth:// link an authenticator app scans (Google2FA::getQRCodeUrl()). */
export function otpauthUrl(company: string, holder: string, secret: string): string {
  const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  return `otpauth://totp/${encode(company)}:${encode(holder)}?secret=${secret}&issuer=${encode(company)}&algorithm=SHA1&digits=6&period=30`;
}
