# MediLink Overhaul — Assessment (Phase 0)

Date: 2026-08-22 · Basis: 6-agent recon panel (code map, security, UX/a11y, architecture/perf, free-tier research, design research) + local gates.

## Product

Provenance-aware, consent-driven longitudinal health-record platform for India. Verified doctors/labs contribute authenticated records; patients control access (DPDP-aligned consent with scopes/expiry/revoke); emergency break-glass is time-boxed and audited; AI summaries cite every claim to its source record. Core promise: "A doctor understands this patient in 5–10 seconds — and can prove where every fact came from."

## Stack (as built)

Next.js 16.3.1 App Router (all 15 pages are server components; only 10 leaf client components — exemplary RSC split) · Better Auth (self-hosted, Drizzle adapter, 5 roles) · Drizzle + Postgres (PGlite embedded locally, node-postgres for prod) · Tailwind v4 · Vitest (12 security tests) · Playwright (screenshot script). Search is plain Postgres FTS — **no pgvector anywhere** despite schema comments. `three` + `@react-three/fiber` are installed but imported nowhere; `src/three/scenes/` is empty.

## What's genuinely strong (keep, don't rebuild)

- Consent/access guard (`access/guard.ts`) enforced on clinical reads and the file route; security suite proves cross-patient isolation, scope granularity, revocation/expiry immediacy, break-glass subset scopes.
- Append-only hash-chained audit log with tamper-detection test.
- Deterministic AI fallback (extract + summarize) works with zero API keys; citation validation drops uncited claims.
- Seed data: golden 9-year patient history with deliberate conflicts, run through the real ingest pipeline.
- Gates green at baseline: typecheck clean, tests 12/12, lint warnings only.
- Marketing page has a real art direction ("clinical paper & evidence chain") — no AI-slop.

## Top findings (full detail in BACKLOG.md)

**Security:** sign-up allows self-selecting `lab_staff`/`org_admin` (privilege escalation); AI summary reads the entire record on any single-scope grant; `emergency.profile()` is an unauthenticated read path waiting to be wired; write-path scope mapping sends medications/procedures through the `conditions` scope; extracted blood group persisted as `trust: verified`; Gemini key in URL query params; local-storage path sanitization bypassable.

**Architecture:** audit hash-chain takes a global advisory lock serializing all audit writes; no Supavisor pooler config; uploads run PDF extraction + LLM inline in a server action (will blow Vercel limits); Vercel caps request bodies at 4.5 MB vs 20 MB ingest cap; local-disk storage silently falls back in production.

**UX/a11y:** `ink-faint` (#8a948e) fails contrast at 2.9:1 in ~30 informational usages; no loading.tsx/error.tsx on any of 11 portal pages; SourceDrawer has no focus trap; mobile nav lacks aria-current and scroll affordance; no skip link; admin reject actions lack confirmation.

**Feature gaps:** ABDM placeholder, in-app-only notifications, org console read-only, no 3D layer at all.

## Free-tier target architecture

Vercel Hobby (bom1) + Supabase Free (ap-south-1: Postgres via Supavisor transaction pooler port 6543 for runtime, direct 5432 for migrations; Storage private bucket + signed URLs) + Gemini free tier (Flash ~250 req/day; deterministic fallback when absent) + cron-job.org keep-alive ping every 3 days against `/api/health`. All $0, no card. Ceilings documented in decisions.md D1.
