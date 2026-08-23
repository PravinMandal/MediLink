// Production org-console E2E: lab staff sees consent registry + upload form.
import { chromium } from "playwright";
const base = process.argv[2] ?? "https://medilink-health.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "lab@sunrise.health");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
await page.goto(base + "/portal/org", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(1500);
const txt = await page.evaluate(() => document.body.innerText);
console.log("console renders:", /Facility console|Sunrise/i.test(txt));
console.log("consent registry:", /granting this facility document consent/i.test(txt));
console.log("upload form:", /upload/i.test(txt));
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
console.log("no h-overflow:", !overflow);
await browser.close();
