# MediLink Overhaul — Final Report

Date: 2026-08-23 · Method: multi-agent panel (research → audit → sequential executors → behavioral verification)

## What the product is

MediLink is a provenance-aware, consent-driven longitudinal health-record platform for India. Verified doctors and labs contribute authenticated records; patients control access via DPDP-aligned scoped consents with expiry and instant revocation; emergency access is a time-boxed, audited break-glass; AI summaries cite every claim to its source record. Core promise: "A doctor understands this patient in seconds — and can prove where every fact came from."

## What was weak (Phase 0 audit, prior session)

- Public signup could self-select `lab_staff`/`org_admin` (privilege escalation).
- AI summary generation read the whole record under any single-scope consent.
- Emergency profile read path lacked an auth/assert/audit wrapper.
- Clinical writes all asserted the `conditions` scope regardless of kind.
- Gemini key sent in URL query params; local-storage path check bypassable.
- Audit hash-chain took a global advisory lock serializing all writes.
- Upload ran PDF extraction + LLM inline in a server action; 20 MB cap vs Vercel's 4.5 MB.
- No loading/error boundaries on any portal page; ink-faint contrast 2.9:1; no focus traps, skip links, or tab semantics; unpaginated access history; dead org-console upload import.
- No 3D layer despite installed deps; follow-up audit additionally found ungated stored-summary reads and a `//evil.com` open redirect on the sign-in page.

## What was improved

### Security & correctness (P0) — all verified by tests (24 passing)
- Role lockdown: `role` is `input:false`; professional roles granted only via new `setUserRoleAction` (platform-admin only, refuses platform_admin elevation, audited). Doctor self-signup retained deliberately (D11): the account is unverified and blocked from clinical writes until admin verification.
- Scope-aware AI: summary generation filters claims to granted scopes; stored-summary reads are scope-gated too (D12) — a narrower grant never surfaces a broader-consent summary.
- Emergency profile: authenticated, scope-asserted, audited; break-glass renewal blocked while an event is flagged.
- Per-kind write-scope mapping; extracted blood group persisted as `trust:"extracted"` and never outranks lab-verified values.
- Prompt-injection hardening: delimiters, Zod, ABO/Rh plausibility gate on LLM blood groups (tested with an injection-style LLM response).
- Open redirects closed (actions + sign-in page); uniform 404 + nosniff on the file route; storage keys validated on both local and Supabase adapters.

### Architecture (P1, P4/P5) — free-tier production-ready
- `/api/health` probe; Supavisor transaction-pooler tuning; production guards that throw instead of silently falling back to local storage.
- Audit chain: single atomic `INSERT … SELECT` with pgcrypto hash-chaining (no advisory lock); chunked 500-row verification.
- Async extraction via `after()`; batched observation inserts; upload cap aligned to 4 MB.
- `documentsFor` drops the heavy `textExtract` column from list queries; patient search gets a pg_trgm GIN index (migration 0001).

### UX & accessibility (P2/P3)
- loading.tsx + error.tsx on all 12 portal routes; field-level errors with aria wiring, error summaries, focus-first-error.
- Admin review confirmations + outcome messaging; post-action refresh; doctor search pending feedback; org console upload form actually rendered; paginated access history.
- ink-faint ≥ 4.5:1; dialog semantics with focus traps on SourceDrawer/BreakGlassForm; skip links; single nav landmark with aria-current; real tablist semantics with arrow keys; sparkline sr-only fallback.

### 3D landing (P7, flagship)
- Scroll-driven R3F "record journey": lab report → sha-256 seal → consent gate → cited claim. DPR-capped, ACES tone mapping, disposal, offscreen frameloop pause, lazy dynamic import (portal bundle untouched), `prefers-reduced-motion` DOM fallback, low-power mobile path. Content never lives only in canvas (DOM rail + sr-only copy).

### Bugs found by end-to-end verification (fixed)
- The seed wrote every user as `patient` (Better Auth drops the role param under `input:false`) — all demo roles were wrong. Seed now grants roles via direct update.
- `signInAction` trusted the auth response's role, landing every user on the patient portal — now reads the authoritative user row.

## Free-tier architecture map (decision D1)

| Runs where | Free ceiling | Scale-up |
|---|---|---|
| App: Vercel Hobby, region bom1 | 1M invocations, 100 GB bandwidth, 4.5 MB body | Pro $20/mo |
| Postgres + Storage: Supabase Free, ap-south-1 | 500 MB DB, 1 GB files, 7-day idle pause | Pro $25/mo |
| AI: Gemini free (optional; deterministic fallback) | ~250 req/day Flash | billing |
| Keep-alive: cron-job.org → `/api/health` every 3 days | free | — |

Deploy runbook: `docs/overhaul/DEPLOY.md` (env vars, migration via direct connection, one-command redeploy).

