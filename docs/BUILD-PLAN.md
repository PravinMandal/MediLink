# MediLink — Approved Build Plan & Roadmap

> **Supersession notice (August 2026):** the root [`BuildPlan.md`](../BuildPlan.md)
> (August 2026 revision, produced after product, security, architecture, and UX
> review) is the **proposed successor plan, pending owner approval**. Where the
> two documents disagree, the root `BuildPlan.md` reflects the newer decisions.
> This plan is retained as the historical baseline and is **not** deleted until
> the applicable owners (clinical-safety lead, security owner, product owner)
> formally approve the successor and sign the transition.

> This is the single source of truth for what we are building. Progress is tracked in the session todo list.
> Research basis: `docs/research-findings.md` · Design basis: `docs/design-principles.md`

A provenance-aware, consent-driven longitudinal health-record platform for India: verified doctors/labs/hospitals contribute authenticated records; patients control access; emergency clinicians get audited break-glass access; an AI layer produces clinical summaries where **every claim cites its source record**.

Core promise: **"A doctor understands this patient in 5–10 seconds — and can prove where every fact came from."**

## Strategic corrections (from research)

1. ABDM is an interoperability **target**, not a prerequisite — mock adapters now, sandbox spike later (ABDM ships V3 APIs, M1/M2/M3 milestones + official NHA wrapper repo).
2. DPDP Rules 2025 notified 13 Nov 2025, phased rollout to ~May 2027 (consent managers Nov 2026) — consent-first architecture now is well-timed and required.
3. Doctor-first value is the wedge — every Indian PHR is patient-first; none offers record-level provenance or cited summaries.

## Stack (verified)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TS) | Requirement; Server Actions + Route Handlers |
| Hosting | Vercel, function region `bom1` (Mumbai) | Verified available; Hobby allows 1 region |
| Database | Supabase Postgres (ap-south-1) + pgvector in prod; **PGlite locally** | Neon has no Mumbai; Supabase does. PGlite = zero-setup local Postgres (WASM) with pgvector support |
| ORM | Drizzle | SQL-first, pgvector + FTS hybrid, serverless-friendly |
| Auth | Better Auth (self-hosted, drizzle adapter) | Roles, orgs, phone-OTP; control over verification flows |
| Storage | StorageAdapter: local disk (dev) / Supabase Storage private bucket + presigned (prod) | Works offline; upgrades cleanly |
| Jobs | Inline step-runner now; Inngest wiring later | No unkeyed services in dev; same step functions |
| AI | Vercel AI SDK + Gemini Flash-class when `GEMINI_API_KEY` present; **deterministic extractive summarizer fallback** | Demos work without keys; LLM improves quality |
| Search | Hybrid Postgres FTS + pgvector, always patient-scoped | One database |
| UI | Tailwind v4 + shadcn/ui (restyled) + Motion | Per design brief |
| Testing | Vitest + Playwright | Unit/integration/security + E2E |

## Architecture decisions (load-bearing)

- **Modular monolith** — `src/server/modules/*`: auth, identity, patients, records, documents, consent, access, audit, search, ai, notifications, integrations.
- **FHIR-inspired schema** — relational tables per resource + `resource` JSONB column with FHIR R4-shaped JSON for future interop.
- **Provenance on every clinical row** — author/org/source_document/content_hash/verification_status; amendments via `superseded_by`; originals never overwritten.
- **Identity** — internal `patient_uuid` primary; ABHA as separate linked identifier via `AbdmAdapter` (mock now). Never Aadhaar as FK.
- **Verification behind adapter** — `VerificationProvider`: Mock (dev), ManualReview (admin queue), HPR/HFR later.
- **Consent as data** — grantee + category scopes + purpose + expiry + revoke. Single access-check layer enforces on EVERY record read.
- **RAG isolation** — one repository function always injects `patient_id` + authorization scope; LLM only receives pre-authorized ID-tagged chunks.
- **Citation integrity** — `ai_summaries` + `ai_summary_claims` (per-claim `source_record_ids`); validation drops claims whose citations aren't in the retrieved set.
- **Contradiction engine v1** — deterministic conflict detection (blood group, allergies, duplicates, DOB); flagged never auto-resolved; verified > self-reported in display order.
- **Audit** — append-only hash-chained `audit_events`; break-glass → patient notification + review queue.
- **AI safety** — summarize/extract/timeline/trends/search only; no diagnosis/dosing/treatment; "AI-generated" labels everywhere.

## Product surface (MVP)

- **Patient portal**: dashboard, timeline, documents, meds/allergies, consents (grant/revoke/expiry), access history, emergency profile.
- **Doctor portal**: consent-aware patient search, Patient-at-a-Glance (SBAR), timeline (facets), AI summary with citations, lab trends (sparklines), document viewer, upload-with-provenance.
- **Org console (lite)**: staff, verification status, patients served, uploads, audit view.
- **Platform admin**: verification queue, break-glass review, user/org management — no casual clinical-data access.

## Roadmap

- **M0 — Foundation**: repo, Next.js 16 + TS + Tailwind + shadcn, Better Auth roles, Supabase/PGlite + Drizzle schema, Vercel deploy `bom1`, CI. *Demo: deployed app with auth + role routing.*
- **M1 — Identity & verification**: practitioner/org registration, verification pipeline (mock + manual queue), org console lite. *Demo: doctor becomes verified end-to-end.*
- **M2 — Records & provenance**: clinical CRUD by verified actors, document upload + ingest v1 (store/hash/text-extract), timeline v1, amendments. *Demo: lab uploads report → patient timeline with provenance.*
- **M3 — Consent & audit**: grants/revoke/expiry, enforcement everywhere, hash-chained audit, patient access-history, notifications. *Demo: blocked → grant → read → patient sees access entry.*
- **M4 — Intelligence**: OCR/LLM extraction (Zod), contradiction engine, hybrid search, RAG summary with claims+citations, sparklines, SBAR glance. *Demo: "Summarize cardiac history" → cited answer.*
- **M5 — Emergency**: emergency profile, break-glass (reason mandatory, time-boxed, audited, patient notified), review queue. *Demo: unconscious-patient scenario <10s.*
- **M6 — Golden demo & hardening**: 16-step golden path E2E, synthetic dataset (~30 patients/500+ dirty docs), security suite, responsive + a11y + Vercel-guidelines audit, DPDP checklist.
- **M7 — Marketing site + ABDM spike (time-boxed)**: art-directed public site per design brief; ABDM V3 sandbox exploration.

## Product rules (never violate)

1. Never confuse "data exists" with "data is trustworthy" — provenance on everything.
2. AI assists, never decides — no autonomous clinical conclusions.
3. Every design decision answers: "What does this doctor need to know right now, and can we prove where it came from?"
4. Never use real patient data in development — synthetic only.
5. Self-reported data never overrides verified clinical data.

## Definition of done

The golden path passes E2E: patient created → verified org → verified doctor → records uploaded → originals preserved → extraction → timeline → consent → second doctor reads history + AI summary → citations open sources → break-glass works → audit logs everything → patient sees access history. Mobile-responsive, keyboard-navigable, contrast-checked, deployed on Vercel Mumbai.
