// PhishGuard — in-memory fixed-window rate limiter.
// Suitable for a single-instance demo deployment; no external store required.

import { NextResponse } from 'next/server'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Keys above this size trigger a lazy sweep of expired buckets. */
const PRUNE_THRESHOLD = 512

/**
 * Fixed-window rate limiter. Returns whether the call is allowed, how many
 * calls remain in the current window and (when blocked) the retry delay.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now()

  // Lazy pruning so the map cannot grow without bound.
  if (buckets.size > PRUNE_THRESHOLD) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }

  if (!buckets.has(key) && buckets.size >= 4096) return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)) }
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 }
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return { allowed: false, remaining: 0, retryAfterSec }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterSec: 0 }
}

/** Best-effort client IP from proxy headers (x-forwarded-for first). */
export function clientIp(request: Request): string {
  return 'single-instance' // Shared demo quota; untrusted forwarding headers cannot bypass it.
}

/** 429 response with a Retry-After header. */
export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Math.round(retryAfterSec))) },
    }
  )
}
