# Learnings

## 2026-09-09 — MediLink deep audit + hardening session
- Supabase Storage REST: never `encodeURIComponent` a full `a/b` key — the sign endpoint binds the `%2F` path into the token while object endpoints decode it, so every signed-URL fetch 400s with `InvalidSignature`. Encode each segment separately. Verified live: 400 → 200.
- `text/plain` without charset is sniffed (Chrome guessed Latin-1 on UTF-8 reports → mojibake). Label `text/plain; charset=utf-8` at PUT time (Supabase) and on the file-route response (local path). Keep the DB mimeType column canonical.
- `backdrop-filter` cannot sample cross-origin iframes: any translucent sticky bar over a document preview ghosts text through. Sticky control bars over foreign content must be fully opaque.
- `redirect()` in a server component returns HTTP 200 + shell to curl (client-side RedirectBoundary bounce). curl-based checks must assert in-browser, or check the boundary markers — a 200 + empty `<main>` is NOT proof of rendering.
- PGlite (local dev) loses un-checkpointed writes on `kill -9` (recent sessions vanish; old data survives). Always stop dev with SIGTERM (lets the graceful-close handler checkpoint). Never `pkill -9 next-server` — it also matches your own shell; use `pkill -f "[n]ext-server"`.
- Never pipe `next dev` through `head`: when head exits, log writes EPIPE and the server wedges at high CPU. Log to a file instead.
- tsx scripts opening the same PGlite dir as a running dev server do NOT see its data — verify DB state over HTTP, not sidecar scripts.
- verify.mjs checks rot when pages are intentionally redesigned (ID-only lookup replaced name search). Treat suite FAILs as "stale check or real regression?" — this time stale, converted into a privacy-positive assertion.
- RBAC pattern that works: `requireRole()` helper redirecting to role home + service-layer re-enforcement (verified-practitioner, ownership). Added to doctor/emergency, inbox, patients; patients/[id] already had it inline; admin pages already gated.
- Full consent lifecycle verified in-browser: handoff code → access request → patient grant (scoped) → scope-filtered record ("Not in consent scope") → revoke → instant denial, zero leakage at every step.

## 2026-09-09 — dispute loop, reconciliation, resubmission, PGlite harness lesson
- Dispute flagging needed chart-ownership check (UNION ALL over clinical tables); version rows alone don't cover ordinary writes.
- Dead-end workflows are real bugs: unresolvable disputes/conflicts and impossible verification resubmission (unique index) each broke a UI-promised flow; fixed with resolve action + concerns card, detect() reconciliation, update-in-place resubmission.
- `resolved_by` user FK means system auto-resolution must use NULL, never a "system" string — the test caught it, not review.
- Harness rules earned today: (1) never read dev PGlite out-of-process while the server runs — concurrent opens don't share state, verify via HTTP; (2) harness browser tabs don't share sessions — re-login per tab; (3) same-tab goto can serve stale RSC — curl with a fresh jar is ground truth for server rendering; (4) `pkill -f "[n]ext-server"` avoids self-kill; batch background results may be stale runs — re-run scripts fresh before trusting FAILs.

## 2026-09-09 — landing 3D removal, axe opacity race
- When a visual centerpiece renders broken, remove the tech (three.js gone), not the message: same copy, CSS product mocks, smaller bundle.
- axe-core factors element opacity into color-contrast: scroll-reveal pages produce run-varying false positives (61/1/76). Emulate reduced-motion in the axe script to measure the settled state; verify with a full-vs-reduced experiment before touching product CSS.
- Bisect before theorizing: the glow layer was innocent; the Reveal opacity states were the cause. Reverted the bisect cleanly.
