/**
 * DB connectivity probe — tries IPv4 then IPv6 explicitly.
 * Run: npx tsx --env-file=.env scripts/db-connect-check.mts
 */
import pg from "pg";
import dns from "node:dns/promises";
import net from "node:net";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("No DATABASE_URL set.");
  process.exit(0);
}

const host = new URL(url).hostname;
const port = Number(new URL(url).port || 5432);

async function tcpProbe(ip: string, label: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: ip, port, timeout: 8000 });
    const done = (ok: boolean) => {
      socket.destroy();
      console.log(`${label} ${ip}: ${ok ? "TCP reachable" : "unreachable"}`);
      resolve(ok);
    };
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

const v6 = await dns.resolve6(host).catch(() => []);
const v4 = await dns.resolve4(host).catch(() => []);
console.log(`host ${host} — AAAA: ${v6.join(", ") || "(none)"} | A: ${v4.join(", ") || "(none)"}`);

let reachable: string | null = null;
for (const ip of v4) if (await tcpProbe(ip, "IPv4")) { reachable = ip; break; }
if (!reachable) for (const ip of v6) if (await tcpProbe(ip, "IPv6")) { reachable = ip; break; }

if (reachable) {
  const t = Date.now();
  // Connect using the IP directly; SNI/host verification disabled because we
  // bypass hostname resolution.
  const client = new pg.Client({
    connectionString: url.replace(host, reachable),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const r = await client.query("SELECT count(*)::int AS n FROM patients");
    console.log(
      `connect via ${reachable}: OK in ${Date.now() - t}ms — patients table has ${r.rows[0].n} rows`,
    );
    await client.end();
  } catch (e) {
    console.log(`connect via ${reachable}: FAILED — ${(e as Error).message.split("\n")[0]}`);
  }
} else {
  console.log("No reachable address — the database host is down or unreachable from this network.");
}
process.exit(0);
