// Break-glass flow (current UX): patient code → emergency page → reason +
// step-up password → record reachable via identifier lookup while the window
// is live → emergency-scoped view (no meds/labs beyond the emergency set).
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

// 1. Read the golden patient's code from their own dashboard.
const pat = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await pat.goto(base + "/sign-in");
await pat.fill('input[type="email"]', "rahul@example.com");
await pat.fill('input[type="password"]', "Password123!");
await pat.click('button[type="submit"]');
await pat.waitForURL(/portal\/patient/, { timeout: 15000 });
const code = await pat.evaluate(() => {
  const m = document.body.innerText.match(/ML-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]/);
  return m ? m[0] : null;
});
check("patient code readable by owner", !!code, code ?? "none");
await pat.close();

// 2. Arjun (verified, no consent) arms break-glass on the emergency page.
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "arjun@medilink.health");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForURL(/portal\/doctor/, { timeout: 15000 });
await page.goto(base + "/portal/doctor/emergency");
await page.getByRole("button", { name: /Start an emergency window/ }).click();
await page.fill('input[name="patientIdText"]', code);
await page.fill('textarea[name="reason"]', "Unconscious patient in ER; allergies and medications needed immediately.");
await page.fill('input[name="stepUpPassword"]', "Password123!");
await page.getByRole("button", { name: /Confirm break-glass/ }).click();
await page.waitForTimeout(4000);
const armed = await page.evaluate(() => document.body.innerText);
check("break-glass arms with step-up", /Break-glass active for 60 minutes/i.test(armed));
// Regression: arming must not kill the doctor's own session (the step-up
// password check used to orphan the session cookie via signInEmail).
await page.goto(base + "/portal/doctor", { waitUntil: "networkidle" }).catch(() => {});
check(
  "session survives arming",
  !/\/sign-in/.test(page.url()),
  page.url(),
);

// 3. Identifier lookup routes straight to the record while the window is live.
await page.waitForSelector('input[name="identifier"]', { timeout: 20000 });
await page.fill('input[name="identifier"]', code);
await page.getByRole("button", { name: /^Look up$/ }).click();
await page.getByRole("link", { name: /Open patient record/ }).click({ timeout: 15000 }).catch(() => {});
await page.waitForURL(/portal\/doctor\/patients\//, { timeout: 15000 }).catch(() => {});
check("lookup routes to record under live window", /portal\/doctor\/patients\//.test(page.url()), page.url());
await page.waitForTimeout(2000);
const txt = await page.evaluate(() => document.body.innerText);
check("emergency banner shown", /EMERGENCY ACCESS ACTIVE/i.test(txt));
check("blood group visible", /Blood group/i.test(txt));
check("allergies visible", /Red-line allergies|Penicillin/i.test(txt));
check("in-scope meds visible", /Clopidogrel/i.test(txt));
check("out-of-scope procedures withheld", !/Percutaneous coronary intervention/i.test(txt));
await page.screenshot({ path: "shots/breakglass-view.png", fullPage: true });
await browser.close();
process.exit(failures ? 1 : 0);
