# Decision Log — MediLink Overhaul

## D1 — Free-tier production architecture (2026-08-22)
**Decision:** Vercel Hobby (region bom1) + Supabase Free ap-south-1 (Postgres via Supavisor transaction pooler `:6543` for app runtime; direct `:5432` for migrations; Storage private bucket + signed URLs for documents) + Gemini API free tier (key optional; deterministic extractive fallback stays) + external keep-alive (cron-job.org) pinging `/api/health` every 3 days to defeat Supabase's 7-day inactivity pause.
**Rationale:** Only Supabase offers Mumbai among free Postgres providers (Neon has no ap-south-1 and cold-starts every 5 min). Supabase Storage (1 GB) beats Vercel Blob's 2K writes/month; UploadThing private files are paid; R2 requires a card. Vercel Hobby is non-commercial — acceptable for this demo; commercial use is the documented scale-up trigger (Pro $20/mo).
**Ceilings:** Supabase 500 MB DB / 1 GB files / 7-day pause; Vercel 1M invocations, 100 GB bandwidth, 4.5 MB request body cap, 1 region; Gemini ~250 req/day Flash. Scale-up: Supabase Pro $25/mo (8 GB, no pause, backups), Vercel Pro, Gemini billing.
**Sources:** vercel.com/docs/plans/hobby, vercel.com/docs/functions/limitations, supabase.com/pricing, supabase.com/docs/guides/platform/free-project-pausing, ai.google.dev/gemini-api/docs/rate-limits.

## D2 — Sign-up role lockdown (2026-08-22)
**Decision:** All self-service sign-ups become `patient`. Better Auth `role` field becomes `input: false`. Professional roles (`doctor`, `lab_staff`, `org_admin`) are granted only by a platform admin through an authenticated admin flow. 
**Rationale:** Current `input: true` + client-side whitelist is privilege escalation (security audit C1) — anyone can register as lab_staff/org_admin and reach clinical reads.

## D3 — AI summary must respect consent scopes (2026-08-22)
**Decision:** `summarizer.generate` receives the granted scopes and builds/filters claims to those scopes only. Reading a stored summary requires a grant covering the summary's scopes.
**Rationale:** Any single-scope grant currently yields a full-record SBAR (security audit C2) — a consent violation of the product's core promise.

## D4 — Write-scope mapping per record kind (2026-08-22)
**Decision:** Clinical writes derive the required consent scope per kind via the same mapping as reads (medications→`medications`, procedures→`procedures`, conditions→`conditions`, observations→`labs`, allergies→`allergies`).
**Rationale:** All non-observation writes currently assert the `conditions` scope (audit S1) — a doctor with only conditions consent can write meds/procedures.

## D5 — Extraction trust + emergency profile hardening (2026-08-22)
**Decision:** Document-extracted blood group persists as `trust: "extracted"` (displayed but never outranking a lab-verified value). `emergency.profile()` requires an authenticated caller and asserts emergency scopes + audits each read. LLM document text is delimited as data and outputs are plausibility-checked; Gemini key moves to `x-goog-api-key` header; all Gemini fetches get 20s timeouts.
**Rationale:** Audits S2/S3/S5, C3 — poisoned uploads must not be able to override verified blood group (safety-critical in the emergency view), and the emergency read path must never be unauthenticated.

## D6 — Production guards: no silent local fallbacks (2026-08-22)
**Decision:** In production, missing `DATABASE_URL` or Supabase storage env throws at boot instead of falling back to PGlite/local disk. Storage keys are structurally validated (`uuid/uuid`) with resolved-path prefix checks. Document route returns uniform 404 for missing-or-denied, adds `X-Content-Type-Options: nosniff`.
**Rationale:** Vercel's filesystem is read-only/ephemeral; silent fallbacks produce unexplainable prod failures (arch audit M2/M3, security S4/M2).

## D7 — Audit chain: remove global advisory lock (2026-08-22)
**Decision:** Replace the global `pg_advisory_xact_lock` + `SELECT max(seq)` serialization with a single atomic `INSERT ... SELECT coalesce(max(seq),0)+1, ... FROM audit_events` per event (still per-row hash-chained to the prior row inside one statement). Verification stays async/explicit.
**Rationale:** The current design serializes every audit write deployment-wide (arch audit C1) — a hard throughput ceiling and lock-timeout magnet under Vercel concurrency. Tamper-evidence doesn't require strict global linearity; hash-chaining to the previous row inside the atomic insert preserves it.

