# MediLink — DPDP & Compliance Checklist

Status reference for the engineering controls that map to India's Digital
Personal Data Protection Act, 2023 and the DPDP Rules, 2025 (notified
13 Nov 2025; phased obligations through ~May 2027). **This is an engineering
self-assessment, not legal advice. Production deployment requires legal review.**

## Consent & notice

- [x] Consent is a first-class data object: grantee, category scopes, purpose,
      expiry, revocation timestamp (`consents` table).
- [x] Granular scopes (demographics / conditions / allergies / medications /
      lab results / imaging / procedures / documents / sensitive) — data
      minimization by scope selection.
- [x] One-tap revocation, effective immediately at the access guard.
- [x] Consent purpose recorded per grant (treatment / consultation / emergency
      / record review).
- [ ] Consent notice text reviewed by counsel (current UI copy is functional).
- [ ] Consent artifact export (machine-readable) — future: align format with
      ABDM consent-artifact structure.

## Data principal rights

- [x] Access transparency: patients see every read of their record
      (Access history page, sourced from the audit log).
- [x] Right to correct: self-reported fields editable; clinical corrections
      flow through the amendment (supersede) mechanism — originals preserved
      for integrity.
- [ ] Right to erasure / grievance redressal workflows — not built; retention
      policy for medical records conflicts with casual deletion, needs legal
      framing (status: archived / superseded states exist as building blocks).

## Security safeguards

- [x] Access control: single enforcement point (access guard) on every
      clinical read; RBAC + consent-scoped ABAC; platform admins denied
      clinical reads by default.
- [x] Tamper-evident audit: append-only hash-chained log with verification
      (`verifyChain()`); tested tamper detection in the security suite.
- [x] Break-glass emergency access: mandatory clinical reason, 60-minute
      window, patient notification, admin review queue.
- [x] File integrity: SHA-256 content hash on every uploaded document;
      originals preserved byte-for-byte.
- [x] Least-privilege reads: search and AI retrieval are patient-scoped in SQL
      (cross-patient isolation covered by automated tests).
- [x] Auth: hashed credentials (Better Auth), httpOnly session cookies,
      7-day expiry with rolling refresh.
- [ ] Encryption at rest beyond provider default (Supabase provides at-rest
      encryption; field-level encryption for especially sensitive fields TBD).
- [ ] Rate limiting + WAF at the edge (Vercel platform config) — pre-launch.
- [ ] Penetration test — pre-launch.
- [ ] Breach notification runbook (72-hour requirement under the Rules) —
      draft needed.

## Data minimization & retention

- [x] No Aadhaar collected anywhere; ABHA stored only as a linked identifier
      when the ABDM adapter is active (never a foreign key).
- [x] Synthetic data only in development (seed script; enforced by policy).
- [x] Document retention states (active / superseded) rather than hard deletes.
- [ ] Retention schedule per record class with legal review.

## Governance

- [ ] Significant Data Fuciary assessment (health data likely qualifies) once
      user base crosses thresholds — DPO appointment, DPIA cadence.
- [ ] Data processing agreements with processors (Vercel, Supabase, Google
      Gemini if enabled) — verify India data residency:
      Vercel functions `bom1`, Supabase `ap-south-1` both in Mumbai.

## ABDM interoperability (adjacent track)

- [x] Adapter seams: `VerificationProvider` (HPR/HFR), ABHA identifier table,
      consent artifact shape informed by ABDM patterns.
- [ ] Sandbox V3 integration spike (M1 ABHA / M2 HIP / M3 HIU) — planned.
- [ ] NRCES FHIR profile conformance for outbound bundles — `resource` JSONB
      columns are pre-shaped for this.
