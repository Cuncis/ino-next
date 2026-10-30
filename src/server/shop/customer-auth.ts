import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { customerPasswordResetTokens, customers, db } from "@/db";
import { sendNotification } from "@/lib/mail";
import { hashLaravelPassword, verifyLaravelPassword } from "@/lib/password";
import { createSession, destroySession, readSession, SESSION_COOKIES, sessionCookieOptions } from "@/lib/session";
import { temporarySignedUrl } from "@/lib/signed-url";

/**
 * The storefront's `customer` guard, ported from the Laravel app's
 * Shop\AuthController, App\Models\Customer and the `customers` password broker.
 * Entirely separate from staff sign-in: its own table, cookie and reset tokens.
 *
 * Soft-deleted customers can never sign in or be found (Laravel's SoftDeletes).
 */
export type Customer = typeof customers.$inferSelect;

/**
 * Bumped whenever the privacy policy text changes materially (Fase 9.2). Checkout
 * stamps the same version on the account it silently creates for a guest.
 */
export const CONSENT_VERSION = "1.0";

/** Wrong OTP guesses allowed before the code is thrown away and a new one is needed. */
export const MAX_OTP_ATTEMPTS = 5;

export const CUSTOMER_COOKIE = SESSION_COOKIES.customer;

const COOKIE = CUSTOMER_COOKIE;

const notDeleted = isNull(customers.deletedAt);

/** The signed-in customer for this request, or null. Status is the caller's to check. */
export const currentCustomer = cache(async (): Promise<Customer | null> => customerForSessionToken((await cookies()).get(COOKIE)?.value));

/** The customer behind a session cookie's token (for src/proxy.ts, which reads the cookie itself). */
export async function customerForSessionToken(token: string | undefined): Promise<Customer | null> {
  const session = await readSession("customer", token);

  if (!session) {
    return null;
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, session.userId), notDeleted))
    .limit(1);

  // a "remember me" session ends when the account's remember_token changes (password reset)
  if (!customer || (session.rememberToken !== null && session.rememberToken !== customer.rememberToken)) {
    return null;
  }

  return customer;
}

/** The "Email/No. Telepon" field accepts either: an `@` marks an email, otherwise it is a phone number. */
export async function attemptCustomerLogin(identifier: string, password: string): Promise<Customer | null> {
  const field = identifier.includes("@") ? customers.email : customers.phone;
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(field, identifier), notDeleted))
    .limit(1);

  return customer && (await verifyLaravelPassword(password, customer.password)) ? customer : null;
}

/** Signs the customer in on a fresh session (Laravel's login + session()->regenerate()). */
export async function loginCustomer(customer: Customer, remember = false): Promise<void> {
  const store = await cookies();

  await destroySession("customer", store.get(COOKIE)?.value);

  let rememberToken: string | null = null;

  if (remember) {
    // Laravel gives the account a remember_token the first time it is needed
    rememberToken = customer.rememberToken ?? randomBytes(30).toString("base64url").slice(0, 60);

    if (!customer.rememberToken) {
      await db.update(customers).set({ rememberToken }).where(eq(customers.id, customer.id));
    }
  }

  const { token } = await createSession("customer", customer.id, rememberToken);

  store.set(COOKIE, token, sessionCookieOptions(token));
}

export async function logoutCustomer(): Promise<void> {
  const store = await cookies();

  await destroySession("customer", store.get(COOKIE)?.value);
  store.delete(COOKIE);
}

export function hashPhoneOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * A fresh 6-digit phone code, valid 10 minutes; only its hash is stored. There is no
 * SMS gateway yet, so the caller logs it (and shows it outside production).
 */
export async function issuePhoneOtp(customerId: number): Promise<string> {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db
    .update(customers)
    .set({ phoneOtpCode: hashPhoneOtp(code), phoneOtpExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(customers.id, customerId));

  return code;
}

/** Checks the code and, when it matches and hasn't expired, marks the phone verified. */
export async function verifyPhoneOtp(customer: Customer, code: string): Promise<boolean> {
  if (!customer.phoneOtpCode || !customer.phoneOtpExpiresAt || customer.phoneOtpExpiresAt.getTime() < Date.now()) {
    return false;
  }

  const expected = Buffer.from(customer.phoneOtpCode);
  const given = Buffer.from(hashPhoneOtp(code));

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return false;
  }

  await db
    .update(customers)
    .set({ phoneVerifiedAt: new Date(), phoneOtpCode: null, phoneOtpExpiresAt: null, updatedAt: new Date() })
    .where(eq(customers.id, customer.id));

  return true;
}

