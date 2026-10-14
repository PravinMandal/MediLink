/**
 * Shared in-process sliding-window rate limiter (BuildPlan Backlog C).
 *
 * Wired into: patient identifier lookup, handoff redemption, access-request
 * creation, break-glass initiation, and document downloads.
 *
 * Known limit (free-tier stack): buckets live per serverless instance, so
 * limits bound per-instance abuse and add friction but are not a
 * cross-instance control. A shared store (e.g. Redis/Upstash) is the
 * production replacement — swap `rateLimit` here without touching callers.
 */

export type RateLimitOptions = { windowMs: number; max: number };

const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, max: 10 },
): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  if (arr.length >= opts.max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  // Opportunistic cleanup so long-lived instances don't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < opts.windowMs)) buckets.delete(k);
    }
  }
  buckets.set(key, arr);
  return true;
}

export const LIMITS = {
  /** Patient ID / ABHA lookup per actor. */
  lookup: { windowMs: 60_000, max: 10 },
  /** Patient-present handoff redemption per clinician. */
  handoff: { windowMs: 60_000, max: 6 },
  /** Access-request creation per requester. */
  accessRequest: { windowMs: 60_000, max: 5 },
  /** Break-glass emergency initiations per doctor. */
  breakGlass: { windowMs: 3_600_000, max: 3 },
  /** Step-up password confirmations per user (guessing-resistant). */
  stepUp: { windowMs: 10 * 60_000, max: 5 },
  /** Email auth attempts per address (sign-in / sign-up / resend). */
  auth: { windowMs: 60_000, max: 10 },
  /** Emergency-card scans per clinician. */
  cardScan: { windowMs: 60_000, max: 20 },
  /** Source-document opens/downloads per user. */
  fileDownload: { windowMs: 60_000, max: 30 },
} as const;