## D8 — Async document extraction (2026-08-22)
**Decision:** `uploadDocumentAction` stores the document (`extractionStatus: "pending"`), returns immediately, and extraction (PDF text + LLM + observation writes) runs in Next 16 `after()` with a 60s cap. Doctor UI polls/refreshes on the existing extraction-status chips. Observations are batch-inserted (one multi-row INSERT) instead of 4 queries × N rows.
**Rationale:** Inline extraction blocks the action past Vercel limits (arch M1/M2); the `extractionStatus` column already exists.

## D9 — 3D landing page: keep deps, build the evidence-chain hero (2026-08-22)
**Decision:** Build a purposeful scroll-driven Three.js/R3F moment on the marketing page showing the record's journey (lab report → hashing/signing → consent gate → cited claim), following creative-coding hard rules: DPR cap, ACES tone mapping, disposal, `prefers-reduced-motion` DOM fallback, pause-when-offscreen, lazy-load via `next/dynamic` so the portal bundle is untouched. Not decoration: each scroll step advances one factual claim.
**Rationale:** Deps are already installed and the user's goal explicitly demands the 3D flagship landing. Design research: 3D works only when it explains the invisible (DiNABIOS/Spear Bio pattern); the record-journey is exactly that.

## D11 — Doctor self-signup retained; verified-before-clinical-access is the real gate (2026-08-23)
**Decision:** Keep public signup's patient/doctor choice (as implemented in auth-actions.ts). Rationale: D2's core threat was privilege escalation to lab_staff/org_admin — those remain admin-grant-only. A self-registered doctor is unverified (`verificationStatus: pending`) and `requireVerifiedPractitioner` blocks all clinical writes until a platform admin (or registry provider) verifies them. Self-signup merely starts the verification queue entry. Added the missing admin role-grant action (setUserRoleAction) to complete D2.

## D12 — Stored-summary reads must be scope-gated (2026-08-23)
**Decision:** `summarizer.latestFor()` becomes scope-aware: a stored summary is returned only when the summary's covered scopes ⊆ caller's granted scopes. Callers with narrower grants see no stored summary rather than one built under broader consent. Found by follow-up audit: the D3 fix gated generation but not reads.

## D13 — Audit chain concurrency: unique prev_hash + bounded retry (2026-08-23)
**Decision:** UNIQUE index on `audit_events.prev_hash` (migration 0002); the atomic INSERT..SELECT retries up to 3 times on unique-violation (23505). Concurrent writers can no longer fork the chain; verifyChain stays reliable under serverless concurrency.
**Rationale:** Follow-up audit found the prior "atomic" statement could chain two rows to the same prevHash without constraint failure → false tamper alarms. Sources: vercel.com/docs/functions/limitations (Hobby 300s max duration, fluid compute).

## D14 — Honest consent scopes (2026-08-23)
**Decision:** `imaging` is now a real scope (imaging-category diagnostic reports map to it; guard throws fail-closed on unknown resource kinds). `sensitive` removed from offered scopes and ALL_SCOPES — it granted nothing and stayed only as a legacy enum value. Sign-up offers only patient/doctor; lab_staff/org_admin are admin-granted via the new admin console role-grant UI.
**Rationale:** UX audit showed the form offering roles/scopes the server rejects — dead ends and placebo grants violate the product's trust promise.

## D15 — Audit-after-write resilience + upload sizing (2026-08-23)
**Decision:** consent.grant / breakGlass / ingestDocument treat a post-commit audit-write failure as log-and-continue (action succeeded; a failed audit append must not contradict reality). Upload path: client-side 4 MB guard + inline error, maxDuration=60 on the hosting pages (Vercel Hobby fluid allows 300s; researched and confirmed). Files route: attachment disposition by default, inline only for PDF/images, mime allowlist with 415 otherwise. secureCookies in production.

## D10 — Design system evolution, not replacement (2026-08-22)
**Decision:** Keep the "clinical paper & evidence chain" direction and pine palette; fix `ink-faint` to ≥4.5:1 (darken to ~#5f6b64), add field-level error affordances to the design system, add loading/error boundaries per portal route, add skip links, fix mobile nav semantics (aria-current, single nav landmark, scroll affordance), red reserved strictly for emergency/critical.
**Rationale:** Existing direction is distinctive and non-slop; audits found execution gaps (contrast, states, a11y) rather than a wrong direction. Human-factors guidance: ≤4 color codes, red = critical only, flowsheet density with per-row provenance.
