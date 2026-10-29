import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { generateOrderNumber } from "./order-number";

afterAll(() => db.$client.end());

describe("generateOrderNumber", () => {
  it("is INO-{branch code}-{yymmdd in Jakarta}-{5 random letters or digits}", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "2-digit", month: "2-digit", day: "2-digit" })
      .format(new Date())
      .replaceAll("-", "");
    const number = await generateOrderNumber("CB-001");

    expect(number).toMatch(new RegExp(`^INO-CB-001-${today}-[A-Z0-9]{5}$`));
  });
});
