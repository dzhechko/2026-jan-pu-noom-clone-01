import { redis } from "./redis";

export interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowMinutes * 60 * 1000;

  try {
    const fullKey = `rate_limit:${key}`;
    const windowStart = now - windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(fullKey, 0, windowStart);
    pipeline.zadd(fullKey, now, String(now));
    pipeline.zcard(fullKey);
    pipeline.expire(fullKey, config.windowMinutes * 60);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;
    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = new Date(now + windowMs);

    if (!allowed) {
      await redis.zrem(fullKey, String(now));
    }

    return { allowed, remaining, resetAt };
  } catch (err) {
    console.error("[rate-limit] Redis unavailable, allowing request:", err);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + windowMs),
    };
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

export function rateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}
