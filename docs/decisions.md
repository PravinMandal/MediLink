# Decision Log — MediLink Overhaul

## D29 — Build-plan execution audit: cross-patient revocation fix, opaque emergency QR, honest ABHA discovery (2026-08-25)
**Decision:** Full plan-vs-code audit executed (docs/audit/build-plan-execution-audit.md). Fixed P0 authz: `consent.revoke` now asserts the caller owns the grant's patient record, re-checked inside the UPDATE predicate — any patient could previously revoke any other patient's grant by ID. Fixed P0 privacy: the doctor's pre-consent screen no longer renders name/sex/DOB (§7.9) — only the non-secret Patient ID. ABHA discovery now actually works: it falls back to digit-equal `patients.abha_number` for claimed accounts (the `patient_identifiers` table had zero writers, so verified-ABHA lookup was dead code; also replaced a full-scan + N+1 with one query). Emergency-card QR no longer encodes the raw patient UUID URL (§7.12): new `emergency_card_tokens` (migration 0006, token + SHA-256 hash index), `/e/<token>` route resolving only for signed-in doctors into the consent-gated workspace, audited issue/rotate/scan events, explicit "Replace code" rotation for lost cards. Clinical copy: "No allergy record found in MediLink" replaces "No allergies documented in any record"; SBAR headings renamed to recorded-fact language per §7.13. Patient home gains §7.6 attention strip for pending requests and a concrete coverage note. Six regression tests added (77 total). Verified: tsc clean, lint 0 problems, 77/77 tests, production build green incl. /e/[token], migration 0006 applies cleanly.
**Rationale:** Independent verification found the trust spine genuinely implemented but four real defects in exactly the flows the plan flags highest-risk: revocation ownership, pre-auth disclosure, identifier discoverability, and QR opacity. All fixes are additive and covered by tests.

## D28 — Dark mode: "night ward" palette (2026-08-23)
**Decision:** Dark mode implemented as CSS token overrides under `[data-theme="dark"]` on html — every semantic token (paper/ink/line/pine/alert/amber/info + their tints) gets a night value, so the entire app follows automatically. New tokens: `on-pine`/`on-pine-soft` and `on-alert`/`on-alert-soft` (text on filled surfaces — solid pine becomes LIGHT green in dark mode, so white text would invert to unreadable; all `text-white` on fills converted to these tokens). A blocking pre-hydration inline script reads localStorage/system preference → `data-theme` (no flash); a sun/moon `ThemeToggle` lives in both the marketing header and the portal header (next to the bell); OS preference changes are followed while in "system" mode. The 3D journey scene reads the theme via MutationObserver and swaps its background/lights; the ECG grid overlays use `color-mix()` on `--color-pine`. Print always forces the light palette (paper is paper). The doctor blood-group tile was rebuilt as a plain div (not `Card`) — `.card`'s CSS background beat the `bg-pine` utility, which the dark contrast audit caught as dark-on-dark.
**Rationale:** User request; the design-research brief's dark recipe (near-black pine-tinted surfaces — never pure black, one accent, tints as translucent overlays) applied. Verified: 4 new dark checks in the behavioral suite (toggle present, theme flips + near-black body, computed contrast audit ≥2.5:1 across all text, persistence across navigation) + a full 11-page dark audit script (doctor record + 3 tabs, 6 patient pages, admin) — all pass locally and on production.
**Palette:** paper #0c1310 / raised #121b17 / sunk #0a100d; ink #e7ece9; pine #4dbfa4 (lightened for dark surfaces); alert #ff8a80; amber #ffca7a; info #7fc4e8; on-pine #06231c.

## D27 — React Compiler: researched decision NOT to enable (2026-08-23)
**Decision:** Keep `reactCompiler` off. Documented rationale: it's stable-but-off in Next 16 because it reintroduces Babel into the Turbopack pipeline (higher build times), the app is server-component-dominant (only ~10 client leaves, so INP wins are marginal), and community guidance recommends annotation-mode migration + pinned versions before global enablement. Revisit when the Rust port (`experimental.turbopackRustReactCompiler`) is stable.
**Sources:** nextjs.org/docs reactCompiler + turbopackRustReactCompiler, nextjs.org/blog/next-16.

