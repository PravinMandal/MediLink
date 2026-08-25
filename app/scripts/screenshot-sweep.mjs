/**
 * Screenshot sweep — signs in as each role and captures every portal page.
 * Output: shots/<role>/<page>.png
 * Run with dev server up: node scripts/screenshot-sweep.mjs
 * Requires: npx playwright install chromium (one-time)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASSWORD = "Password123!";
const OUT = "shots";

const ROLES = [
  {
    name: "patient",
    email: "rahul@example.com",
    pages: [
      ["home", "/portal/patient"],
      ["record-timeline", "/portal/patient/record"],
      ["record-docs", "/portal/patient/record?tab=documents"],
      ["documents", "/portal/patient/documents"],
      ["consents", "/portal/patient/consents"],
      ["access-history", "/portal/patient/access-history"],
      ["emergency", "/portal/patient/emergency"],
      ["profile", "/portal/patient/profile"],
    ],
  },
  {
    name: "doctor",
    email: "meera@medilink.health",
    pages: [
      ["find", "/portal/doctor"],
      ["my-patients", "/portal/doctor/patients"],
      ["inbox", "/portal/doctor/inbox"],
      ["emergency", "/portal/doctor/emergency"],
      ["verification", "/portal/doctor/verification"],
      ["profile", "/portal/doctor/profile"],
      ["patient-workspace", null], // resolved after finding a patient id
    ],
  },
  {
    name: "lab",
    email: "lab@sunrise.health",
    pages: [
      ["queue", "/portal/org"],
      ["profile", "/portal/org/profile"],
    ],
  },
  {
    name: "admin",
    email: "admin@medilink.health",
    pages: [
      ["overview", "/portal/admin"],
      ["verification", "/portal/admin/verification"],
      ["emergency", "/portal/admin/emergency"],
      ["audit", "/portal/admin/audit"],
      ["roles", "/portal/admin/roles"],
    ],
  },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const role of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Sign in through the real form so the session cookie lands properly.
  await page.goto(`${BASE}/sign-in`);
  await page.fill('input[name="email"], #email, input[type="email"]', role.email);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const [name, path] of role.pages) {
    try {
      let url = path;
      if (name === "patient-workspace") {
        // Find the first patient link on my-patients.
        await page.goto(`${BASE}/portal/doctor/patients`);
        const link = page.locator('a[href*="/portal/doctor/patients/"]').first();
        if ((await link.count()) === 0) continue;
        url = await link.getAttribute("href");
      }
      await page.goto(url.startsWith("http") ? url : BASE + url);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);
      mkdirSync(`${OUT}/${role.name}`, { recursive: true });
      await page.screenshot({ path: `${OUT}/${role.name}/${name}.png`, fullPage: false });
      console.log(`✓ ${role.name}/${name}`);
    } catch (e) {
      console.log(`✗ ${role.name}/${name}: ${e.message.split("\n")[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("done");
