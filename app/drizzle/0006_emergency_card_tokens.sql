--> statement-breakpoint
CREATE TABLE emergency_card_tokens (
  id text PRIMARY KEY,
  patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  token text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX emergency_card_patient_idx ON emergency_card_tokens (patient_id);
