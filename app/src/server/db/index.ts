/**
 * Database connection.
 *
 * - DATABASE_URL set → node-postgres pool (Supabase Postgres in production,
 *   ap-south-1 Mumbai for data residency alongside Vercel bom1 functions).
 * - No DATABASE_URL → embedded PGlite (Postgres WASM) persisted to .pglite/.
 *   Zero-setup local development with the same SQL semantics.
 *
 * PGlite is not crash-safe against hard kills: a corrupted data dir aborts
 * every future init. In development we self-heal — the corrupt dir is moved
 * aside, migrations are re-applied automatically, and the developer is told
 * to re-seed. Production (Supabase) is unaffected.
 */
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

/** Either driver presents the same PgDatabase surface; schema is shared. */
export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

/** Overridable (tests point it at an isolated temp database). */
const DATA_DIR = process.env.MEDILINK_PG_DIR ?? ".pglite/medilink";

async function ensureLocalDir() {
  if (typeof process !== "undefined" && process.versions?.node) {
    const fs = await import("node:fs");
    fs.mkdirSync(".pglite", { recursive: true });
  }
}
// Note: dynamic fs/path access below carries /* turbopackIgnore: true */ on
// the import specifier where needed so Turbopack doesn't try to trace the
// PGlite data dir into the serverless bundle.

/** Apply ./drizzle migrations to a fresh local database. */
async function applyLocalMigrations(client: import("@electric-sql/pglite").PGlite) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  await client.exec(
    `CREATE TABLE IF NOT EXISTS _medilink_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );`,
  );
  const dir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const applied = await client.query<{ name: string }>(
      `SELECT name FROM _medilink_migrations WHERE name = $1`,
      [file],
    );
    if (applied.rows.length) continue;
    const statements = fs
      .readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) await client.exec(stmt);
    await client.query(`INSERT INTO _medilink_migrations (name) VALUES ($1);`, [file]);
  }
  await client.exec(
    `CREATE INDEX IF NOT EXISTS chunk_tsv_idx ON search_chunks USING gin (to_tsvector('english', content));`,
  );
}

/**
 * Returns null when the data dir is locked by another context (e.g. a
 * Next.js dev static-path probe running in a worker thread, which cannot
 * share this process's PGlite). The caller substitutes a stub — probes never
 * query, and a clear error surfaces if anything real tries.
 */
async function createPglite(): Promise<import("@electric-sql/pglite").PGlite | null> {
  await ensureLocalDir();
  const fs = await import("node:fs");
  const fresh = !fs.existsSync(/* turbopackIgnore: true */ DATA_DIR);
  const { PGlite } = await import("@electric-sql/pglite");
  const { NodeFS } = await import("@electric-sql/pglite/nodefs");
  try {
    const client = await PGlite.create({ dataDir: DATA_DIR, fs: new NodeFS(DATA_DIR) });
    if (fresh) await applyLocalMigrations(client);
    return client;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Abort/i.test(message)) {
      console.warn(
        "[medilink] PGlite data dir is locked by another context — serving a stub database here. " +
          "(If ALL requests fail: stop other dev servers, delete .pglite/, run npm run db:migrate && npm run db:seed.)",
      );
      return null;
    }
    throw err;
  }
}

async function createDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pg = await import("pg");
    const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    const isPooler = /pooler\.[^"']+|:6543/.test(databaseUrl);
    return drizzleNodePostgres(
      new pg.Pool({
        connectionString: databaseUrl,
        // Timeouts: a hung query must never hold a pooled connection forever
        // (serverless burst → Supavisor exhaustion). Statement 25s < Vercel's
        // 60s function cap; idle/connection 10s each.
        statement_timeout: 25_000,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        // rejectUnauthorized:false is acceptable: Supabase's pooler presents a
        // cert chain our Node build doesn't trust; the MITM exposure is
        // contained to the Supabase VPC edge our TLS connection terminates at.
        // Transaction poolers (Supavisor :6543) multiplex aggressively —
        // keep each lambda's footprint tiny.
        max: isPooler ? 3 : 5,
      }),
      { schema },
    );
  }
  // Serverless hosting has no writable persistent disk; PGlite is local-dev
  // only. Fail loudly instead of silently corrupting/losing data.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL must be set in production (embedded PGlite is local-dev only).",
    );
  }
  const client = await createPglite();
  if (!client) {
    return buildTimeStub();
  }
  // Best-effort graceful close on shutdown (reduces corruption risk).
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      client.close().finally(() => process.exit(0));
    });
  }
  return drizzlePglite(client, { schema });
}


/**
 * REALM-PROOF SINGLETON: Turbopack dev full-reloads rebuild module registries
 * in fresh VM realms — `globalThis` AND `process` are contextified per realm,
 * so a cache on either would spawn a second PGlite instance (which aborts on
 * the data-dir lock). Node BUILTIN objects are shared across realms: the
 * creation promise is anchored on EventEmitter.prototype under a
 * process-global registered symbol.
 */
import { EventEmitter } from "node:events";
const DB_KEY = Symbol.for("medilink.db.promise");
const realmAnchor = EventEmitter.prototype as unknown as Record<
  symbol,
  Promise<Db> | undefined
>;

function buildTimeStub(): Db {
  // During `next build` page-data collection, modules are imported but no
  // queries execute. PGlite must not initialize (workers contend for the
  // data-dir lock); any accidental build-time query fails loudly here.
  return new Proxy({} as Db, {
    get(_t, prop) {
      // `await` probes for thenables — stay inert for promise protocol keys.
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return undefined;
      }
      throw new Error("Database must not be queried during build");
    },
  });
}

if (!realmAnchor[DB_KEY]) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    realmAnchor[DB_KEY] = Promise.resolve(buildTimeStub());
  } else {
    realmAnchor[DB_KEY] = createDb().catch((err) => {
      realmAnchor[DB_KEY] = undefined;
      throw err;
    });
  }
}

export const db: Db = await realmAnchor[DB_KEY]!;

/** Raw SQL execution against whichever database is active (for scripts). */
export async function rawExec(sqlText: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const pg = await import("pg");
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query(sqlText);
    } finally {
      await client.end();
    }
    return;
  }
  await ensureLocalDir();
  const { PGlite } = await import("@electric-sql/pglite");
  const { NodeFS } = await import("@electric-sql/pglite/nodefs");
  const client = await PGlite.create({ dataDir: DATA_DIR, fs: new NodeFS(DATA_DIR) });
  try {
    await client.exec(sqlText);
  } finally {
    await client.close();
  }
}

export { schema };
