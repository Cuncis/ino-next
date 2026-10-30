import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { customerPasswordResetTokens, customers, db } from "@/db";
import { verifyLaravelPassword } from "@/lib/password";

// capture the reset email instead of logging it
const sent: { url: string }[] = [];

vi.mock("@/lib/mail", () => ({
  sendNotification: async (_to: unknown, mail: { action: { url: string } }) => {
    sent.push({ url: mail.action.url });
  },
}));

const { attemptCustomerLogin, resetPassword, sendPasswordResetLink, PASSWORD_STATUS } = await import("./customer-auth");

const email = `zz-test-reset-${Date.now()}@example.com`;
let customerId: number;

afterAll(async () => {
  await db.delete(customerPasswordResetTokens).where(eq(customerPasswordResetTokens.email, email));
  await db.delete(customers).where(eq(customers.id, customerId));
  await db.$client.end();
});

describe("password reset (the customers broker)", () => {
  it("emails a link, accepts its token once, and replaces the remember_token", async () => {
    const [customer] = await db
      .insert(customers)
      .values({ code: `ZZ-${Date.now()}`, name: "Tes Reset", email, password: "$2y$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinval", status: "aktif", rememberToken: "lama" })
      .returning();

    customerId = customer.id;

    expect(await sendPasswordResetLink("tidak-ada@example.com")).toBe("user");
    expect(await sendPasswordResetLink(email)).toBe("sent");
    // one request per 60 seconds
    expect(await sendPasswordResetLink(email)).toBe("throttled");

    const link = new URL(sent[0].url);

    expect(link.pathname).toBe("/new-password");
    expect(link.searchParams.get("email")).toBe(email);

    const token = link.searchParams.get("token")!;

    expect(await resetPassword(email, "salah", "kata-sandi-baru")).toBe("token");
    expect(await resetPassword(email, token, "kata-sandi-baru")).toBe("reset");
    expect(await resetPassword(email, token, "lagi-lagi")).toBe("token");

    const [updated] = await db.select().from(customers).where(eq(customers.id, customerId));

    expect(updated.password.startsWith("$2y$12$")).toBe(true);
    expect(await verifyLaravelPassword("kata-sandi-baru", updated.password)).toBe(true);
    expect(updated.rememberToken).not.toBe("lama");
    expect((await attemptCustomerLogin(email, "kata-sandi-baru"))?.id).toBe(customerId);
    expect(await attemptCustomerLogin(email.toUpperCase(), "kata-sandi-baru")).not.toBeNull();
  });

  it("uses Laravel's untranslated broker messages", () => {
    expect(PASSWORD_STATUS.user).toBe("We can't find a user with that email address.");
  });
});
