-- Patients: optional ABHA number (India national health id) for the
-- future ABDM linking adapter.
ALTER TABLE "patients" ADD COLUMN "abha_number" text;
