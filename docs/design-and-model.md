# MediLink — Design and Model

> Source of truth: the implementation in `app/` (Next.js + Postgres + Drizzle).
> Verified against code, tests (92 passing), and live end-to-end runs.

---

## 1. System Architecture

### 1.1 Overview

MediLink is a **consent-gated longitudinal health record**. Patients own one
chart; verified doctors/labs contribute clinical data; **no professional read
is possible without an active, unexpired, scoped consent grant** — except a
time-boxed, audited emergency window. Every sensitive action is appended to a
**hash-chained audit log**.

It is a classic 3-tier web system, deployed serverless:

```
┌──────────────────────────── CLIENT ────────────────────────────┐
│  React Server Components (default) + small client islands       │
│  (forms, drawers, search, theme toggle, notifications bell)     │
└──────────────┬───────────────────────────────┬──────────────────┘
               │ HTTPS                         │
┌──────────────▼───────────────────────────────▼──────────────────┐
│  APP SERVER — Next.js 16 App Router (Vercel, Node runtime)      │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ Routes  │  │Server Actions│  │ Guards                     │  │
│  │/portal/*│──│ mutations    │──│ requireUser → requireRole  │  │
│  │/api/*   │  │ (forms)      │  │ → requireVerifiedPracti-   │  │
│  │/e/*     │  │              │  │   tioner → access.assert   │  │
│  └─────────┘  └──────────────┘  └────────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────────────────────────────┐   │
│  │ Services (domain)│  │ Worker (/api/worker + outbox jobs) │   │
│  │ consent · records│  │ document extraction, notifications │   │
│  │ patients · audit │  │ contradiction re-scan              │   │
│  └──────────────────┘  └────────────────────────────────────┘   │
└──────────────┬───────────────────────────────┬──────────────────┘
               │ SQL (Drizzle ORM)             │ signed URLs / bytes
┌──────────────▼───────────────┐  ┌────────────▼──────────────────┐
│ DATA — PostgreSQL            │  │ OBJECT STORAGE (Supabase)     │
│ Supabase (prod) / PGlite     │  │ original PDFs/images/text,    │
│ embedded (dev), same schema  │  │ immutable, sha-256 hashed     │
└──────────────────────────────┘  └───────────────────────────────┘
```

### 1.2 Layers and responsibilities

| Layer | Technology | Does | Does not do |
|---|---|---|---|
| Presentation | React Server Components; client islands only for interactivity | Render scoped data; forms via server actions; loading/empty/error/denied states per page | Never enforces security (route guards are UX only) |
| API boundary | Server Actions + `src/app/api/*` routes | All mutations; every one re-authenticates (`requireUser`) and re-authorizes (`access.assert`) | Never trusts client-supplied IDs without ownership checks |
| Policy engine | `modules/access/policy.ts` + `guard.ts` | Fail-closed scope evaluation; `scopeForResource()` throws on unknown types; every decision logged | Never defaults to allow |
| Domain services | `modules/{consent,records,patients,documents,emergency,audit,…}` | Business rules, transactions, idempotency | Never bypass the guard |
| Data | Drizzle ORM → Postgres | Constraints, FKs, unique indexes, hash chain | Never stores originals (only metadata + hashes) |
| Files | Supabase Storage, per-segment key encoding | Immutable originals, signed-URL reads | Never public buckets |
| Async | `/api/worker` + outbox table | Extraction, notifications, re-scans; retries + dead-letter | Never loses a job silently |

### 1.3 Key architectural decisions

1. **Server-first security.** Authorization lives in `access.assert()` on the
   server. Hidden buttons and client route guards are convenience only.
2. **Consent is the addressing scheme.** Reads are keyed
   `(practitioner, patient, scopes, time-window)`, not just `(user, row)`.
3. **Immutable clinical history.** Corrections supersede (new version), never
   overwrite; disputes flag, never edit.
4. **Deterministic before probabilistic.** Conflict detection and the default
   summary are pure functions; the LLM is an optional renderer that must cite
   or drop claims.
