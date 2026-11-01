import { randomInt } from "node:crypto";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Laravel's Str::random($length): letters and digits from a secure source. */
export function randomString(length: number): string {
  return Array.from({ length }, () => ALPHANUMERIC[randomInt(ALPHANUMERIC.length)]).join("");
}
