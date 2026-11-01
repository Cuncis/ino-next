import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, passwordResetTokens, users } from "@/db";
import { isAdminLocale, type AdminLocale } from "@/lib/admin-i18n";
import { decryptString } from "@/lib/laravel-crypt";
import { sendNotification } from "@/lib/mail";
import { hashLaravelPassword, verifyLaravelPassword } from "@/lib/password";
import { rateLimiter } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";
import { createSession, destroySession, readSession, SESSION_COOKIES, sessionCookieOptions, writeSession, type SessionData } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { auditLog } from "@/server/audit";

/**
 * Staff sign-in for the admin panel, ported from Admin\AdminAuthController,
 * TwoFactorChallengeController, Requests\Admin\LoginRequest and
 * Middleware\EnsureAdminIsAuthenticated. Staff (`users`, Laravel's `web` guard) never
 * share a session with customers.
 */
export type Staff = typeof users.$inferSelect;

export const STAFF_COOKIE = SESSION_COOKIES.staff;
/** A password accepted, the 2FA code still to come (Laravel's `admin_2fa.user_id`). */
export const PENDING_2FA_COOKIE = "inofarma_staff_2fa";
/** Where a signed-out visitor was going (Laravel's `admin_intended`). */
export const ADMIN_INTENDED_COOKIE = "inofarma_admin_intended";

const IDLE_TIMEOUT_MINUTES = 30;
const MAX_SESSION_HOURS = 12;
const LOGIN_MAX_ATTEMPTS = 5;
const TWO_FACTOR_MAX_ATTEMPTS = 5;
/** Laravel's session lifetime, for the pending 2FA step. */
const PENDING_SECONDS = 120 * 60;

type StaffMeta = { loggedInAt: number; lastActivityAt: number; locale: AdminLocale };

const SOFT_DELETE = isNull(users.deletedAt);

export async function findStaff(id: number): Promise<Staff | null> {
  const [staff] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), SOFT_DELETE))
    .limit(1);

  return staff ?? null;
}

function meta(data: SessionData): StaffMeta {
  const stored = (data.meta ?? {}) as Partial<StaffMeta>;

  return { loggedInAt: stored.loggedInAt ?? 0, lastActivityAt: stored.lastActivityAt ?? 0, locale: isAdminLocale(stored.locale) ? stored.locale : "id" };
}

export type StaffCheck =
  | { staff: Staff; data: SessionData; locale: AdminLocale }
  | { failure: "guest" }
  | { failure: "ended"; message: string };

/**
 * EnsureAdminIsAuthenticated: the signed-in, active staff member, or why not. An
 * account turned off, a session older than 12 hours, or one idle for 30 minutes is
 * ended (the caller deletes the cookie). Otherwise this counts as activity.
 */
export async function checkStaffSession(token: string | undefined, now = Date.now()): Promise<StaffCheck> {
  const data = await readSession("staff", token);
  const staff = data ? await findStaff(data.userId) : null;

  if (!data || !staff || !token) {
    return { failure: "guest" };
  }

  const { loggedInAt, lastActivityAt, locale } = meta(data);
  let message: string | null = null;

  if (!staff.isActive) {
    message = "Akun Anda telah dinonaktifkan.";
  } else if (!loggedInAt || now - loggedInAt >= MAX_SESSION_HOURS * 3600_000) {
    message = "Sesi berakhir. Silakan masuk kembali.";
  } else if (lastActivityAt && now - lastActivityAt >= IDLE_TIMEOUT_MINUTES * 60_000) {
    message = "Sesi berakhir karena tidak ada aktivitas selama 30 menit.";
  }

  if (message) {
    await destroySession("staff", token);

    return { failure: "ended", message };
  }

  await writeSession("staff", token, { ...data, meta: { loggedInAt, lastActivityAt: now, locale } });

  return { staff, data, locale };
}

/** The signed-in staff member for this request (pages; src/proxy.ts already checked the session). */
export const currentStaff = cache(async (): Promise<{ staff: Staff; locale: AdminLocale } | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  const data = await readSession("staff", token);
  const staff = data ? await findStaff(data.userId) : null;

  return data && staff && staff.isActive ? { staff, locale: meta(data).locale } : null;
});

