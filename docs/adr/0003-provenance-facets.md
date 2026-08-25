# ADR-0003: Provenance facets replacing the single `record_trust` enum

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Engineering; Clinical-safety lead — unassigned

## Context

The current schema mixes `verified`, `extracted`, `self_reported`, and
`amended` in a single `record_trust` enum (BuildPlan §2, finding 2). Author
verification, document integrity, extraction confidence, clinical review, and
record correction are different facts; combining them produces misleading UI
where a blue check can be read as clinical correctness. "Amended" is a
lifecycle state, not a trust level, and `amended` overwrites currently
present corrections (a P0 risk in BuildPlan §2).

## Decision

1. **Replace the single enum with independent provenance facets** as defined
   in the `ProvenanceState` structure (BuildPlan §4.1):
   - `sourceType`: native_entry | source_document | patient_reported |
     external_exchange;
   - `author`: identity, organization, credential status and check time;
   - `document`: document ID, SHA-256, page/region references;
   - `review`: not_required | machine_extracted | human_reviewed | attested,
     with reviewer and time;
   - `lifecycle`: active | corrected | superseded | entered_in_error |
     disputed, with `replacesVersionId`;
   - `integrity`: payload hash, signature ID, sealed-at time.
2. **UI renders facets compactly**, e.g. "Attested by Dr. R. Mehta, City
   Diagnostics — 12 Aug 2026 — derived from CBC report, page 1", with the
   full provenance drawer on demand. No unexplained colored pill.
3. **Migration:** the legacy `record_trust` enum is retained only as a
   migration input; legacy rows are backfilled with explicit `legacy_import`
   provenance and are not labelled newly attested (BuildPlan §9.7).
4. **Language:** UI and docs never say "verified" where the system can only
   prove an uploaded source or a verified contributor.

## Consequences

- `provenance_links`, `attestations`, and immutable version rows (BuildPlan
  §9.2–9.3) are prerequisites; the enum cannot simply be renamed.
- Every displayed clinical item must resolve to the structured descriptor,
   and lab batch views must not treat machine extraction as human
   attestation (BuildPlan §13.3).
- Display logic can now distinguish "Contributor verified" from clinical
   truth, reducing the absence-of-data and overwritten-correction risks in
   the risk register.
