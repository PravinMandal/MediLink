// Production check: admin sees the seeded break-glass event with review notes.
import { chromium } from "playwright";
const base = process.argv[2] ?? "https://medilink-health.vercel.app";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "admin@medilink.health");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
const txt = await page.evaluate(() => document.body.innerText);
console.log("break-glass event present:", /Emergency access events \(1\)|emergency access events \(1\)/i.test(txt));
console.log("reviewer note shown:", /Reviewer note:/.test(txt));
console.log("notified state explicit:", /notified /.test(txt) && !/notified\s+—\s*$/m.test(txt));
console.log("audit stream has actor:", /Dr\.|Platform Admin/.test(txt));
await browser.close();