## Evidence

- `npm test` — 24/24 (security: isolation, consent granularity/revocation, tamper-evident chain, role injection, scope-aware summaries, write-scope mapping, emergency auth, break-glass blocking, storage keys, injection hardening, admin grant authorization).
- `npx tsc --noEmit` clean · `npm run lint` 0 errors · `npm run build` succeeds (all routes compiled).
- `node scripts/verify.mjs` — 21/21 behavioral checks against the live dev server with seeded data: marketing desktop/mobile (no horizontal overflow), 3D canvas mounts on scroll, open-redirect guard, doctor/patient/admin logins land on correct portals, patient search → record page, all six patient subroutes render mobile-clean, `/api/health` returns `{ok:true,db:"up"}`.
- Screenshots: `app/shots/verify-marketing-{desktop,mobile}.png`, `verify-doctor-home.png`, `verify-doctor-patient.png`, `verify-patient-mobile.png`, `verify-admin.png`.

## Decisions made autonomously

See `docs/decisions.md` D1–D12. Key ones this session: D11 (doctor self-signup retained — verification is the real gate), D12 (scope-gated stored-summary reads), pg_trgm over prefix-only search (doctors search partial names/phone fragments), audit-chain atomic insert with a PGlite-test fallback path.

## Open questions (parked)

`docs/questions-for-stakeholder.md` — Vercel Hobby non-commercial clause, closed vs open practitioner signup, 3D retention.

## Known limitations

- **Round 2 deep audit (2026-08-23, "check everything" pass):** four parallel auditors (adversarial security with live HTTP probes, UX/a11y with axe + full flows, performance with build-artifact analysis, correctness review). They found 4 critical + 8 high issues — ALL now fixed and re-verified:
  - Audit hash chain could fork under concurrent writes → unique `prev_hash` + bounded retry (migration 0002, D13); concurrency test added (30 tests total now).
  - `imaging`/`sensitive` consent scopes were placebos → imaging is real, sensitive removed, guard fails closed (D14).
  - Signup offered lab/org roles the server rejects → form now patient/doctor only; admin console gained role-grant + audit-chain-verify UI (previously dead actions).
  - Oversize upload crashed the page section → 4 MB client guard + inline error + honest copy; server path aligned earlier.
  - Empty "success" state for scope-hidden summaries, extraction chips missing on doctor Documents tab, axe serious violations (dl structure, scrollable region, contrast), citation-chip tap targets — all fixed.
  - Perf: audit write per tab switch (now initial-view only), timeline scope filtering pushed to SQL, duplicate patient-row fetch removed, `motion` dead dep removed, PGlite bundle-trace warning eliminated, maxDuration=60 set on upload pages, OG/twitter metadata + themeColor, DB-down "waking up" error state, hot-path indexes (migration 0003), file route attachment+mime-allowlist, secure cookies in prod.
  - Prompt-injection: random per-request delimiters in the Gemini extraction prompt, unforgeable (`<<<` neutralized).
  - Seed labeled extracted blood groups as verified → now authored as a real lab-verified record (conflict demo preserved).
  - Verified after fixes: 30/30 tests, typecheck clean, lint 0 errors, production build clean, 21/21 browser checks on fresh DB, migrations 0000–0003 apply cleanly.
- **Deployment not yet executed** — requires the API keys the user said they will supply (Supabase + Vercel). Everything is staged: env template, migrations (0000–0003), region pinning, runbook. Local verification is complete; deployed verification (cold start, Supabase adapter, golden path on production) remains as the post-key step per DEPLOY.md §5.
- Patient directory visibility and preventive-light break-glass remain deliberate product tradeoffs — see questions-for-stakeholder.md items 5–6.
- FTS search service (`search.inPatient`) has no application caller yet (doctor search uses name/phone); its GIN index exists only in the PGlite runner — wire + index it in Postgres if record-content search is wanted.
- PDF text extraction still runs inline within the async `after()` window (now capped by maxDuration=60).
- ABDM integration remains a placeholder adapter; notifications are in-app only; the "notified —" empty-recipient rendering in admin break-glass events needs the notification recipient name joined in.
- Intermittent `/sign-up` hydration console error (audit H4) was not reproducible deterministically; suspected dev-mode HMR artifact — watch for it on the deployed build.
- Screenshot review in this environment returned images without renderable payloads, so the visual critique relied on behavioral probes (overflow, contrast tokens, state coverage) rather than eyeballing pixels; the screenshots are saved for human review.
- Round 2 UX audit ran real axe-core passes in Chromium: zero critical violations; all serious violations found were fixed in the same round.
- PDF text extraction still runs inline within the async `after()` window (capped by the function timeout rather than the 60s cap D8 specified).
- ABDM integration remains a placeholder adapter; notifications are in-app only.