/** AdminAuthController::establishSession(): never "remember me". */
export async function loginStaff(staff: Staff, locale: AdminLocale = "id"): Promise<void> {
  const now = Date.now();
  const store = await cookies();

  await destroySession("staff", store.get(STAFF_COOKIE)?.value);

  const { token, data } = await createSession("staff", staff.id);

  await writeSession("staff", token, { ...data, meta: { loggedInAt: now, lastActivityAt: now, locale } satisfies StaffMeta });
  store.set(STAFF_COOKIE, token, sessionCookieOptions(token));

  await db.update(users).set({ lastLoginAt: new Date(now), updatedAt: new Date(now) }).where(eq(users.id, staff.id));
  await auditLog({ action: "login", auditable: { type: "App\\Models\\User", id: staff.id }, userId: staff.id, branchId: staff.branchId });
}

export async function logoutStaff(): Promise<void> {
  const store = await cookies();

  await destroySession("staff", store.get(STAFF_COOKIE)?.value);
  store.delete(STAFF_COOKIE);
}

/** LocaleController: the language for the rest of this session. */
export async function setStaffLocale(locale: AdminLocale): Promise<void> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  const data = await readSession("staff", token);

  if (token && data) {
    await writeSession("staff", token, { ...data, meta: { ...meta(data), locale } });
  }
}

/**
 * LoginRequest::attemptCredentials(): the account, or the message to show under the
 * email field. Five failures from one IP lock it out for a minute.
 */
export async function attemptStaffCredentials(email: string, password: string, ip: string): Promise<Staff | string> {
  const key = `admin-login:${ip}`;

  if (await rateLimiter.tooManyAttempts(key, LOGIN_MAX_ATTEMPTS)) {
    return `Terlalu banyak percobaan. Coba lagi dalam ${await rateLimiter.availableIn(key)} detik.`;
  }

  const [staff] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), SOFT_DELETE))
    .limit(1);

  if (!staff || !(await verifyLaravelPassword(password, staff.password))) {
    await rateLimiter.hit(key);

    return "Email atau kata sandi salah.";
  }

  if (!staff.isActive) {
    await rateLimiter.hit(key);

    return "Akun Anda telah dinonaktifkan.";
  }

  await rateLimiter.clear(key);

  return staff;
}

/** User::hasEnabledTwoFactor(): a secret, and confirmed. */
export function hasEnabledTwoFactor(staff: Pick<Staff, "twoFactorSecret" | "twoFactorConfirmedAt">): boolean {
  return staff.twoFactorSecret !== null && staff.twoFactorConfirmedAt !== null;
}

const pendingKey = (token: string) => `staff-2fa:${createHash("sha256").update(token).digest("hex")}`;

export async function startTwoFactorChallenge(staff: Staff): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await redis.set(pendingKey(token), String(staff.id), "EX", PENDING_SECONDS);
  (await cookies()).set(PENDING_2FA_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: PENDING_SECONDS });
}

/** The staff member waiting for their 2FA code, if any. */
export async function pendingTwoFactorUserId(token: string | undefined): Promise<number | null> {
  const stored = token ? await redis.get(pendingKey(token)) : null;

  return stored ? Number(stored) : null;
}

async function endTwoFactorChallenge(): Promise<void> {
  const store = await cookies();
  const token = store.get(PENDING_2FA_COOKIE)?.value;

  if (token) {
    await redis.del(pendingKey(token));
  }

  store.delete(PENDING_2FA_COOKIE);
}

/** The decrypted 2FA secret, or null when there is none (or it can't be read). */
export function twoFactorSecret(staff: Pick<Staff, "twoFactorSecret">): string | null {
  try {
    return staff.twoFactorSecret ? decryptString(staff.twoFactorSecret) : null;
  } catch {
    return null;
  }
}

