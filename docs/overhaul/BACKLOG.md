# Overhaul Backlog — prioritized

Tiers: P0 correctness/security → P1 broken/missing core → P2 core UX → P3 a11y → P4 architecture → P5 performance → P6 visual polish → P7 3D landing. Status: ☐ todo · ◐ in progress · ☑ done.

## P0 — Security & correctness
- ☑ C1 Sign-up role lockdown; lab/org roles admin-grant-only; `setUserRoleAction` admin grant flow (D2, D11)
- ☑ C2 AI summary scope leak — scope-aware generate (D3) + scope-gated stored-summary reads (D12)
- ☑ C3 emergency.profile(): auth + assert + audit (D5)
- ☑ S1 Write-scope mapping per kind (D4)
- ☑ S2 Extracted blood group trust:"extracted"; never verified from uploads (D5)
- ☑ S3 Prompt-injection hardening: delimiters, Zod, ABO/Rh plausibility gate (D5)
- ☑ S4 Storage key validation on local + Supabase adapters (D6)
- ☑ S5 Gemini key → x-goog-api-key header + 20s timeouts (D5)
- ☑ S6 Break-glass: renewal blocked while flagged (D5)
- ☑ M5 getSessionUser re-reads user row
- ☑ m2 open redirect `//` fixed (actions + sign-in page); m4 generic errors; nosniff; uniform 404 (D6)
- ☑ Regression tests (24 passing)

## P1 — Free-tier production architecture
- ☑ /api/health route (SELECT 1)
- ☑ Supavisor transaction pooler config; upload cap aligned to 4 MB (< Vercel 4.5 MB)
- ☑ Prod guards: throw when DATABASE_URL / storage env missing in prod
- ☑ Audit chain: advisory lock removed, atomic INSERT..SELECT (pgcrypto; PGlite test fallback)
- ☑ Async extraction via after(); batched observation inserts
- ☑ .env.example (incl. NEXT_PUBLIC_APP_URL), vercel.json (bom1)
- ☐ Deploy doc (one-command redeploy runbook) — at Phase 4
- ☐ Supabase storage adapter verify — at deploy time

## P2 — Core UX
- ☑ loading.tsx + error.tsx for all 12 portal routes
- ☑ Field-level errors, error summaries, focus-first-error
- ☑ Admin review: confirm on reject, outcome messaging, disable-while-pending
- ☑ Post-action refresh (revoke, review)
- ☑ Doctor search pending feedback (patient-search.tsx)
- ☑ Org console upload form rendered; dead queries removed
- ☑ Access history pagination (25/page, server-side)

## P3 — Accessibility
- ☑ ink-faint contrast #5f6b64 (~5.5:1)
- ☑ SourceDrawer + BreakGlassForm: dialog semantics, focus trap, Escape, focus return
- ☑ Mobile nav: aria-current, single nav landmark, scrollbar hidden
- ☑ Skip links both shells, `<main id="main">`
- ☑ SectionTabs: tablist semantics, arrow keys, aria-disabled
- ☑ Sparkline sr-only textual fallback

## P4/P5 — Architecture & performance leftovers
- ☑ documentsFor explicit columns (textExtract dropped from lists)
- ☑ verifyChain chunked (500-row batches by seq)
- ☑ patients search → pg_trgm GIN index (migration 0001; PGlite-skips gracefully)
- ☑ Dead pgvector comments + unused imports/lint warnings removed
- ☐ Redirect file route to signed Supabase URL after access check (deploy-time)

## P6 — Visual polish
- ☑ Token corrections applied (ink-faint ≥4.5:1) across portal
- ☑ Loading/empty/error/success/disabled states on all forms and routes

## P7 — 3D landing (flagship)
- ☑ Record-journey scroll scene (R3F, ACES, DPR cap [1,2], disposal, reduced-motion DOM fallback, offscreen frameloop pause, dynamic import, low-power mobile path)
- ☑ Verified: section renders, canvas mounts on scroll, no overflow desktop/mobile

