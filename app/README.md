# MediLink

A provenance-aware longitudinal health-record platform for India.

**Core promise:** a doctor understands a patient in 5–10 seconds — and can prove where every fact came from.

- **Verified professionals contribute** — council-registered doctors and licensed facilities only (verification behind an adapter: mock → manual review → ABDM HPR/HFR later).
- **Authenticated records** — every clinical row carries author, organization, source document, timestamp, content hash, and trust level. Amendments supersede; originals are never overwritten.
- **Patient-held consent** — scoped categories, purpose, expiry, one-tap revoke. DPDP-aligned. Emergency access is a separate, audited break-glass path with mandatory clinical reason and patient notification.
- **Cited AI summaries** — SBAR-structured summaries where every claim links to the records it was built from; claims without valid citations are dropped before persistence.
- **Tamper-evident audit** — append-only, hash-chained log of every sensitive action.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Hosting | Vercel, function region `bom1` (Mumbai) |
| Database | Supabase Postgres (ap-south-1) in production · **embedded PGlite locally** (zero setup) |
| ORM | Drizzle |
| Auth | Better Auth (self-hosted, roles, drizzle adapter) |
| Storage | Local disk adapter (dev) / Supabase Storage private bucket (prod) |
| AI | Gemini Flash (structured extraction + summary rewrite) when `GEMINI_API_KEY` is set; deterministic engine otherwise — the product works fully without any API key |
| Search | Patient-scoped Postgres full-text search (+ pgvector in prod) |
| Tests | Vitest (security suite) · Playwright (visual checks) |

## Quick start

```bash
npm install
cp .env.example .env         # defaults work for local dev
npm run db:migrate           # create schema in local PGlite (.pglite/)
npm run db:seed              # synthetic golden dataset (NEVER real data)
npm run dev                  # http://localhost:3000
```

### Demo accounts (password `Password123!`)

| Account | Role | State |
|---|---|---|
| `meera@medilink.health` | Doctor (Internal Medicine) | Verified, has Rahul's consent |
| `arjun@medilink.health` | Cardiologist | Verified, no consent — demo the grant / break-glass flows |
| `rahul@example.com` | Patient | 9-year history, blood-group conflict, duplicate report |
| `lab@sunrise.health` | Lab staff | Sunrise Diagnostics (verified) |
| `admin@medilink.health` | Platform admin | Review queues, break-glass oversight, audit chain |

The golden patient (Rahul Sharma) exercises the entire pipeline: trending HbA1c/creatinine, a verified blood group (B+) conflicting with the self-reported one (O+), a duplicate document, a discharge summary, and a live consent grant.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:generate` | Generate migration SQL from schema |
| `npm run db:migrate` | Apply migrations (local PGlite or `DATABASE_URL`) |
| `npm run db:seed` | Reset + seed synthetic dataset |
| `npm test` | Security suite (isolated throwaway database) |

## Production deployment (Vercel + Supabase)

1. Create a Supabase project in **ap-south-1 (Mumbai)**; enable pgvector if you want semantic search.
2. Set env vars on Vercel: `DATABASE_URL` (Supabase connection string), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `GEMINI_API_KEY`, `VERIFICATION_PROVIDER=manual_review`.
3. Set the project's function region to `bom1`.
4. `npm run db:migrate` against the Supabase URL.

## Architecture

```
src/
  server/
    db/            schema (FHIR-inspired) + PGlite/Postgres switch
    auth.ts        Better Auth (roles: patient | doctor | lab_staff | org_admin | platform_admin)
    session.ts     session helpers + role routing
    modules/
      identity/    verification adapters (mock | manual review | ABDM later)
      patients/    record owner CRUD
      records/     clinical CRUD w/ provenance, amendments, timeline, trends
      documents/   storage adapter + ingest pipeline (hash → extract → chunk → index)
      consent/     grants: scope + purpose + expiry + revoke
      access/      THE single enforcement point for every clinical read
      audit/       append-only hash-chained event log
      emergency/   break-glass + critical profile + review queue
      search/      patient-scoped full-text search (isolation by construction)
      ai/          extraction · contradiction engine · cited SBAR summarizer
      notifications/
    actions/       server actions (all writes funneled through services + guard)
  app/
    (marketing)/   public site
    (auth)/        sign-in / sign-up
    portal/        patient · doctor · org · admin consoles
    api/files/     authenticated document streaming (access-checked per read)
tests/security.test.ts   cross-patient isolation, consent lifecycle, break-glass,
                         search isolation, audit tamper-evidence, citation integrity
```

### The non-negotiables encoded in code

1. **Access guard** (`modules/access/guard.ts`) — every clinical read asserts consent scope, self-ownership, or active break-glass. Platform admins are denied clinical reads.
2. **RAG isolation** — retrieval is one function that always filters by `patient_id` in SQL; the LLM only receives pre-authorized, ID-tagged context; claims citing unknown IDs are dropped.
3. **Verified > self-reported** — display and conflict logic prefer verified lab values; conflicts are flagged, never silently resolved.
4. **Audit everywhere** — views, uploads, consent changes, AI generations, break-glass: all hash-chained (`verifyChain()` detects tampering).

## Compliance posture

- DPDP Act 2023 / DPDP Rules 2025: consent records with purpose + scope + expiry + revoke, access transparency for patients, breach-notification-ready audit trail. **Not a legal compliance claim** — deployment requires legal review.
- ABDM: treated as an interoperability target. Identity (ABHA) and registries (HPR/HFR) sit behind adapters; V3 sandbox integration is a planned milestone, not a dependency.
- Development data is **synthetic only**. Never upload real patient records to this system before production review.

## Known limitations (by design, for now)

- Phone/SMS OTP is stubbed (email+password locally); adapter ready for MSG91/Twilio.
- Ingest pipeline runs inline; move to Inngest when volume demands.
- Emergency access scopes are enforced server-side; time-boxing uses the event's `expiresAt`.
- No DICOM/image OCR locally (multimodal OCR activates with `GEMINI_API_KEY`).