## D26 — Patient directory search minimum length (2026-08-23)
**Decision:** `patientService.search` rejects queries under 3 characters server-side; the doctor search placeholder communicates the minimum; RouteError logs only the digest to the client console in production.
**Rationale:** Resolves stakeholder Q5 with a researched default: DPDP Act 2023 lacks a HIPAA-style treatment-purpose exception, so directory probing is minimized — short/wildcard queries can no longer enumerate the patient registry.

## D25 — Explorer-3 correctness + polish batch (2026-08-23)
**Decision:** Contradiction engine: conflicts dedupe on a content hash key (`_key` in details) so distinct conflicting analytes/allergies coexist; `resolve()` merges the resolution note into existing details (never wipes evidence). Root `not-found.tsx` (on-brand 404) and `global-error.tsx` (inline styles, digest-only logging in prod). Sign-up: post-signup sign-in failure redirects to `/sign-in?registered=1` with an explicit status message; weak-password errors surfaced as field feedback; doctors land on `/portal/doctor/verification` after signup. Portal dispatcher sends unauthenticated visitors directly to /sign-in. `ageFrom` returns null for future DOBs.
**Rationale:** Explorer-3 found the contradiction engine silently collapsing same-kind conflicts and resolve() destroying evidence — the only genuine correctness bugs of the round; the rest are the last unpolished surfaces (default-styled 404/layout crashes) and dead ends.

## D24 — ABHA number field (2026-08-23)
**Decision:** New optional `patients.abhaNumber` column (migration 0004) for India's national health ID. Patient profile gains an ABHA input (normalized to digits on save); doctor record header shows "· ABHA xxxx" when present. Full ABDM sandbox linking stays a future adapter (no credentials).
**Rationale:** Explorer-2 #2: ABHA linkage is the biggest credibility gap for an India-focused product; the data model + display now exist so the adapter can land later. Note: db:migrate/db:seed npm scripts now load `.env` (`tsx --env-file=.env`) — previously they silently targeted local PGlite even when DATABASE_URL was configured; caught when the dev server (Supabase-backed) errored on the missing column.

## D23 — Gatekeeper fixes: retry action patient-binding (2026-08-23)
**Decision:** retryExtractionAction now selects the document with `and(eq(id), eq(patientId))` — plus `eq(organizationId)` for facility roles — refuses when extraction is already processing, and writes a `document.extraction.retried` audit event. Admin audit-stream joins use inArray on referenced ids; notify.unreadCount uses SQL count(*). Regression test asserts the patient-bound lookup shape.
**Rationale:** Gatekeeper review found the retry path could extract patient B's document into patient A's chart under A's consent — a cross-patient consent bypass. Severity HIGH; fixed same round.

## D22 — Juror-3 fixes (2026-08-23)
**Decision:** (a) Admin audit stream joins actor name/role + patient name per event (batch name resolution, no per-row queries). (b) Seed pre-generates the golden patient's full-scope SBAR summary so the doctor record page demonstrates the cited-summary feature on first open. (c) Doctor record search + patient timeline search are now live (300ms debounce) with URL sync retained. (d) Marketing gains a quantitative proof band (sha-256 seal / 100% verified writes / 60-min emergency window / 0 records readable without consent) and a static "See the record" preview section mirroring the real glance band with synthetic data.
**Rationale:** Fresh-eyes Juror round 3 scored 8.2/10 and named these as the top gaps; the record preview closes the marketing story without login and the stats band adds the missing quantitative proof.

## D21 — Consent-request inbox (2026-08-23)
**Decision:** The patient consents page now renders pending access requests as one-tap grant cards: recent `consent.requested` audit events for the patient, resolved to practitioners via actorId→userId, deduped, excluding holders of active grants (max 3). Each card is a pre-filled `grantConsentAction` form (default 5 core scopes + 30 days, optional documents/imaging checkboxes). E2E-verified: Arjun requests → Rahul sees card → grant succeeds → card disappears.
**Rationale:** Explorer-2 #4: the "grant it here in two taps" promise was false — patients had to find the doctor in a full practitioner dropdown. The request notification existed but led to manual work. This is the core DPDP interaction.

