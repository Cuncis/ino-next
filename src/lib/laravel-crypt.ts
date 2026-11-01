import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Laravel's Crypt facade (Illuminate\Encryption\Encrypter, AES-256-CBC), for values the
 * Laravel app encrypted with its `encrypted` casts, such as staff 2FA secrets. Both apps
 * read and write the same rows, so both use the same APP_KEY; APP_PREVIOUS_KEYS are still
 * tried when decrypting, as Laravel does.
 *
 * Payload: base64 of `{"iv","value","mac","tag"}`, where `value` is the base64 ciphertext
 * and `mac` the hex HMAC-SHA256 of base64(iv) + value.
 */
function parseKey(text: string): Buffer {
  return text.startsWith("base64:") ? Buffer.from(text.slice(7), "base64") : Buffer.from(text, "utf8");
}

function keys(): Buffer[] {
  const current = process.env.APP_KEY;

  if (!current) {
    throw new Error("APP_KEY belum diisi di .env");
  }

  const previous = (process.env.APP_PREVIOUS_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key !== "");

  return [current, ...previous].map(parseKey);
}

function hash(iv: string, value: string, key: Buffer): string {
  return createHmac("sha256", key).update(iv + value).digest("hex");
}

/** Crypt::encryptString(): no PHP serialization. */
export function encryptString(value: string): string {
  const [key] = keys();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64");
  const ivText = iv.toString("base64");

  // JSON_UNESCAPED_SLASHES: base64 may hold "/", which PHP would otherwise write as "\/"
  return Buffer.from(JSON.stringify({ iv: ivText, value: encrypted, mac: hash(ivText, encrypted, key), tag: "" })).toString("base64");
}

/** Crypt::decryptString(); throws "The payload is invalid." / "The MAC is invalid." like Laravel. */
export function decryptString(payload: string): string {
  let parsed: { iv?: unknown; value?: unknown; mac?: unknown; tag?: unknown };

  try {
    parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  } catch {
    throw new Error("The payload is invalid.");
  }

  const { iv, value, mac } = parsed ?? {};

  if (typeof iv !== "string" || typeof value !== "string" || typeof mac !== "string" || Buffer.from(iv, "base64").length !== 16) {
    throw new Error("The payload is invalid.");
  }

  for (const key of keys()) {
    const expected = Buffer.from(hash(iv, value, key));
    const given = Buffer.from(mac);

    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      continue;
    }

    const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(iv, "base64"));

    return Buffer.concat([decipher.update(Buffer.from(value, "base64")), decipher.final()]).toString("utf8");
  }

  throw new Error("The MAC is invalid.");
}
