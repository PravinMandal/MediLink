// Break-glass flow: open the collapsed form, submit, verify emergency view.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "arjun@medilink.health");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
const q = page.locator('input[name="q"], input[type="search"]').first();
await q.fill("Deshpande");
await q.press("Enter");
await page.waitForTimeout(1800);
await page.locator('a[href*="/portal/doctor/patients/"]').first().click();
await page.waitForTimeout(2000);
// open the collapsed break-glass form
await page.getByRole("button", { name: /Emergency — break-glass/i }).click();
await page.waitForTimeout(600);
const reason = page.locator("textarea");
console.log("reason textarea:", await reason.count());
if (await reason.count()) {
  await reason.fill("Unconscious patient in ER; allergies and medications needed immediately.");
  await page.getByRole("button", { name: /^Break glass$|Grant emergency access$|Break-glass/i }).last().click();
  await page.waitForTimeout(4500);
  const txt = await page.evaluate(() => document.body.innerText);
  console.log("emergency banner:", /EMERGENCY ACCESS ACTIVE/i.test(txt));
  console.log("blood group visible:", /Blood group/i.test(txt));
  console.log("allergies visible:", /Red-line allergies|Allergies/i.test(txt));
  await page.screenshot({ path: "shots/breakglass-view.png", fullPage: true });
}
await browser.close();
