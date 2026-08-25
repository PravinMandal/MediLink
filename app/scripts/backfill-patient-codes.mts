/**
 * Backfill: assign a MediLink Patient ID (patient_code) to every patient
 * lacking one, and backfill provenance state defaults for identity.
 * Idempotent; safe to re-run.
 */
function generatePatientCode(): string {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let body = "";
  for (let i = 0; i < 10; i++) body += ALPHABET[bytes[i]! % 32];
  let acc = 0;
  for (const ch of body) acc = (acc * 31 + ALPHABET.indexOf(ch)) % 32;
  const check = ALPHABET[acc];
  return `ML-${body.slice(0, 5)}-${body.slice(5)}-${check}`;
}

async function getRawClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pg = (await import("pg")).default;
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
    await client.connect();
    return {
      query: async <T = Record<string, unknown>,>(sqlText: string, params?: unknown[]): Promise<T[]> => {
        const res = await client.query(sqlText, params);
        return res.rows as T[];
      },
      close: () => client.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { NodeFS } = await import("@electric-sql/pglite/nodefs");
  const client = await PGlite.create({ dataDir: ".pglite/medilink", fs: new NodeFS(".pglite/medilink") });
  return {
    query: async <T = Record<string, unknown>,>(sqlText: string, params?: unknown[]): Promise<T[]> => {
      const res = await client.query<T>(sqlText, params as never[]);
      return res.rows as T[];
    },
    close: () => client.close(),
  };
}

const client = await getRawClient();
const missing = await client.query<{ id: string }>(
  "SELECT id FROM patients WHERE patient_code IS NULL",
);
console.log(`Patients without a Patient ID: ${missing.length}`);
for (const p of missing) {
  await client.query("UPDATE patients SET patient_code = $1 WHERE id = $2", [
    generatePatientCode(),
    p.id,
  ]);
}
const states = await client.query<{ n: number }>(
  `SELECT count(*)::int AS n FROM patients p
   WHERE NOT EXISTS (SELECT 1 FROM patient_identity_state s WHERE s.patient_id = p.id)`,
);
console.log(`Patients without identity state: ${states[0]!.n}`);
await client.query(
  `INSERT INTO patient_identity_state (patient_id, state)
   SELECT p.id, 'provisional' FROM patients p
   WHERE NOT EXISTS (SELECT 1 FROM patient_identity_state s WHERE s.patient_id = p.id)`,
);
const total = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM patients WHERE patient_code IS NOT NULL");
console.log(`Patients with Patient ID: ${total[0]!.n}`);
await client.close();
