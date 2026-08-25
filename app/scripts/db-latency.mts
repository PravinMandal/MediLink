/**
 * DB latency probe: measures TCP/TLS connect + simple query RTT to the
 * configured DATABASE_URL. Run: npx tsx scripts/db-latency.mts
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("No DATABASE_URL — local PGlite mode (latency ~0ms).");
  process.exit(0);
}

async function time(label: string, fn: () => Promise<void>) {
  const t = Date.now();
  await fn();
  console.log(`${label}: ${Date.now() - t}ms`);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

await time("connect", async () => {
  await client.connect();
});
await time("SELECT 1", async () => {
  await client.query("SELECT 1");
});
await time("SELECT 1 again", async () => {
  await client.query("SELECT 1");
});
await client.end();
process.exit(0);
