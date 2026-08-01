/**
 * Best-effort in-memory rate limiter. Serverless instances are ephemeral, so
 * this bounds bursts per warm instance rather than being a global guarantee —
 * for hard limits put a gateway/WAF in front. Kept dependency-free on purpose.
 */

const globalForRate = globalThis;
if (!globalForRate.__leetcodeRateBuckets) {
  globalForRate.__leetcodeRateBuckets = new Map();
}

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = globalForRate.__leetcodeRateBuckets;

/**
 * @param {string} key      Usually `${username}:${route}`.
 * @param {number} limit    Max requests per window.
 * @param {number} windowMs Window length in ms.
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 */
export function rateLimit(key, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, remaining: limit - entry.count, retryAfter: 0 };
}
