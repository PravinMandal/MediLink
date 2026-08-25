# ADR-0008: ID-only discovery + patient-present handoff replacing name/phone search

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Product owner — unassigned; Security owner — unassigned; Engineering

## Context

`patientService.search()` currently searches name and phone (BuildPlan §2,
finding 1). The August 2026 review classifies ID-only search as necessary but
insufficient (P0): a predictable or widely shared ID becomes a bearer
identifier; preventing name-directory enumeration does not establish
treatment relationship or authorization. Meanwhile, ID-only lookup alone is
inconvenient in a real consultation.

## Decision

1. **Routine patient discovery is ID/verified-ABHA lookup plus a
   patient-present handoff** (BuildPlan §7.9, §8.2, §9.5). No name/phone
   directory in the routine doctor UI or API.
2. **Lookup hardening:** rate-limited; check-digit validation; error states
   that do not leak whether an arbitrary ID exists. Before authorization, a
   valid identifier returns only "A MediLink record may exist" plus a request
   form — never name, DOB, city, phone, record count, or clinical metadata.
3. **Patient-present handoff:** the patient starts "Share with a clinician
   now", producing an opaque, single-use, short-lived QR/numeric code; the
   clinician scans/enters it after signing in; the patient sees the named
   clinician, purpose, scope, and duration before approving; approval opens
   the scoped workspace directly.
4. **Removal sequencing:** the old name/phone doctor search is removed only
   after the handoff path and assisted-enrollment alternatives are tested
   (BuildPlan §9.7 step 8); facility operational matching, where required,
   lives in a separate permissioned identity-resolution workflow with
   stricter audit (BuildPlan §7.11).
5. **Emergency QR** is an opaque signed token that never encodes raw health
   data or a reusable public patient URL (BuildPlan §7.12).

## Consequences

- This is a real breaking change to `patientService.search()`, not a UI
  update; Phase 2 exit criteria require enumeration, wrong-patient, token
  replay, QR expiry, and pre-consent leakage tests to pass.
- Patients need usable ID handoff tools (copy, large text, printable QR/card)
  on the patient home, or lookup friction will push users to unsafe
  workarounds.
- Related abuse cases (lookup enumeration, token replay, QR abuse) are
  catalogued in `docs/ABUSE-CASES.md`.
