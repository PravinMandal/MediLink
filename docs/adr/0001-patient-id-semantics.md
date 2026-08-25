# ADR-0001: Patient ID semantics — application ID, not national ID

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Product owner — unassigned; Security owner — unassigned; Engineering

## Context

The original "Obsidian Glass" plan positioned the product around a "universal
patient identity." The August 2026 review (BuildPlan §2, §8.1) found this is a
P0 patient-safety risk: an application-generated ID cannot safely establish
that two records represent the same person, and marketing an app ID as a
national identifier creates legal and trust exposure. A predictable or widely
shared ID also becomes a bearer identifier: it prevents name-directory
enumeration but does not establish treatment relationship or authorization.
Possession of an ID must never be treated as consent.

## Decision

1. The identifier is named the **MediLink Patient ID** everywhere — code, UI,
   support material, and marketing. It is an application-scoped identifier
   with a non-enumerable random component and check characters. It must never
   be called or marketed as a "universal ID," "national ID," or proof of
   identity.
2. **Format:** a random, non-sequential base32/URL-safe identifier with
   human-friendly grouping and a check character/checksum to catch
   transcription errors.
3. **Derivation:** never derived from name, date of birth, phone, ABHA,
   Aadhaar, or database primary-key order.
4. **Authorization:** possession of the ID is not authorization. ID-only
   lookup returns no clinical facts before an access decision.
5. **Exposure:** never exposed in public logs, analytics, referrers,
   filenames, or unauthenticated URLs.

## Consequences

- Marketing and UI copy must be audited to remove any "universal identity"
  claims; some existing language needs correction (BuildPlan §2 finding 8).
- Identity proofing, match review, merge/split, aliases, and account-claim
  flows (BuildPlan §8.1) must exist before broad onboarding; the ID alone
  carries no identity assurance.
- Check-character validation enables client-side typo detection and supports
  the ID/ABHA lookup form (BuildPlan §7.9).
- Related: ADR-0008 (ID-only discovery), ADR-0002 (identity merge policy).
