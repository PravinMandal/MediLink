// axe-core pass over key pages (dev server).
import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch();
// Reduced motion: scroll reveals settle instantly, so axe measures the
// honest end-state instead of sampling mid-fade opacities (axe factors
// opacity into contrast; below-fold reveals rest at opacity 0 until
// scrolled, and font-swap shifts make the sample a race).
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
// inject axe from node_modules
const { readFile } = await import("node:fs/promises");
const axeSrc = await readFile("node_modules/axe-core/axe.js", "utf8");
let failed = 0;
const audit = async (name) => {
  const results = await page.evaluate(async () => {
    return window.axe.run(document, { resultTypes: ["violations"] });
  });
  const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact));
  console.log(`${serious.length === 0 ? "PASS" : "FAIL"} ${name}: ${serious.length} serious/critical violations`);
  for (const v of serious) console.log(`   - ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  if (serious.length) failed++;
};
const goto = async (path) => {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(axeSrc);
};

await goto("/");
await audit("marketing");

await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "rahul@example.com");
await page.fill('input[type="password"]', "Password123!");
await page.evaluate(axeSrc.replace(/window\.axe/g, "globalThis.__axe = window.axe")); // noop if already injected
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);
await page.evaluate(axeSrc);
await audit("patient dashboard");

await page.goto(base + "/portal/patient/emergency", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.evaluate(axeSrc);
await audit("emergency card page");

await page.goto(base + "/portal/patient/timeline", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.evaluate(axeSrc);
await audit("timeline");

await browser.close();
process.exit(failed ? 1 : 0);
