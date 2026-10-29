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
