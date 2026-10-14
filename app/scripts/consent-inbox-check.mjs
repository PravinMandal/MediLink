// Self-contained E2E for the core consent loop on current UI:
// revoke Sanjay setup → identifier lookup → access request → patient grants
// (scoped) → card gone → doctor workspace lists the grant.
//
// Prerequisite: seed with VERIFICATION_PROVIDER=mock so the seed doctors
// verify (with the fail-closed manual_review default the lookup form never
// renders and this fails at `input[name="identifier"]`).
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};
const signIn = async (page, email) => {
  await page.goto(base + "/sign-in");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
};

// 0. Rahul: read own Patient ID, revoke any live Sanjay grant (clean setup).
const pat0 = await browser.newPage({ viewport: { width: 375, height: 667 } });
await signIn(pat0, "rahul@example.com");
await pat0.goto(base + "/portal/patient", { waitUntil: "networkidle" });
await pat0.waitForTimeout(1200);
const code = await pat0.evaluate(() => {
  const m = document.body.innerText.match(/ML-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]/);
  return m ? m[0] : null;
});
check("owner sees own Patient ID", !!code, code ?? "none");
await pat0.goto(base + "/portal/patient/consents", { waitUntil: "networkidle" });
await pat0.waitForTimeout(1000);
// NOTE: paired doctor is Sanjay (not Arjun): Arjun is the break-glass
// script's doctor and may hold a live emergency window, which lookup
// correctly treats as an active authorization (no request form).
for (let i = 0; i < 3; i++) {
  const rows = pat0.locator("li", { hasText: /sanjay/i });
  const btn = rows.first().getByRole("button", { name: /^Revoke$/ });
  if ((await rows.count()) === 0 || (await btn.count()) === 0) break;
  await btn.click();
  await pat0.waitForTimeout(2000);
}
await pat0.close();
if (!code) {
  console.log("no code — aborting");
  await browser.close();
  process.exit(1);
}

// 1. Sanjay: identifier lookup → request_access → send request.
const doc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await signIn(doc, "sanjay@medilink.health");
await doc.goto(base + "/portal/doctor", { waitUntil: "networkidle" });
await doc.fill('input[name="identifier"]', code);
await doc.getByRole("button", { name: /^Look up$/ }).click();
await doc.waitForTimeout(2500);
const reqForm = doc.locator('input[name="patientId"]');
check("lookup offers request flow", (await reqForm.count()) > 0);
if ((await reqForm.count()) > 0) {
  await doc.check('input[name="suggestedScopes"][value="conditions"]');
  await doc.check('input[name="suggestedScopes"][value="allergies"]');
  await doc.getByRole("button", { name: /Send access request/ }).click();
  await doc.waitForTimeout(2500);
  const body = await doc.evaluate(() => document.body.innerText);
  check("doctor sent access request", /request sent/i.test(body));
}
await doc.close();

// 2. Rahul: inbox card → review → grant scoped access.
const pat = await browser.newPage({ viewport: { width: 375, height: 667 } });
await signIn(pat, "rahul@example.com");
await pat.goto(base + "/portal/patient/consents", { waitUntil: "networkidle" });
await pat.waitForTimeout(1200);
const hasCard = /waiting for your decision/i.test(await pat.evaluate(() => document.body.innerText));
check("patient sees request inbox card", hasCard);
if (hasCard) {
  await pat.getByRole("button", { name: /Review and grant/ }).first().click();
  await pat.waitForTimeout(800);
  await pat.check('main input[type="checkbox"][value="conditions"]');
  await pat.check('main input[type="checkbox"][value="allergies"]');
  await pat.getByRole("button", { name: /^Grant access$/ }).click();
  await pat.waitForTimeout(2500);
  const after = await pat.evaluate(() => document.body.innerText);
  check("grant succeeded (card gone)", !/waiting for your decision/i.test(after));
  check("grant lists Sanjay scopes", /Sanjay Nair[\s\S]{0,400}Conditions & diagnoses/.test(after));
}
await pat.close();
await browser.close();
process.exit(failures ? 1 : 0);
