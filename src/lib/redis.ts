import Redis from "ioredis";

// One connection reused across hot reloads in dev, like the database pool
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { lazyConnect: true });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