/** Laravel's CustomerVerifyEmail notification: a signed link valid 60 minutes. */
export async function sendEmailVerification(customer: Pick<Customer, "id" | "name" | "email">): Promise<void> {
  const hash = createHash("sha1").update(customer.email).digest("hex");
  const url = temporarySignedUrl(`/verifikasi-email/${customer.id}/${hash}`, 60);

  await sendNotification(
    { email: customer.email, name: customer.name },
    {
      subject: "Verifikasi Alamat Email Anda — Inofarma",
      greeting: `Halo, ${customer.name}!`,
      introLines: ["Klik tombol di bawah untuk memverifikasi alamat email Anda."],
      action: { text: "Verifikasi Email", url },
      outroLines: ["Tautan ini berlaku selama 60 menit. Jika Anda tidak mendaftar di Inofarma, abaikan email ini."],
    },
  );
}

export function emailHash(email: string): string {
  return createHash("sha1").update(email).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return hashLaravelPassword(password);
}

/**
 * The `customers` password broker (config/auth.php: tokens expire after 60 minutes,
 * one request per 60 seconds). Tokens are stored bcrypt-hashed like Laravel's
 * DatabaseTokenRepository, so a link either app issued works in the other. The status
 * strings are Laravel's untranslated `passwords.*` messages, as customers saw them.
 */
export const PASSWORD_STATUS = {
  user: "We can't find a user with that email address.",
  throttled: "Please wait before retrying.",
  token: "This password reset token is invalid.",
} as const;

const RESET_EXPIRE_MINUTES = 60;
const RESET_THROTTLE_SECONDS = 60;

async function findByEmail(email: string): Promise<Customer | null> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.email, email), notDeleted))
    .limit(1);

  return customer ?? null;
}

export async function sendPasswordResetLink(email: string): Promise<"sent" | keyof typeof PASSWORD_STATUS> {
  const customer = await findByEmail(email);

  if (!customer) {
    return "user";
  }

  const [existing] = await db
    .select({ createdAt: customerPasswordResetTokens.createdAt })
    .from(customerPasswordResetTokens)
    .where(eq(customerPasswordResetTokens.email, customer.email))
    .limit(1);

  if (existing?.createdAt && existing.createdAt.getTime() + RESET_THROTTLE_SECONDS * 1000 > Date.now()) {
    return "throttled";
  }

  const token = randomBytes(32).toString("hex");

  await db.delete(customerPasswordResetTokens).where(eq(customerPasswordResetTokens.email, customer.email));
  await db.insert(customerPasswordResetTokens).values({ email: customer.email, token: await hashLaravelPassword(token), createdAt: new Date() });

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const url = `${base}/new-password?${new URLSearchParams({ token, email: customer.email })}`;

  await sendNotification(
    { email: customer.email, name: customer.name },
    {
      subject: "Pemulihan Kata Sandi — Inofarma",
      greeting: `Halo, ${customer.name}!`,
      introLines: ["Klik tombol di bawah untuk mengatur ulang kata sandi Anda."],
      action: { text: "Atur Ulang Kata Sandi", url },
      outroLines: ["Tautan ini berlaku selama 60 menit. Jika Anda tidak meminta ini, abaikan email ini."],
    },
  );

  return "sent";
}

/** Sets the new password when the token is valid; a new remember_token ends remembered sessions. */
export async function resetPassword(email: string, token: string, password: string): Promise<"reset" | "user" | "token"> {
  const customer = await findByEmail(email);

  if (!customer) {
    return "user";
  }

  const [record] = await db
    .select()
    .from(customerPasswordResetTokens)
    .where(eq(customerPasswordResetTokens.email, customer.email))
    .limit(1);

  const expired = !record?.createdAt || record.createdAt.getTime() + RESET_EXPIRE_MINUTES * 60 * 1000 < Date.now();

  if (!record || expired || !(await bcrypt.compare(token, record.token.replace(/^\$2y\$/, "$2b$")))) {
    return "token";
  }

  await db
    .update(customers)
    .set({ password: await hashLaravelPassword(password), rememberToken: randomBytes(45).toString("base64url").slice(0, 60), updatedAt: new Date() })
    .where(eq(customers.id, customer.id));
  await db.delete(customerPasswordResetTokens).where(eq(customerPasswordResetTokens.email, customer.email));

  return "reset";
}
