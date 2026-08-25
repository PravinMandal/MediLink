--> statement-breakpoint
CREATE TYPE access_request_status AS ENUM (
  'draft',
  'submitted',
  'patient_viewed',
  'approved',
  'declined',
  'expired',
  'cancelled'
);
--> statement-breakpoint
CREATE TABLE access_requests (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  requester_user_id text NOT NULL REFERENCES "user"(id),
  requester_practitioner_id text REFERENCES practitioners(id),
  requester_organization_id text REFERENCES organizations(id),
  requester_snapshot jsonb NOT NULL,
  purpose text NOT NULL,
  purpose_detail text,
  visit_reference text,
  suggested_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  date_window_start text,
  date_window_end text,
  requested_days integer NOT NULL,
  status access_request_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  patient_viewed_at timestamptz,
  responded_at timestamptz,
  patient_response_reason text,
  policy_version text NOT NULL DEFAULT 'v1',
  display_copy_version text NOT NULL DEFAULT 'v1',
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX access_request_patient_idx ON access_requests (patient_id, status);
--> statement-breakpoint
CREATE INDEX access_request_requester_idx ON access_requests (requester_user_id, status);
--> statement-breakpoint
CREATE INDEX access_request_correlation_idx ON access_requests (correlation_id);
--> statement-breakpoint
CREATE TABLE consent_artifacts (
  id text PRIMARY KEY,
  consent_id text NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
  access_request_id text REFERENCES access_requests(id),
  artifact jsonb NOT NULL,
  artifact_sha256 text NOT NULL,
  policy_version text NOT NULL DEFAULT 'v1',
  receipt_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX consent_artifact_consent_idx ON consent_artifacts (consent_id);
--> statement-breakpoint
CREATE TABLE patient_identity_state (
  patient_id text PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'provisional'
    CHECK (state IN ('provisional','claim_pending','claim_verified','identity_caution','merged','split_restored')),
  caution_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE identity_claims (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id),
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected')),
  reviewed_by text REFERENCES "user"(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX identity_claim_patient_idx ON identity_claims (patient_id, status);
--> statement-breakpoint
CREATE TABLE identity_matches (
  id text PRIMARY KEY,
  patient_id_a text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_id_b text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','confirmed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE patient_merge_cases (
  id text PRIMARY KEY,
  survivor_patient_id text NOT NULL REFERENCES patients(id),
  merged_patient_id text NOT NULL REFERENCES patients(id),
  identity_match_id text REFERENCES identity_matches(id),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','merged','split')),
  decided_by text REFERENCES "user"(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
--> statement-breakpoint
CREATE TABLE patient_aliases (
  id text PRIMARY KEY,
  alias_patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  canonical_patient_id text NOT NULL REFERENCES patients(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX patient_alias_alias_idx ON patient_aliases (alias_patient_id);
--> statement-breakpoint
CREATE TABLE patient_handoff_tokens (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  code text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_user_id text REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX handoff_expiry_idx ON patient_handoff_tokens (expires_at);
--> statement-breakpoint
CREATE TABLE clinical_resource_versions (
  id text PRIMARY KEY,
  resource_id text NOT NULL,
  resource_type text NOT NULL,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','corrected','superseded','entered_in_error','disputed')),
  replaces_version_id text REFERENCES clinical_resource_versions(id),
  correction_reason text,
  authored_by_id text REFERENCES "user"(id),
  organization_id text REFERENCES organizations(id),
  credential_snapshot jsonb,
  source_document_id text,
  page_refs jsonb,
  review_state text NOT NULL DEFAULT 'not_required'
    CHECK (review_state IN ('not_required','machine_extracted','human_reviewed','attested')),
  reviewed_by text REFERENCES "user"(id),
  reviewed_at timestamptz,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX crv_resource_version_idx ON clinical_resource_versions (resource_id, version);
--> statement-breakpoint
CREATE INDEX crv_patient_idx ON clinical_resource_versions (patient_id, resource_type);
--> statement-breakpoint
CREATE TABLE attestations (
  id text PRIMARY KEY,
  version_id text NOT NULL REFERENCES clinical_resource_versions(id) ON DELETE CASCADE,
  attested_by text NOT NULL REFERENCES "user"(id),
  attestation_text text NOT NULL,
  signature_type text NOT NULL DEFAULT 'session_bound',
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE data_disputes (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  raised_by text NOT NULL REFERENCES "user"(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_review','resolved_disputed','resolved_rejected')),
  resolution_notes text,
  resolved_by text REFERENCES "user"(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX dispute_patient_idx ON data_disputes (patient_id, status);
--> statement-breakpoint
CREATE TABLE outbox_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
--> statement-breakpoint
CREATE INDEX outbox_unprocessed_idx ON outbox_events (processed_at) WHERE processed_at IS NULL;
--> statement-breakpoint
CREATE TABLE job_runs (
  id text PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','failed','dead')),
  idempotency_key text UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
--> statement-breakpoint
CREATE INDEX job_run_status_idx ON job_runs (status, job_type);
--> statement-breakpoint
CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE extraction_jobs (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed','dead')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
--> statement-breakpoint
CREATE INDEX extraction_job_status_idx ON extraction_jobs (status);
--> statement-breakpoint
CREATE INDEX extraction_job_document_idx ON extraction_jobs (document_id);
--> statement-breakpoint
CREATE TABLE document_scan_state (
  document_id text PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','clean','infected','skipped','failed')),
  scanner text,
  scanned_at timestamptz,
  detail text
);
--> statement-breakpoint
CREATE TABLE access_policy_evaluations (
  id text PRIMARY KEY,
  actor_id text REFERENCES "user"(id),
  patient_id text,
  action text NOT NULL,
  scope text,
  decision text NOT NULL CHECK (decision IN ('allow','deny','step_up_required')),
  access_basis_type text CHECK (access_basis_type IN ('self','consent','emergency','none')),
  access_basis_id text,
  allowed_scopes jsonb,
  reason_code text NOT NULL,
  explanation text,
  correlation_id text,
  policy_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX policy_eval_actor_idx ON access_policy_evaluations (actor_id, created_at);
--> statement-breakpoint
CREATE TABLE integrity_checkpoints (
  id text PRIMARY KEY,
  last_seq bigint NOT NULL,
  event_count bigint NOT NULL,
  manifest_sha256 text NOT NULL,
  anchored_externally boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE emergency_read_events (
  id text PRIMARY KEY,
  emergency_event_id text NOT NULL REFERENCES emergency_access_events(id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES "user"(id),
  action text NOT NULL,
  resource_type text,
  resource_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX emergency_read_event_idx ON emergency_read_events (emergency_event_id);
--> statement-breakpoint
ALTER TABLE patients ADD COLUMN patient_code text;
--> statement-breakpoint
CREATE UNIQUE INDEX patient_code_unique_idx ON patients (patient_code);
--> statement-breakpoint
ALTER TABLE consents ADD COLUMN access_request_id text REFERENCES access_requests(id);
--> statement-breakpoint
ALTER TABLE consents ADD COLUMN policy_version text NOT NULL DEFAULT 'v1';
--> statement-breakpoint
ALTER TABLE consents ADD COLUMN receipt_code text;
