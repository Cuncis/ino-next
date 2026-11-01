import { describe, expect, it } from "vitest";
import { dokuDigest, dokuSign, dokuVerify } from "./doku-signature";

// Reference values from the Laravel app's DokuSignature (php artisan tinker)
const body = '{"order":{"amount":222660,"invoice_number":"INO-CB-014-261031-ABCDE"}}';

describe("DOKU signature", () => {
  it("digests and signs a POST like the Laravel app", () => {
    expect(dokuDigest(body)).toBe("WQmGM3YX2UGO+bm4+rOtmswCRC0Ymkds+gL93LBkdFU=");
    expect(dokuSign("BRN-0001", "req-1", "2026-10-31T01:02:03Z", "/checkout/v1/payment", dokuDigest(body), "secret-key")).toBe(
      "HMACSHA256=Pep2F52DQ7p/tFQvyg1ccl7CkZnf3nqOnXMAJW1el1s=",
    );
  });

  it("leaves the digest out for a GET", () => {
    expect(dokuSign("BRN-0001", "req-2", "2026-10-31T01:02:03Z", "/orders/v1/status/INV-1", null, "secret-key")).toBe(
      "HMACSHA256=CXlJWJXlf1NjLsPlSMhOqvikSfAVI/9/lSJfORE9r1A=",
    );
  });

  it("verifies a notification only for our client id and an untouched body", () => {
    const headers = {
      "client-id": "BRN-0001",
      "request-id": "req-1",
      "request-timestamp": "2026-10-31T01:02:03Z",
      signature: "HMACSHA256=Pep2F52DQ7p/tFQvyg1ccl7CkZnf3nqOnXMAJW1el1s=",
    };

    expect(dokuVerify(headers, body, "/checkout/v1/payment", "BRN-0001", "secret-key")).toBe(true);
    expect(dokuVerify(headers, body.replace("222660", "1"), "/checkout/v1/payment", "BRN-0001", "secret-key")).toBe(false);
    expect(dokuVerify(headers, body, "/checkout/v1/payment", "BRN-0002", "secret-key")).toBe(false);
    expect(dokuVerify({ ...headers, signature: undefined }, body, "/checkout/v1/payment", "BRN-0001", "secret-key")).toBe(false);
  });
});

describe("mapDokuStatus", () => {
  it("maps DOKU's statuses to payments.status and ignores anything else", async () => {
    const { mapDokuStatus } = await import("./doku-payment");

    expect(["SUCCESS", "FAILED", "TIMEOUT", "EXPIRED", "REFUNDED", "PENDING", "REDIRECT", "success", null].map(mapDokuStatus)).toEqual([
      "success",
      "failed",
      "failed",
      "expired",
      "refunded",
      "pending",
      "pending",
      null,
      null,
    ]);
  });
});
