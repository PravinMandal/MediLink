// Self-contained E2E: ensure Arjun holds no active grant (revoke if needed),
// doctor requests access → patient sees pending card → grants → card gone.
import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failures++; };

// 0. Patient: revoke any active Arjun grant first (idempotent setup)
const pat0 = await browser.newPage({ viewport: { width: 375, height: 667 } });
await pat0.goto(base + "/sign-in");
await pat0.fill('input[type="email"]', "rahul@example.com");
await pat0.fill('input[type="password"]', "Password123!");
await pat0.click('button[type="submit"]');
await pat0.waitForTimeout(1500);
await pat0.goto(base + "/portal/patient/consents", { waitUntil: "networkidle" });
await pat0.waitForTimeout(800);
const revokeBtn = pat0.getByRole("button", { name: /revoke/i }).first();
const grantRow = await pat0.evaluate(() => /arjun/i.test(document.body.innerText));
if (grantRow && (await revokeBtn.count())) {
  // find the Revoke button in Arjun's row specifically
  const rows = pat0.locator("li", { hasText: /arjun/i });
  const arjunRevoke = rows.first().getByRole("button", { name: /revoke/i });
  if (await arjunRevoke.count()) {
    await arjunRevoke.click();
    await pat0.waitForTimeout(2000);
  }
}
await pat0.close();

// 1. Doctor requests access
const doc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await doc.goto(base + "/sign-in");
await doc.fill('input[type="email"]', "arjun@medilink.health");
await doc.fill('input[type="password"]', "Password123!");
await doc.click('button[type="submit"]');
await doc.waitForTimeout(1500);
const q = doc.locator('input[name="q"], input[type="search"]').first();
await q.fill("Rahul");
await doc.keyboard.press("Enter");
await doc.waitForTimeout(1500);
await doc.locator('a[href*="/portal/doctor/patients/"]').first().click();
await doc.waitForTimeout(1800);
const reqBtn = doc.getByRole("button", { name: /request/i }).first();
if (await reqBtn.count()) {
  await reqBtn.click();
  await doc.waitForTimeout(1500);
  const body = await doc.evaluate(() => document.body.innerText);
  check("doctor sent access request", /request sent/i.test(body));
} else {
  check("doctor request form present", false);
}
await doc.close();

// 2. Patient grants via inbox card
const pat = await browser.newPage({ viewport: { width: 375, height: 667 } });
await pat.goto(base + "/sign-in");
await pat.fill('input[type="email"]', "rahul@example.com");
await pat.fill('input[type="password"]', "Password123!");
await pat.click('button[type="submit"]');
await pat.waitForTimeout(1500);
await pat.goto(base + "/portal/patient/consents", { waitUntil: "networkidle" });
await pat.waitForTimeout(1000);
const hasCard = /waiting for your approval/i.test(await pat.evaluate(() => document.body.innerText));
check("patient sees request inbox card", hasCard);
if (hasCard) {
  await pat.getByRole("button", { name: /grant 30-day access/i }).first().click();
  await pat.waitForTimeout(2500);
  const after = await pat.evaluate(() => document.body.innerText);
  check("grant succeeded (card gone)", !/waiting for your approval/i.test(after));
}
await pat.close();
await browser.close();
process.exit(failures ? 1 : 0);
