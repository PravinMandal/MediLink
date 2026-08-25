# ADR-0004: Authoring authority separated from disclosure consent

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Product owner — unassigned; Legal counsel — unassigned; Engineering

## Context

The original plan implicitly treated a patient's consent grant as
controlling provider writes: a facility appeared to need a patient-granted
`documents` scope before it could deliver a record created during care. The
August 2026 review (BuildPlan §2, P1; §8.6) classifies this as a real
policy error: permission to contribute a record and permission to disclose
history are related but not identical, and the legal/operational rule needs
review.

## Decision

1. **Separate three questions in policy and UI** (BuildPlan §8.6):
   1. May this verified person/facility create or correct this record as
      part of a documented care/lab workflow? (*authoring authority*)
   2. May a patient opt out of keeping that record in their MediLink
      profile? (*retention/erasure question — needs legal framing*)
   3. May another treating party later read it? (*patient-controlled
      disclosure consent*)
2. **Disclosure consent stays patient-controlled:** `access_requests`,
   `consent_grants`, and consent artefacts (BuildPlan §8.3) govern reads by
   third parties.
3. **Authoring authority is role- and relationship-based:** verified
   practitioner/facility status, staff membership, write permission, and a
   documented encounter or care/task relationship (BuildPlan §7.10
   preconditions, §9.2 `care_relationships`). It is never granted by a
   patient consent scope and never inferred from one.
4. **No silent equivalence:** the UI must not assume a patient must grant a
   facility `documents` scope before the facility can accurately deliver a
   record created during care; jurisdiction- and organisation-specific legal
   review decides questions 1 and 2 (BuildPlan §15 item 3).

## Consequences

- The add-record flow checks authoring basis separately from disclosure
  consent; both are visible in the patient context bar / access banner.
- Open legal questions (contribution basis, erasure vs retention, per-record
  class rules) must be answered before pilot release; engineering may
  prototype behind feature flags but must not invent production policy.
- Consent comprehension testing (BuildPlan §5.2) must not conflate
  "approve a request" with "permit my lab to deliver results".
