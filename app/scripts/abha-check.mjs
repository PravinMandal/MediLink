// E2E: patient sets ABHA → profile shows it → doctor record header shows it.
import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failures++; };

// patient edits profile
const pat = await browser.newPage({ viewport: { width: 375, height: 667 } });
await pat.goto(base + "/sign-in");
await pat.fill('input[type="email"]', "rahul@example.com");
await pat.fill('input[type="password"]', "Password123!");
await pat.click('button[type="submit"]');
await pat.waitForTimeout(1500);
await pat.goto(base + "/portal/patient/profile", { waitUntil: "networkidle" });
await pat.waitForTimeout(800);
const abhaInput = pat.locator("#p-abha");
check("abha field present", (await abhaInput.count()) > 0);
if (await abhaInput.count()) {
  await abhaInput.fill("1234-5678-9012");
  await pat.getByRole("button", { name: /save profile/i }).click();
  await pat.waitForTimeout(2000);
  const saved = await abhaInput.inputValue();
  check("abha saved (normalized)", saved.replace(/\D/g, "") === "123456789012");
}
await pat.close();

// doctor sees ABHA in record header
const doc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await doc.goto(base + "/sign-in");
await doc.fill('input[type="email"]', "meera@medilink.health");
await doc.fill('input[type="password"]', "Password123!");
await doc.click('button[type="submit"]');
await doc.waitForTimeout(2000);
const q = doc.locator('input[name="q"], input[type="search"]').first();
await q.fill("Rahul");
await doc.keyboard.press("Enter");
await doc.waitForTimeout(1500);
await doc.locator('a[href*="/portal/doctor/patients/"]').first().click();
await doc.waitForTimeout(1800);
const header = await doc.evaluate(() => document.body.innerText);
check("doctor header shows ABHA", /ABHA 123456789012/.test(header));
await doc.close();
await browser.close();
process.exit(failures ? 1 : 0);