5. **Cheap by construction.** One Next.js app + managed Postgres + object
   storage, all on free tiers (Vercel Hobby + Supabase Free); no always-on
   servers, no per-seat services. 3D was removed to cut bundle/JS cost.
6. **Dev/prod parity.** PGlite runs the *same* Drizzle schema + migrations
   locally, so data-layer behavior (including the audit chain) is identical.

---

## 2. Data Model

### 2.1 Entity map

```
user ──1:1── patients ──1:N── consents ──N:1── practitioners ──N:1── user
  │              │                 │                │
  │              │                 │                └── organization membership
  │              ├── conditions / allergies / medication_statements
  │              ├── observations / procedures / immunizations
  │              ├── encounters / diagnostic_reports / documents
  │              ├── clinical_resource_versions (immutable seals)
  │              ├── data_conflicts (system-detected)
  │              └── data_disputes (patient-raised)
  │
  ├── access_requests (doctor asks → patient narrows → grant/decline)
  ├── emergency_windows (break-glass, 60 min, step-up authed)
  ├── notifications (inbox per user)
  └── audit_events (hash-chained, append-only)
```

### 2.2 Core entities (what each stores and why)

- **user** — Better-Auth identity (email, password hash, sessions) plus
  `role`: `patient | doctor | org_staff | org_admin | platform_admin`.
  Role changes are privileged and audited.
- **patients** — the chart root: demographics, `patientCode` (unique,
  non-enumerable `ML-XXXXX-XXXXX-C`), optional 14-digit ABHA, blood-group
  self-report. Linked to a login account when claimed (`userId`), created by
  a facility before that (`createdById`).
- **practitioners** — one row per clinician user (`UNIQUE(userId)`):
  registration number, council, qualification, specialty,
  `verificationStatus` (`unverified | pending | verified | rejected`),
  organization link. **Resubmission updates this row in place** so consent
  grants (keyed by practitioner id) survive corrections.
- **organizations** — facilities (e.g. Sunrise Diagnostics) with verification
  state; staff act under the facility's verified status.
- **consents** — the heart of the model: `patientId`, grantee
  (practitioner/org), `purpose` (treatment/consultation/emergency/
  record_review), `scopes[]` (demographics, conditions, allergies,
  medications, lab_results, documents, …), `expiresAt`, revocation flag,
  content **hash + receipt code** (the patient gets a tamper-evident receipt).
  Revocation is effective immediately (every read re-evaluates).
- **access_requests** — doctor proposes scopes → patient **narrows** (never
  widens) → grant creates the consent, or decline closes it. Full state
  machine, no pre-selected scopes (no dark patterns).
- **emergency_windows** — break-glass: one live window per
  practitioner+patient (idempotent arming), 60 minutes, armed only with
  password step-up; critical scopes only; patient notified; admin-reviewed.
- **documents** — uploaded originals' metadata: title, type, hash
  (sha-256), storage key, attestation state; bytes live in object storage.
- **Clinical tables** — `conditions, allergies, medication_statements,
  observations, procedures, immunizations, encounters, diagnostic_reports`:
  each row carries `patientId`, clinical fields, `trust`
  (`verified | extracted | self_reported`), `sourceDocumentId`,
  `authoredById`, and supersession pointers (never deleted on correction).
- **clinical_resource_versions** — immutable seal per write: canonical
  payload + sha-256, `lifecycleStatus`
  (`active | corrected | superseded | disputed | entered_in_error`),
  correction links. History is append-only.
- **data_conflicts** — contradiction-engine findings with content `_key`,
  `status open/resolved`, evidence-preserving resolution notes.
- **data_disputes** — patient flags with reason; resolution (confirm/dismiss
  + notes) by an authorized clinician; version flag lifts when nothing open
  references the resource.
- **search_chunks** — per-row display `label` + full-text content (GIN
  index) powering record search and dispute labels.
- **notifications** — per-user inbox (grants, requests, emergency alerts).
- **audit_events** — `actorId, actorRole, patientId?, action, resourceType,
  resourceId, reason?, metadata, prevHash → hash`. Hash = sha-256 over the
  canonical serialization chained to the previous row (`GENESIS` for the
  first). Periodic **checkpoints** (manifests) let anyone re-verify the chain.

