// Survey shots: marketing + each portal role, desktop & mobile.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PASSWORD = "Password123!";
const accounts = [
  ["patient", "rahul@example.com", "/portal/patient"],
  ["doctor", "meera@medilink.health", "/portal/doctor"],
  ["org", "lab@sunrise.health", "/portal/org"],
  ["admin", "admin@medilink.health", "/portal/admin"],
];

const browser = await chromium.launch();

async function login(page, email) {
  await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="email"]', { timeout: 60000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Server-action sign-in then redirect to the role portal.
  await page.waitForURL("**/portal/**", { timeout: 90000 });
  await page.waitForTimeout(2500);
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `shots/survey-${name}.png`, fullPage });
  console.log("shot", name);
}

// Public pages
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot(page, "marketing-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await shot(page, "marketing-mobile");
  await page.close();
}

for (const [label, email] of accounts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await login(page, email);
    await shot(page, `${label}-desktop`);
    if (label === "doctor") {
      const link = page.locator('a[href^="/portal/doctor/patients/"]').first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(3000);
        await shot(page, "doctor-record");
      }
    }
    if (label === "patient") {
      await page.goto(BASE + "/portal/patient/timeline", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await shot(page, "patient-timeline");
      await page.goto(BASE + "/portal/patient/consents", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await shot(page, "patient-consents");
    }
    if (label === "org") {
      const rev = page.locator('a[href*="/portal/org/review"]').first();
      if (await rev.count()) {
        await rev.click();
        await page.waitForTimeout(3000);
        await shot(page, "org-review");
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await shot(page, `${label}-mobile`, false);
  } catch (err) {
    console.error(label, "FAILED:", String(err).slice(0, 300));
    try { await shot(page, `${label}-error`, false); } catch {}
  }
  await ctx.close();
}

await browser.close();
console.log("done");
