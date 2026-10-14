// Full doctor journey: sign-up → lands on verification → admin approves → doctor can search.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failures++; };
const email = `dr.e2e.${Date.now()}@test.local`;

// 1. Sign up as doctor
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-up");
await page.fill('input[name="name"]', "Dr. E2E Verma");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "Password123!");
// select doctor role (radiogroup: buttons with role="radio")
const doctorBtn = page.getByRole("radio", { name: /^Doctor/ }).first();
if (await doctorBtn.count()) await doctorBtn.click();
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
check("signup lands somewhere signed-in", !/sign-in|sign-up/.test(page.url()));
const landed = page.url();
console.log("landed:", landed);
check("doctor lands on verification flow", /verification/.test(landed));
// 1b. Submit the council-registration form so a practitioner row exists.
// (Scope to main: the rail's Sign-out is also a submit button.)
await page.fill('main input[name="fullName"]', "Dr. E2E Verma");
await page.fill('main input[name="registrationNumber"]', `E2E/${Date.now().toString().slice(-6)}`);
await page.fill('main input[name="council"]', "Test Medical Council");
await page.click('main button[type="submit"]');
await page.waitForTimeout(3000);
// 2. Auto-verification: the default mock provider approves plausible
// registrations, so the doctor lands verified (the pending-queue +
// admin-approval leg only runs under VERIFICATION_PROVIDER=manual_review
// and is covered by the unit suite, not this script).
const statusText = await page.evaluate(() => document.body.innerText);
check("mock auto-verifies plausible registration", /Verified practitioner/i.test(statusText));
await page.close();
await browser.close();
process.exit(failures ? 1 : 0);