### 2.3 Relationship rules that matter

- Grants reference `practitioner.id` (stable across resubmission), never the
  user id.
- Dispute raise verifies the flagged row belongs to the raiser's chart
  (single UNION ALL over the 9 clinical tables) — cross-patient flagging is
  rejected.
- `conflicts.resolved_by` has a user FK: human resolutions reference a user,
  system auto-resolutions use NULL (no fake "system" user).
- Deletions cascade only downward (chunks die with their row); clinical
  facts are never hard-deleted, only superseded.

---

## 3. Algorithm Selection

Every algorithm was chosen for **auditability over cleverness** — a health
record must be explainable in a dispute.

### 3.1 Contradiction detection (deterministic rules)

| Detector | Rule | Trigger |
|---|---|---|
| Blood group | verified lab value ≠ patient self-report | critical conflict; verified value displayed |
| Allergy | same substance, distinct `criticality‖reaction` across live rows | warning |
| Duplicate document | identical `contentHash` on 2+ documents | info |
| Lab value | same analyte + same date, distinct numeric values | warning |

- Rows carry a content `_key` (sha-256 of kind + details) so distinct
  analytes/allergies coexist as separate rows and re-scans dedupe.
- **Reconciliation:** after each scan, open conflicts whose `_key` was not
  reproduced are auto-closed with a preserved resolution note (corrections
  and supersessions clear stale banners automatically). Key-less legacy rows
  are left alone (unprovable either way).
- Why rules, not ML: reproducible, unit-testable (48 tests), zero
  hallucinations, runs in milliseconds inside the request/worker.

### 3.2 Summarization (deterministic SBAR + cited LLM option)

- Default mode is a **pure function**: scoped facts → SBAR structure
  (key events, history, recent changes, open data issues), every sentence
  carrying source citations. Pre-generated for the demo chart.
- LLM mode is a renderer under the same contract: **a claim without a
  source is dropped**, recorded-fact language never implies AI judgment, and
  the model badge (deterministic vs `LLM · model`) is always shown.
- Scope-gated: a stored summary from broader consent is never shown to a
  narrower grantee (decision D12).

### 3.3 Identity and access algorithms

- **Patient code** `ML-XXXXX-XXXXX-C`: random segments + check character that
  catches typos; input normalization (case/dash-insensitive). Possession of
  a code grants nothing — lookup is ID-only and reveals nothing pre-consent.
- **Policy evaluation**: `scopeForResource()` maps every record kind to its
  consent scope and **throws on unknown kinds** (fail-closed); emergency
  basis exposes a fixed critical set only; revocation re-evaluated per read.
- **Rate limiting** on discovery/lookup endpoints against enumeration.
- **Verification**: mock provider auto-approves plausible registrations
  (demo), implausible ones queue for human review; every submission and
  decision is audit-logged with provider + outcome + resubmission flag.

### 3.4 Retrieval

- Record search runs over `search_chunks` (label + full text, GIN-indexed),
  always filtered by patient and by the reader's granted scopes; same index
  supplies human labels for the concerns queue without schema-guessing.

---

## 4. Technology Stack

| Layer | Choice | Why (and cost) |
|---|---|---|
| Framework | **Next.js 16** (App Router, React Server Components, Server Actions) | One deployable: SSR pages, mutations, and APIs; server components keep PHI out of client bundles. Free (open source). |
| Language | **TypeScript** (`strict`, 0 errors enforced) | Catches scopeilier mismatches at compile time; 92-test suite on top. |
| Styling | **Tailwind CSS v4** (`@theme inline` semantic tokens) | Themeable design tokens (Daylight/Obsidian); no runtime CSS-in-JS cost. |
| ORM | **Drizzle ORM** | SQL you can read, migrations as files, same schema dev↔prod. |
| Database | **PostgreSQL** — Supabase (prod) / **PGlite** embedded (dev) | Managed Postgres free tier in prod; zero-setup identical engine locally. pgcrypto hashing path in prod, JS fallback in tests. |
| Object storage | **Supabase Storage** (signed URLs) | Private buckets; per-segment key encoding preserves `/` separators. Free tier suffices for a pilot. |
| Auth | **Better-Auth** (email/password, sessions, password reset, email verification) | Self-hosted sessions in our own DB; Google OAuth boundary ready when credentials exist. ₹0. |
| Hosting | **Vercel Hobby** | Serverless Next.js, preview deploys, cron-capable worker route; 60s `maxDuration` budgeted for uploads/extraction. Free. |
| Tests | **Vitest** (unit/integration vs throwaway PGlite), **Playwright** (E2E journeys), **axe-core** (a11y) | 92 unit + ~60 scripted browser checks + contrast/dark audits. All free. |
| Icons | **Lucide** | Single consistent icon language. |
| Removed | three.js / react-three-fiber | The 3D centerpiece rendered poorly and cost bundle + warnings; replaced with CSS product mocks. |

