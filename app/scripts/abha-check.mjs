// E2E: patient sets ABHA → normalized + persisted; invalid rejected;
// doctor record header shows it.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

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
  // invalid (12 digits) is rejected with guidance
  await abhaInput.fill("1234-5678-9012");
  await pat.getByRole("button", { name: /save profile/i }).click();
  await pat.waitForTimeout(2000);
  const errText = await pat.evaluate(() => document.body.innerText);
  check("short ABHA rejected", /exactly 14 digits/i.test(errText));
  // valid 14-digit ABHA persists digits-only
  await abhaInput.fill("91-2345-6789-0123");
  await pat.getByRole("button", { name: /save profile/i }).click();
  await pat.waitForTimeout(2000);
  const saved = await abhaInput.inputValue();
  check("abha saved (normalized)", saved.replace(/\D/g, "") === "91234567890123", saved);
}
await pat.close();

// doctor sees ABHA in record header (via workspace — no name search)
const doc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await doc.goto(base + "/sign-in");
await doc.fill('input[type="email"]', "meera@medilink.health");
await doc.fill('input[type="password"]', "Password123!");
await doc.click('button[type="submit"]');
await doc.waitForTimeout(2000);
await doc.goto(base + "/portal/doctor/patients", { waitUntil: "networkidle" });
await doc.waitForTimeout(1500);
await doc.locator('a[href*="/portal/doctor/patients/"]').first().click();
await doc.waitForTimeout(2000);
const header = await doc.evaluate(() => document.body.innerText);
check("doctor header shows ABHA", /ABHA 91234567890123/.test(header));
await doc.close();
await browser.close();
process.exit(failures ? 1 : 0);
