-- C1: kill audit-chain forks. In a valid hash chain every prev_hash is the
-- hash of a distinct prior row, so prev_hash values are naturally unique; a
-- duplicate means two rows chained to the same predecessor (a fork).
-- The unique index turns the race into a 23505 the service retries on.
CREATE UNIQUE INDEX IF NOT EXISTS "audit_prev_hash_uidx" ON "audit_events" ("prev_hash");