**Total hosting cost for the pilot: ₹0** (Vercel Hobby + Supabase Free; no
per-seat or per-API-key services in the critical path).

---

## 5. User Interface (UI) Design

### 5.1 Design language

- **Typography:** Fraunces (display serif, editorial trust), Instrument Sans
  (UI), Plex Mono (codes/hashes/values — `num` class).
- **Color:** pine (primary trust), alert/amber/info status tones, all
  contrast-tested per mode (WCAG AA, axe-enforced). Glass/frost effects only
  where they aid hierarchy; body-text cards are solid for deterministic
  contrast.
- **Shape & motion:** 12–24px radii, 1px `line` borders, soft shadows;
  single `Reveal` scroll system (opacity/translate only), full
  `prefers-reduced-motion` support, view-transition theme wipe.

### 5.2 Themes

Daylight (default), Obsidian (dark), System-follow, plus independent Reduce
Transparency toggle — persisted, pre-hydration script prevents flash.
Dark mode is a separately designed palette, not an inversion (verified
across 12 pages: dashboards, forms, tables, drawers, AI summary, emergency).

### 5.3 Information architecture (per role)

- **Marketing (`/`)** — thesis hero with live-pattern consent card, trust
  strip, evidence pillars, chain section (a lab report followed seal→gate→
  citation), 4-step journey, role cards, "what we do NOT do" honesty panel,
  FAQ, CTA. Zero canvas, zero overflow, mobile-first.
- **Patient portal** — dashboard (glance band: allergies/problems/meds/
  activity), health record with provenance drawers ("flag a concern"),
  documents, timeline, access centre (grant/narrow/decline + revoke),
  emergency QR card + print, access history, profile/ABHA/themes.
- **Doctor workspace** — identifier lookup (never a name/phone directory),
  consent-scoped record: AccessBanner (purpose, scopes, exact expiry,
  renewal), patient context bar (wrong-patient escape), 10-second glance
  band, cited evidence summary, concerns queue (confirm/dismiss),
  labs/trends, documents, contribute (add/upload), inbox, emergency access.
- **Lab console** — consented-patient upload (original preserved
  byte-for-byte, values extracted to trends), attestation review queue.
- **Admin** — verification queues, emergency oversight (reviewed/unreviewed,
  reviewer notes), audit stream, roles.

### 5.4 AI UX

Summaries render as an **evidence rail**: recorded-fact groups as stations,
each claim with inline citation chips resolving to sealed rows — visually
distinct from authoritative records, with mode badge, generation time, and
"verify against sources" affordance. Long responses paginate by group;
errors, empty states (honest "no record found as of this date"), and
permission-denied states are all designed, not default.

### 5.5 Every-state discipline

Each workflow ships normal / loading / empty / error / partial-data /
denied / expired-session / malformed-input / slow-network / mobile / both
themes — enforced by the 34-check Playwright suite, not by convention.

---

## 6. Database Design

### 6.1 Schema surfaces (Drizzle, `src/server/db/schema.ts`)

