// Screenshot the marketing page at 3 breakpoints (visual QA). npm run shots
import { chromium } from "playwright";
const browser = await chromium.launch();
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
  await page.close();
  console.log(name, "captured");
}
await browser.close();
