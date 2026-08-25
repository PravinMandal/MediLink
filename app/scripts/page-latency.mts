/**
 * Page latency profiler (dev server). Measures TTFB for key routes so
 * slow-navigation reports can be attributed: framework overhead vs DB.
 * Run with the dev server up: npx tsx scripts/page-latency.mts [base]
 */
const base = process.argv[2] ?? "http://localhost:3000";

const routes = ["/", "/sign-in", "/api/health"];

async function measure(path: string): Promise<number> {
  const t = Date.now();
  const res = await fetch(base + path, { redirect: "manual" });
  await res.arrayBuffer();
  return Date.now() - t;
}

for (const r of routes) {
  // warm the route (JIT compile in dev)
  await measure(r);
  const runs: number[] = [];
  for (let i = 0; i < 3; i++) runs.push(await measure(r));
  const avg = Math.round(runs.reduce((a, b) => a + b, 0) / runs.length);
  console.log(`${r.padEnd(14)} avg ${String(avg).padStart(5)}ms  (${runs.join(", ")})`);
}
