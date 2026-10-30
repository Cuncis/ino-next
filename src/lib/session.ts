import { createHash, randomBytes } from "node:crypto";
import { redis } from "./redis";

/**
 * Sign-in sessions, kept in Redis. Laravel's guards stay separate here too: a customer
 * session and a staff session use different cookies and keys and can never be swapped.
 *
 * The cookie holds a random token; Redis holds only its SHA-256, so a leaked Redis
 * dump can't be replayed as a cookie. A session lasts Laravel's SESSION_LIFETIME
 * (120 minutes) and is renewed on every use. "Remember me" keeps it for the longest a
 * browser allows instead, tied to the account's `remember_token`: Laravel replaces that
 * token on password reset, which ends every remembered session.
 */
export type Guard = "customer" | "staff";

export const SESSION_COOKIES: Record<Guard, string> = {
  customer: "inofarma_customer_session",
  staff: "inofarma_staff_session",
};

/** Laravel's SESSION_LIFETIME. */
export const SESSION_MINUTES = 120;

/** Browsers cap cookie lifetimes at 400 days. */
const REMEMBER_SECONDS = 400 * 24 * 60 * 60;

export type SessionData = {
  userId: number;
  /** The account's remember_token when the session started; only for "remember me". */
  rememberToken: string | null;
  createdAt: number;
};

function sessionKey(guard: Guard, token: string): string {
  return `session:${guard}:${createHash("sha256").update(token).digest("hex")}`;
}

function lifetimeSeconds(data: SessionData): number {
  return data.rememberToken ? REMEMBER_SECONDS : SESSION_MINUTES * 60;
}

/**
 * Cookie options for a session token. A "remember me" token starts with `r.`, so the
 * proxy can renew the cookie for the right lifetime without asking Redis.
 */
export function sessionCookieOptions(token: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: token.startsWith("r.") ? REMEMBER_SECONDS : SESSION_MINUTES * 60,
  };
}

/** Starts a session and returns the token for the cookie. */
export async function createSession(guard: Guard, userId: number, rememberToken: string | null = null): Promise<{ token: string; data: SessionData }> {
  const token = `${rememberToken ? "r" : "s"}.${randomBytes(32).toString("base64url")}`;
  const data: SessionData = { userId, rememberToken, createdAt: Date.now() };

  await redis.set(sessionKey(guard, token), JSON.stringify(data), "EX", lifetimeSeconds(data));

  return { token, data };
}

/** The session behind a cookie token, renewed for another lifetime; null when it has ended. */
export async function readSession(guard: Guard, token: string | undefined): Promise<SessionData | null> {
  if (!token) {
    return null;
  }

  const key = sessionKey(guard, token);
  const stored = await redis.get(key);

  if (!stored) {
    return null;
  }

  const data = JSON.parse(stored) as SessionData;

  await redis.expire(key, lifetimeSeconds(data));

  return data;
}

export async function destroySession(guard: Guard, token: string | undefined): Promise<void> {
  if (token) {
    await redis.del(sessionKey(guard, token));
  }
}
