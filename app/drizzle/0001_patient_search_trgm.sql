-- Patient search support: pg_trgm GIN indexes on full_name and phone.
--
-- pg_trgm makes the ilike '%term%' substring search index-backed on
-- Supabase (pg_trgm is available on the free tier). Kept substring rather
-- than prefix-only because doctors search by partial name/phone fragments.
-- PGlite does not ship pg_trgm, so creation is best-effort: it silently
-- skips on PGlite (small local datasets scan fine) and applies on Postgres.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable; skipping trigram search indexes';
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS "patient_full_name_trgm_idx" ON "patients" USING gin ("full_name" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "patient_phone_trgm_idx" ON "patients" USING gin ("phone" gin_trgm_ops);
  END IF;
END
$$;
