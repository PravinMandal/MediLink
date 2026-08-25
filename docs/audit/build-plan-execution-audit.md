# Build-Plan Execution Audit — 2026-08-25

Method: full read of `BuildPlan.md` (1985 lines), first-hand line-by-line
inspection of every server module, action, portal page, and the test suite,
plus verification runs (tsc, vitest, lint, build, migration replay).
Parallel subagent audits were attempted (4 dispatched); all were lost to
infrastructure rate-limits/timeout, so every finding below was verified
directly against the code.

## Verdict

The codebase is substantially real. The plan's P0 spine — centralized policy
evaluation (`access/policy.ts`), `access_requests` + consent artefacts with
receipt codes, immutable record versions + canonical payload hashing +
attestations, durable extraction jobs + transactional outbox, hash-chained
audit with Merkle checkpoints, magic-byte upload validation, ID-only
discovery with patient-present handoff, step-up break-glass, patient-scoped
FTS — is genuinely implemented and covered by behavioral tests (71 → 77
after this pass). No fake/stub modules were found; the only "mock" is the
documented dev-mode identity verification provider, which is a deliberate
provider seam.

## Defects found and fixed in this pass

| # | Severity | Location | Finding | Fix |
|---|---|---|---|---|
| 1 | **P0 authz** | `consent/service.ts revoke()` | Revocation never checked that the grant belonged to the calling patient — any signed-in patient could revoke another patient's active grant by ID. | Ownership asserted on the owning patient row AND re-checked inside the UPDATE predicate; uniform ACCESS_DENIED. Regression tests added (denied cross-patient, allowed owner). |
| 2 | **P0 privacy** | `portal/doctor/patients/[id]/page.tsx:85` | Pre-authorization "no consent" screen rendered the patient's full name, sex, DOB — exactly what §7.9 forbids disclosing before authorization. | Header now shows only the non-secret Patient ID + "Consent required". |
| 3 | **P1 functional** | `identity/discovery.ts` ABHA path | Verified-ABHA lookup queried `patient_identifiers`, but no code path ever writes that table — patients save ABHA on `patients.abha_number`. Lookup could never succeed. Also did a full-table scan + N+1 reads. | Single indexed query over identifiers, plus digit-equal fallback to `patients.abha_number` gated on a claimed account (`user_id IS NOT NULL`). Tests added (hit via profile ABHA; unclaimed record NOT discoverable). |
| 4 | **P1 security** | `emergency/page.tsx` QR | Emergency-card QR encoded `/portal/doctor/patients/<raw patient UUID>` — a permanent, reusable patient identifier in printed form (§7.12 violation). | New `emergency_card_tokens` table (migration 0006) + `emergencyCard` service: opaque 160-bit tokens stored hashed, reusable across renders, explicit rotate-on-lost-card action with confirm, audited issue/rotate/scan/invalid events, new `/e/[token]` route resolving only for signed-in doctors and redirecting into the still-consent-gated record page. Non-doctor scans get a neutral explanation. |
| 5 | **P1 clinical safety** | `ai/summarize.ts` | Allergy absence rendered as "No allergies documented in any record." — a clinical negative from absent data (§3 P0, §11.5). | Now "No allergy record found in MediLink." |
| 6 | **P2 UX/safety copy** | doctor + patient summary cards | SBAR headings "Assessment"/"Plan" implied AI clinical interpretation (§7.13). | Doctor view: "Recorded critical facts / Relevant recorded history / Recent documented changes / Recorded follow-up & medicines". Patient view: "Key facts / Relevant history / Recent changes / …". |
| 7 | **P2 UX** | `portal/patient/page.tsx` | Patient Home lacked §7.6's attention strip (pending access requests visible only in Access centre) and any coverage/freshness note. | Amber pending-request alert with CTA at top of home when decisions are waiting; concrete coverage line ("Newest document on file: … MediLink may not contain your complete history.") under the snapshot. |
| 8 | P2 perf/hygiene | various | Dead imports (8 lint warnings), unused schema import. | Lint now 0 problems. |

