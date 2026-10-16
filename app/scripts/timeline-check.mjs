// E2E: patient timeline filter + search with snippets.
import { chromium } from "playwright";
const base = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failures++; };

await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "rahul@example.com");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);
await page.goto(base + "/portal/patient/timeline", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// kind filter
await page.getByRole("button", { name: "Labs" }).click();
await page.waitForTimeout(1000);
let txt = await page.evaluate(() => document.body.innerText);
const onlyLabs = /observation/i.test(txt);
const hasConditions = /hypothyroidism|type 2/i.test(txt);
check("kind filter shows labs", onlyLabs && !hasConditions);

// clear + text search
await page.getByRole("button", { name: "Labs" }).click(); // toggle off
await page.waitForTimeout(800);
await page.fill("#timeline-search", "creatinine");
await page.getByRole("button", { name: "Search", exact: true }).click();
await page.waitForTimeout(1200);
txt = await page.evaluate(() => document.body.innerText);
const hasMatch = /match:/i.test(txt) || /creatinine/i.test(txt);
check("text search returns matches", hasMatch);

// spine: last item in a year has no over-drawn line (structural: hidden class on last span)
const spineOk = await page.evaluate(() => {
  const ols = document.querySelectorAll("ol");
  for (const ol of ols) {
    const items = ol.querySelectorAll(":scope > li");
    if (!items.length) continue;
    const last = items[items.length - 1];
    const spine = last.querySelector("span.absolute");
    if (spine && !spine.className.includes("hidden")) return false;
  }
  return true;
});
check("timeline spine ends at last item", spineOk);

await page.screenshot({ path: "shots/timeline-search.png", fullPage: true });
await browser.close();
process.exit(failures ? 1 : 0);
