import { afterAll, describe, expect, it } from "vitest";
import { redis } from "./redis";
import { createSession, destroySession, readSession, sessionCookieOptions } from "./session";

const tokens: string[] = [];

afterAll(async () => {
  await Promise.all(tokens.map((token) => destroySession("customer", token)));
  redis.disconnect();
});

describe("sessions", () => {
  it("stores a session per guard and only under the token's hash", async () => {
    const { token } = await createSession("customer", 42);

    tokens.push(token);

    expect(await readSession("customer", token)).toMatchObject({ userId: 42, rememberToken: null });
    expect(await readSession("staff", token)).toBeNull();
    expect(await redis.keys(`*${token}*`)).toEqual([]);
  });

  it("lasts 120 minutes, or long with remember me", async () => {
    const plain = await createSession("customer", 1);
    const remembered = await createSession("customer", 1, "remember-token");

    tokens.push(plain.token, remembered.token);

    expect(sessionCookieOptions(plain.token).maxAge).toBe(7200);
    expect(sessionCookieOptions(remembered.token).maxAge).toBe(400 * 24 * 60 * 60);
  });

  it("ends when destroyed", async () => {
    const { token } = await createSession("customer", 7);

    await destroySession("customer", token);

    expect(await readSession("customer", token)).toBeNull();
    expect(await readSession("customer", undefined)).toBeNull();
  });
});