## Verification gates
- ☑ npm test 24/24 · typecheck clean · lint 0 errors · `npm run build` succeeds
- ☑ Behavioral suite `scripts/verify.mjs` 21/21 (marketing desktop+mobile, 3D canvas mount, open-redirect guard, doctor/patient/admin logins, patient record, all 6 patient subroutes mobile, /api/health)
- ☑ Screenshots: shots/verify-*.png (desktop 1280 + mobile 375)
- ☐ Deployed verification — blocked on API keys (user will supply; runbook in docs/overhaul/DEPLOY.md)

## Session bug fixes found by verification
- ☑ Seed wrote all users as `patient` (role input:false dropped the param) — seed now grants roles via direct update; demo roles correct
- ☑ signInAction now reads the authoritative role from the user row (auth response omits custom columns) — every role lands on its correct portal home

## Session 2026-08-23 (MASTER-GOAL v3 autonomous run)
- ☑ D16 notification bell in portal shell (notify service finally consumed)
- ☑ D16 admin break-glass notified-state disambiguation (no-patient-account case)
- ☑ D16 doctor glance band: 4 facts + encounter span (`records.encounterSpan`)
- ☑ D17 doctor record-content FTS search (`?q=` on record page, scope-filtered, fail-closed)
- ☑ D18 blood-group filled-pine anchor tile; trust-ranked citation chips; doctor-home consent edge rules; mobile hero type + CTAs
- ☑ D19 Emergency Card (printable/QR critical profile) — Explorer #6, QR machine-verified
- ☑ Extraction failure recovery: retry action + status chips + stale-pending fallback — Explorer #8
- ☑ Provenance micro-lines in doctor glance band; doctor-home row scent (Juror-2 gaps 1+3)
- ☑ D20 Out-of-band email channel for break-glass (Resend adapter, opt-in env)
- ☑ D21 Consent-request inbox (one-tap grant cards) — Explorer-2 #4
- ☑ Patient timeline search + kind filter, spine bug fix — Explorer-2 #5
- ☑ D22 Marketing: "See the record" static preview + quantitative proof band + mobile nav links
- ☑ D22 Admin audit stream actor/patient context; seed pre-generates SBAR summary; live debounced search
- ☑ Explorer-2 #1 QR scan-path fix (record URL → middleware next-redirect); #2 shared formatAuditAction; #3 org console consent-driven patient list; #6 bell polish
- ☐ ABDM sandbox adapter behind VerificationProvider — Explorer #2 (deferred: no sandbox credentials; ABHA field landed as D24)
- ☑ Deploy + production re-verify — DONE 2026-08-23 09:10: https://medilink-health.vercel.app, 26/26 behavioral checks on production
- ☑ D23 Gatekeeper security round: retry patient-binding fix + regression test, admin query bounds, unreadCount SQL
- ☑ D24 ABHA number (migration 0004, profile input, doctor header display) — E2E verified
- ☑ D25 contradictions dedupe/resolve fixes; branded 404 + global-error; sign-up dead ends; portal dispatch
- ☑ D26 patient search 3-char minimum (DPDP default); prod console digest-only logging
- ☑ D27 React Compiler evaluated, deliberately not enabled (documented rationale)
- ☑ Round 21 a11y: axe-core clean on 4 key surfaces (dl structure fix)
- ☑ Round 22-23 print-summary button; patient documents extraction chips
- ☑ Round 25 journey rail scroll-sync; honesty fixes (magic dates, forever claim, ABDM qualifier); lowDetail resize; signed-URL file redirect
- ☑ Round 26 storage-key failure honestly surfaced (stakeholder Q8 — needs real SUPABASE_SERVICE_ROLE_KEY)
- ☑ Round 28 lint zero warnings; break-glass E2E; comprehensive gate sweep all green
- ☑ Round 29 Juror-5 confirmation: 9.2/10 on production, no regressions

**Session 2 final state: 31/31 tests · tsc clean · lint 0/0 · build green · 26/26 behavioral (local + production) · axe clean · Juror 9.2/10.**

## Future session ideas
- ☐ Tokenize the motion system: formalize 2 eases + 3 durations as shared tokens (design-research brief: Mat Voyce-style single motion language; current animations use hand-picked cubic-beziers)
- ☐ Dark marketing hero variant (near-black pine surfaces, per Bloom case study) — current direction is light "clinical paper"; needs a design decision before attempting

