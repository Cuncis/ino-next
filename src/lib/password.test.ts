import { describe, expect, it } from "vitest";
import { verifyLaravelPassword } from "./password";

// Made by PHP's password_hash("Rahasia123!", PASSWORD_BCRYPT), the way Laravel stores passwords
const laravelHash = "$2y$10$5eojyRjq4aI.t/DwgTHB8Oz2OkCHFiYsILCruAg5JGNm2kTUjRp2q";

describe("verifyLaravelPassword", () => {
  it("accepts the right password for a Laravel $2y$ hash", async () => {
    expect(await verifyLaravelPassword("Rahasia123!", laravelHash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyLaravelPassword("salah", laravelHash)).toBe(false);
  });
});
