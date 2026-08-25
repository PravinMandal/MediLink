# ADR-0005: Durable jobs + transactional outbox over inline processing

- **Status:** Proposed (August 2026, per root `BuildPlan.md`)
- **Date:** 2026-08-24
- **Deciders:** Engineering; Security owner — unassigned

## Context

The current document pipeline performs extraction inline (BuildPlan §2,
finding 5). Inline processing conflates upload, extraction, review,
attestation, and release; a failure loses work, blocks the request, and
cannot be retried idempotently. Clinical side effects (audit events,
notifications, indexing) must not depend on best-effort hooks. The August
2026 plan requires explicit upload/extraction/review/attestation/release
states and a durable ingestion pipeline (BuildPlan §7.11, §9.4).

## Decision

1. **Every external side effect is written through a transactional outbox**
   in the same database transaction as the originating business event
   (BuildPlan §9.2 `outbox_events`, §9.6). Audit and business events are
   reconciled daily for missing pairs.
2. **Durable, idempotent workers** perform OCR/extraction, indexing,
   notifications, and checkpoint anchoring (`job_runs`, `idempotency_keys`).
   Workers have retry policy, a dead-letter queue, operator requeue, and
   duplicate-safe semantics (BuildPlan §10.4).
3. **Serverless `after()` is best-effort only** and is not the durability
   mechanism for clinical processing (BuildPlan §9.4).
4. **Pipeline order** (BuildPlan §9.4): upload → validate/quarantine →
   malware scan + MIME signature validation → immutable document metadata +
   SHA-256 → commit outbox event → worker extracts text/OCR to a derived
   artefact → candidate fields with page references → reviewer
   confirm/correct/reject → attested release → indexing/notification.
5. **Originals are immutable:** original bytes never change when OCR is
   retried; derivatives are replaceable and labelled.

## Consequences

- Extraction becomes an asynchronous, visible, retryable state; the lab work
  queue is driven by job state, not request lifetime.
- Idempotency tests are required for all write and external side-effect
  paths (BuildPlan §13.1); failures must surface operator-readable error
  codes.
- The outbox is also the mechanism that keeps the audit chain consistent
  with business events (ADR-0006).
