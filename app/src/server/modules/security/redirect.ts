/**
 * Shared safe-redirect guard (single definition).
 *
 * Matches "/" followed by a non-slash: blocks protocol-relative "//evil.com",
 * backslash tricks, and absolute URLs, while allowing portal paths and query
 * strings ("/portal/doctor?tab=x"). Callers in auth-actions and the sign-in
 * page must use this — never a local copy that can drift.
 */
const SAFE_NEXT = /^\/[^/](.*)?$/;

export function isSafeNext(next: string): boolean {
  return SAFE_NEXT.test(next);
}

/** Safe `next` value or the fallback (role home, sign-in, …). */
export function safeNextOr(next: string | undefined | null, fallback: string): string {
  return next && isSafeNext(next) ? next : fallback;
}
