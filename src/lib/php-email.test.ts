import { describe, expect, it } from "vitest";
import cases from "./php-email.fixtures.json";
import { isPhpValidEmail } from "./php-email";

/** Answers captured from PHP's filter_var($email, FILTER_VALIDATE_EMAIL). */
describe("isPhpValidEmail", () => {
  it.each(cases.map((item) => [JSON.stringify(item.email), item.valid] as const))("%s is %s", (email, valid) => {
    expect(isPhpValidEmail(JSON.parse(email) as string)).toBe(valid);
  });
});
