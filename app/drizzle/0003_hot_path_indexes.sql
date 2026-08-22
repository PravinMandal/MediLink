-- 0003: hot-path indexes for consent lookups, emergency access review, and lab trends.
-- consents by grantee org (org console checks activeForOrganization per patient)
CREATE INDEX IF NOT EXISTS consents_grantee_organization_id_idx
  ON consents (grantee_organization_id)
  WHERE grantee_organization_id IS NOT NULL;
--> statement-breakpoint
-- emergency access review by practitioner and patient
CREATE INDEX IF NOT EXISTS emergency_access_events_practitioner_patient_idx
  ON emergency_access_events (practitioner_id, patient_id);
--> statement-breakpoint
-- observations trends: per-patient, per-analyte series
CREATE INDEX IF NOT EXISTS observations_patient_name_idx
  ON observations (patient_id, name);