## D20 — Out-of-band email channel for break-glass (2026-08-23)
**Decision:** New `notifications/email.ts` adapter (Resend HTTP API, activated only by `RESEND_API_KEY` env; 10s timeout; failures logged never thrown — in-app row stays the source of truth). Break-glass arms it: patient gets an email in addition to the in-app notification when configured. No new package (plain fetch).
**Rationale:** Explorer #3: "patient notified when a doctor break-glasses your record" was false in practice for offline patients. Kept dependency-free and opt-in via env; Resend chosen for free tier (3k emails/mo) per earlier free-tier research.

## D19 — Emergency Card with dependency-free QR (2026-08-23)
**Decision:** Patient emergency page gains a wallet-size Emergency Card: medical-alert header, name/DOB, oversized blood group with trust level, dangerous-allergy list, QR routing to the audited emergency path, ICE contact, conditions/meds micro-rows, plus print isolation CSS (`body.printing-card`) and a print button. The QR is a hand-rolled byte-mode encoder inside the component (v1–6, ECC M, mask 0) — zero runtime deps, ~150 lines, server-rendered SVG.
**Rationale:** Explorer #6: the thesis's most consumer-visible artifact. Hand-rolled QR validated two ways: unmasked bitstream diffed against the `qrcode` reference implementation with pure byte-mode segments (0 diffs), and end-to-end jsQR decode of the rendered SVG at 4x scale returns the exact URL. Bugs found and fixed during verification: alphanumeric gate wrongly rejected URLs, format-info cells not reserved before data placement, placement loop started downward instead of upward, format copy 2 never written. Diagnostic scripts: scripts/qr-check.mjs (kept, gate), others removed. jsqr/pngjs/qrcode added as devDeps for verification tooling.

## D17 — Record-content search for doctors (2026-08-23)
**Decision:** The patient-scoped FTS service (`search.inPatient`, previously zero callers) is now wired into the doctor's record page: a GET-form search box on the Summary tab (`?q=`), results rendered server-side, each hit filtered through `scopeForResource` against the caller's granted scopes — unknown resource kinds fail closed (skipped). No new index needed yet: PGlite handles the seq-scan at demo scale; Postgres GIN expression index deferred to a future migration if record-content search becomes a hot path.
**Rationale:** Explorer #5: "find that 2021 creatinine" is a real doctor need the timeline doesn't serve. Verified: behavioral check "record search returns results panel".

## D18 — Juror round-1 craft fixes (2026-08-23)
**Decision:** (a) Blood group becomes a filled-pine serif display tile — the glance band's visual anchor — with trust + conflict inline; the old header-corner blood-group snippet removed. (b) Allergy card gets a red left rule and "Red-line allergies" eyebrow. (c) Citation chips are trust-ranked: filled pine-tint = verified, outlined = extracted, dashed border = self-reported (title/aria expose the level). (d) Doctor-home patient rows get a consent-state edge rule (pine/amber) plus grant count/scope-count/expiry detail. (e) Marketing hero: mobile type re-articulated (7.5vw clamp, looser mobile leading) and CTAs full-width stacked on mobile (thumb-weighted).
**Rationale:** Fresh-eyes Juror round 1 scored 6.1/10; gaps 1/2/3/5 addressed. Gap 4 (hero centerpiece) deferred — EvidenceCard already serves as the hero specimen; a larger art-directed moment queued for the next round.

## D16 — Portal notifications surface (2026-08-23)
**Decision:** The existing (previously unconsumed) in-app notification service now renders as a header bell in the portal shell: server-fetched in the portal layout (items + unread count), client dropdown with mark-all-read server action, optimistic state. Admin break-glass list disambiguates notification state: "notified (time)" vs "notification pending" vs "no patient account — contact on file" (joins patients.userId). Doctor record page gains a four-fact "at a glance" band: red-line allergies (high-severity first), active problems, active meds (top-3 + overflow counts), and record activity (last encounter, encounter count, history span via new `records.encounterSpan`).
**Rationale:** Explorer round-1 audit: notify.push had zero consumers; the "notified —" dash was ambiguous in the highest-stakes admin surface; the thesis names a measurable "10 seconds" KPI the page didn't design for. Verified: 30/30 tests, tsc clean, lint 0 errors, 24-check behavioral suite extended with glance-band, bell, and notified-state checks.

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
