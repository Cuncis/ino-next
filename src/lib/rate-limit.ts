import { clientIp } from "./http";
import { redis } from "./redis";

/**
 * Laravel's `throttle:{maxAttempts},{decayMinutes}` middleware: at most that many
 * requests per client per window, counted in Redis so every server process shares them.
 * Returns the 429 response to send back, or null when the request may go ahead.
 */
export async function throttle(name: string, maxAttempts: number, decayMinutes: number): Promise<Response | null> {
  const key = `throttle:${name}:${await clientIp()}`;
  const decaySeconds = decayMinutes * 60;
  const [[, attempts], [, ttl]] = (await redis.multi().incr(key).ttl(key).exec()) as [[null, number], [null, number]];

  if (ttl < 0) {
    await redis.expire(key, decaySeconds);
  }

  if (attempts > maxAttempts) {
    const retryAfter = ttl > 0 ? ttl : decaySeconds;

    return Response.json(
      { message: "Too Many Attempts." },
      { status: 429, headers: { "Retry-After": String(retryAfter), "X-RateLimit-Limit": String(maxAttempts), "X-RateLimit-Remaining": "0" } },
    );
  }

  return null;
}

/**
 * Laravel's RateLimiter facade, for limits a controller manages itself (failed
 * sign-ins, wrong OTP codes): attempts counted per key, forgotten after the decay.
 */
export const rateLimiter = {
  async attempts(key: string): Promise<number> {
    return Number((await redis.get(`limiter:${key}`)) ?? 0);
  },

  /** Laravel's tooManyAttempts(): true once `maxAttempts` have been made. */
  async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    return (await rateLimiter.attempts(key)) >= maxAttempts;
  },

  /** Counts one attempt; the window starts at the first one. */
  async hit(key: string, decaySeconds = 60): Promise<number> {
    const [[, attempts]] = (await redis.multi().incr(`limiter:${key}`).expire(`limiter:${key}`, decaySeconds, "NX").exec()) as [[null, number]];

    return attempts;
  },

  /** Seconds until the key is forgotten. */
  async availableIn(key: string): Promise<number> {
    return Math.max(await redis.ttl(`limiter:${key}`), 0);
  },

  async clear(key: string): Promise<void> {
    await redis.del(`limiter:${key}`);
  },
};