export function recoveryCodes(staff: Pick<Staff, "twoFactorRecoveryCodes">): string[] {
  try {
    const codes: unknown = staff.twoFactorRecoveryCodes ? JSON.parse(decryptString(staff.twoFactorRecoveryCodes)) : [];

    return Array.isArray(codes) ? codes.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}

/**
 * TwoFactorChallengeController::store(): finishes the sign-in with an authenticator code
 * or a recovery code (which is then used up). Five wrong codes lock the account's
 * pending sign-in for a minute: a 6-digit code has only a million values.
 */
export async function completeTwoFactorChallenge(staff: Staff, input: string): Promise<true | string> {
  const code = input.replaceAll(" ", "");
  const key = `admin-2fa:${staff.id}`;

  if (await rateLimiter.tooManyAttempts(key, TWO_FACTOR_MAX_ATTEMPTS)) {
    return `Terlalu banyak percobaan. Coba lagi dalam ${await rateLimiter.availableIn(key)} detik.`;
  }

  const codes = recoveryCodes(staff);
  const secret = twoFactorSecret(staff);
  let valid = false;

  if (codes.includes(code)) {
    const { encryptString } = await import("@/lib/laravel-crypt");

    await db
      .update(users)
      .set({ twoFactorRecoveryCodes: encryptString(JSON.stringify(codes.filter((recovery) => recovery !== code))), updatedAt: new Date() })
      .where(eq(users.id, staff.id));
    valid = true;
  } else if (secret && verifyTotp(secret, code)) {
    valid = true;
  }

  if (!valid) {
    await rateLimiter.hit(key);

    return "Kode tidak valid.";
  }

  await rateLimiter.clear(key);
  await endTwoFactorChallenge();
  await loginStaff(staff);

  return true;
}

/**
 * The `users` password broker (config/auth.php: `password_reset_tokens`, 60-minute tokens,
 * one request a minute). Laravel's untranslated `passwords.*` statuses, as staff saw them.
 */
export const STAFF_PASSWORD_STATUS = {
  user: "We can't find a user with that email address.",
  throttled: "Please wait before retrying.",
  token: "This password reset token is invalid.",
} as const;

async function staffByEmail(email: string): Promise<Staff | null> {
  const [staff] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), SOFT_DELETE))
    .limit(1);

  return staff ?? null;
}

export async function sendStaffPasswordResetLink(email: string): Promise<"sent" | keyof typeof STAFF_PASSWORD_STATUS> {
  const staff = await staffByEmail(email);

  if (!staff) {
    return "user";
  }

  const [existing] = await db.select({ createdAt: passwordResetTokens.createdAt }).from(passwordResetTokens).where(eq(passwordResetTokens.email, staff.email)).limit(1);

  if (existing?.createdAt && existing.createdAt.getTime() + 60_000 > Date.now()) {
    return "throttled";
  }

  const token = randomBytes(32).toString("hex");

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, staff.email));
  await db.insert(passwordResetTokens).values({ email: staff.email, token: await hashLaravelPassword(token), createdAt: new Date() });

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  // App\Notifications\AdminResetPassword
  await sendNotification(
    { email: staff.email },
    {
      subject: "Pemulihan Kata Sandi — Inofarma Admin",
      greeting: `Halo, ${staff.name}!`,
      introLines: ["Klik tombol di bawah untuk mengatur ulang kata sandi Anda."],
      action: { text: "Atur Ulang Kata Sandi", url: `${base}/admin/atur-ulang-sandi/${token}?${new URLSearchParams({ email: staff.email })}` },
      outroLines: ["Tautan ini berlaku selama 60 menit. Jika Anda tidak meminta ini, abaikan email ini."],
    },
  );

  return "sent";
}

export async function resetStaffPassword(email: string, token: string, password: string): Promise<"reset" | "user" | "token"> {
  const staff = await staffByEmail(email);

  if (!staff) {
    return "user";
  }

  const [record] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.email, staff.email)).limit(1);
  const expired = !record?.createdAt || record.createdAt.getTime() + 60 * 60_000 < Date.now();

  if (!record || expired || !(await bcrypt.compare(token, record.token.replace(/^\$2y\$/, "$2b$")))) {
    return "token";
  }

  await db
    .update(users)
    .set({ password: await hashLaravelPassword(password), rememberToken: randomBytes(45).toString("base64url").slice(0, 60), updatedAt: new Date() })
    .where(eq(users.id, staff.id));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, staff.email));

  return "reset";
}
