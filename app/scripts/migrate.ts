/**
 * Applies drizzle-kit migrations (./drizzle/*.sql) to whichever database is
 * active (local PGlite or DATABASE_URL Postgres), then runs post-migration
 * raw SQL (full-text expression indexes).
 *
 * Usage: npx tsx scripts/migrate.ts
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
      exec: async (sqlText: string) => {
        await client.query(sqlText);
      },
      query: async <T = Record<string, unknown>>(sqlText: string, params?: unknown[]): Promise<T[]> => {
        const res = await client.query(sqlText, params);
        return res.rows as T[];
      },
      close: () => client.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { NodeFS } = await import("@electric-sql/pglite/nodefs");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(".pglite", { recursive: true });
  const dataDir = ".pglite/medilink";
  const client = await PGlite.create({ dataDir, fs: new NodeFS(dataDir) });
  return {
    exec: async (sqlText: string) => {
      await client.exec(sqlText);
    },
    query: async <T = Record<string, unknown>>(sqlText: string, params?: unknown[]): Promise<T[]> => {
      const res = await client.query<T>(sqlText, params);
      return res.rows as T[];
    },
    close: () => client.close(),
  };
}

/** Raw SQL applied after every migration run (idempotent). */
const POST_MIGRATION_SQL = [
  // Patient-scoped full-text search over search_chunks
  `CREATE INDEX IF NOT EXISTS chunk_tsv_idx ON search_chunks USING gin (to_tsvector('english', content));`,
  // Audit tamper-evidence helper: index by action+time for review queues
  `CREATE INDEX IF NOT EXISTS audit_action_time_idx ON audit_events (action, created_at DESC);`,
];

async function main() {
  if (process.env.DATABASE_URL) {
    console.log("→ Applying migrations to DATABASE_URL Postgres");
  } else {
    console.log("→ Applying migrations to local PGlite (.pglite/medilink)");
  }
  const client = await getRawClient();

  await client.exec(
    `CREATE TABLE IF NOT EXISTS _medilink_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );`,
  );

  const dir = join(process.cwd(), "drizzle");
  if (!existsSync(dir)) {
    console.log("No ./drizzle directory; nothing to apply.");
    await client.close();
    return;
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await client.query<{ name: string }>(
      `SELECT name FROM _medilink_migrations WHERE name = $1`,
      [file],
    );
    if (applied.length > 0) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }
    const sqlText = readFileSync(join(dir, file), "utf8");
    // drizzle-kit statements are separated by `--> statement-breakpoint`
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await client.exec(stmt);
    }
    await client.query(
      `INSERT INTO _medilink_migrations (name) VALUES ($1);`,
      [file],
    );
    console.log(`  ✓ ${file} (${statements.length} statements)`);
  }

  for (const stmt of POST_MIGRATION_SQL) {
    await client.exec(stmt);
  }
  console.log("  ✓ post-migration raw SQL applied");

  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`,
  );
  console.log(
    `Done. ${tables.length} tables: ${tables.map((t) => t.table_name).join(", ")}`,
  );
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