## Verified-correct strengths (kept, not rebuilt)

- Policy evaluation records every allow/deny in `access_policy_evaluations`
  with reason codes and correlation IDs; platform admins fail closed.
- Audit chain: atomic single-statement INSERT chaining (no advisory-lock
  serialization), unique `prev_hash` fork protection with bounded retry,
  PGlite fallback path, chunked `verifyChain`, Merkle-segment checkpoints
  with external-anchor flag; tamper + fork tests prove detection.
- Outbox/jobs: same-transaction publish, FOR UPDATE SKIP LOCKED claiming,
  idempotency keys, dead-letter at bounded attempts, operator requeue,
  cron worker with mandatory CRON_SECRET in production.
- Upload v2: filename/MIME/size validation, magic-byte sniffing must match
  declared type, immutable original bytes, scan-state quarantine honored by
  the file route (fresh policy decision per read, uniform 404s, nosniff,
  emergency-read event rows).
- Lab review queue: viewing never attests; one documentId per attestation;
  `structured_data_unavailable` path delivers original without inventing fields.
- Consent artefacts: SHA-256-hashed JSON artefact, receipt code, policy
  version, request linkage; patient scope selection has zero preselection.
- Discovery: uniform messages, privacy-safe audit metadata, single-use
  atomic handoff redemption, rate limits with abuse audit.

## Plan §13 quality-gate coverage matrix

Verified against `tests/security.test.ts` (35 tests), `tests/p0-foundation.test.ts`
(38), `tests/range-bar.test.ts` (7) — all run against a throwaway PGlite with
real DB round-trips, better-auth sign-ups, and real policy/guard calls. No
shallow mocks.

| Gate | Status | Evidence |
|---|---|---|
| Cross-patient reads | ✅ covered | "denies a consented doctor access to a DIFFERENT patient", "patients cannot access another patient's record", search-isolation test |
| Cross-org | ✅ covered | "denies lab staff without an organization grant"; retry action org-bound lookup |
| Partial scope | ✅ covered | fine-grained scopes test + imaging-only grant test + medication-write-scope test |
| Post-revocation | ✅ covered | "blocks access immediately after revocation", "revocation is effective immediately" |
| Expired grants | ✅ covered | "blocks expired consents" |
| Emergency boundary | ✅ covered | break-glass subset-scope, time-box, flagged-blocks-rearm, profile-read audit tests |
| Enumeration / rate-limit | ✅ covered | uniform no-record message, lookup rate-limit, handoff single-use + expiry |
| MIME spoof / oversized upload | ✅ covered | pipeline-v2 spoof rejection + size-cap tests |
| Audit tamper detection | ✅ covered | chain verify, direct-mutation tamper, fork-detection tests |
| Idempotent writes/jobs | ✅ covered | job idempotency-by-key, outbox retry/DLQ tests |
| Stale-session role change | ⚠️ partial | mitigated in code (`getSessionUser` re-reads user row; `setUserRole` re-asserts actor role from DB); no dedicated test |
| Admin case-evidence dual authorization | ❌ missing | admin is hard-denied clinical reads (tested), but the §6.4 narrow dual-authorized case-evidence flow doesn't exist yet |

Biggest remaining test gaps: stale-session behavior under mid-session role
change; a concurrency test for revoke-vs-in-flight-download (the short
authorization lease §7.8 describes); policy-evaluation log reconciliation
against business events (§9.6 daily reconcile is worker-side, untested).

## Remaining known gaps (deliberate, documented)

- Malware scanning is an integration point (`MALWARE_SCANNER`), disabled in
  the pilot demo environment; files stay behind the authorized file route.
- Rate limiting is per-instance (documented); shared store is the
  production swap point without caller changes.
- ABDM adapter remains future work (data model landed; needs credentials).
- RLS/database-role hardening and external checkpoint anchoring require
  infrastructure outside this repo.