| Table | Key columns / constraints | Indexes |
|---|---|---|
| `user` | Better-Auth fields + `role` | id, email unique |
| `patients` | `patientCode` unique, `abha` (validated), `userId?`, `createdById` | patientCode unique, userId |
| `practitioners` | `userId` **unique**, reg.no, council, `verificationStatus`, `verifiedAt/By` | `practitioner_user_unique`, status |
| `organizations` + staff links | verification state | status |
| `consents` | patient, grantee, purpose, `scopes[]`, `expiresAt`, revoked, hash, receipt | patient+status, grantee, expiry |
| `access_requests` | suggested vs granted scopes, state, decline reason | patient+state |
| `emergency_windows` | practitioner+patient, `liveFor` 60 min, reason, step-up proof, review | live-window lookup |
| `documents` | patient, hash unique-ish, storage key, attestation | patient, hash |
| clinical ×9 | `patientId` FK, trust, source/author refs, supersession pointers | patient per table |
| `clinical_resource_versions` | resourceId, canonical payload, sha-256, lifecycle | resource lookup |
| `data_conflicts` | patient, kind, `_key` in details, status | `(patient,status)` |
| `data_disputes` | patient, resource, reason, status, resolution+notes | patient+status |
| `search_chunks` | patient, recordId, label, content | GIN full-text, patient |
| `notifications` | user, kind, payload, read | user+read |
| `audit_events` | actor, action, resource, `prevHash→hash` | actor, patient, action |
| `practitioner_verifications` | per-submission history (provider, outcome) | practitioner |

### 6.2 Integrity mechanisms

- **Fail-closed reads:** every clinical query is built with the evaluated
  scope set; narrower consent = fewer tables touched, never filtered rows.
- **Idempotency:** extraction retry deletes by `sourceDocumentId` before
  re-insert (no duplicate observations); break-glass arming is idempotent
  per live window; outbox dedupes by event key.
- **Concurrency:** audit hash computed in-transaction (pgcrypto single
  statement in prod; serialized fallback in tests); corrections link
  `replacesVersionId` so concurrent edits fork visibly instead of clobbering.
- **Migrations:** numbered Drizzle SQL + journal, applied identically to
  Supabase and PGlite; seed produces the golden chart, conflicts, SBAR, and
  demo accounts with a verified chain (`chain intact ✓`).

---

## 7. System Flow

### 7.1 Consent lifecycle (the core loop)

```
Doctor (verified, no access)
  │ identifier lookup (ID only, nothing leaks)
  ▼
Access request (proposes scopes + purpose + duration)
  │ patient inbox card: who / why / which / how long
  ├─ Decline ──► closed + notified
  └─ Grant (patient NARROWS scopes) ──► consent {hash, receipt, expiry}
        │ doctor workspace unlocks ONLY granted scopes
        │ AccessBanner shows purpose · scopes · exact expiry
        ├─ Renew ──► new request before expiry
        └─ Revoke ──► immediate; next read denied + audited
```

### 7.2 Lab contribution → citation

```
Lab uploads original (consented patient only)
  → magic-byte validation, ≤4MB → bytes stored immutable + sha-256
  → worker extracts observations → structured rows (trust=extracted)
  → attestation (doctor/lab reviews, seals version)
  → contradiction re-scan → indexed into search_chunks
  → summary cites it (claim ↔ sealed row, page-level)
```

### 7.3 Emergency (break-glass)

```
Unconscious patient → verified doctor opens Emergency
  → enters Patient ID + clinical reason + own password (step-up)
  → ONE 60-min window (idempotent) → critical scopes only
  → every read audited → patient notified → admin reviews
```

### 7.4 Dispute loop

```
Patient flags row in provenance drawer (chart-ownership checked)
  → version marked disputed → doctor "concerns" card appears
  → Confirm (issue recorded; correction follows) or Dismiss (+required note)
  → last-open resolution lifts the version flag; trace kept in disputes+audit
```

### 7.5 Discovery & scan paths

```
Handoff token (single-use, expiring) → redeem → request → grant
QR scan (/e/<token>) → login (context preserved via ?next=) → scoped view
Unknown token → invalid state, zero patient data
```

---

*Generated from the MediLink implementation on 2026-09-09. Where this
document and the code disagree, the code wins — please flag it.*
