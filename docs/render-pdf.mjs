import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file:///home/pravin/Projects/A dream path/Projects/MediLink/docs/design-and-model.html", { waitUntil: "networkidle" });
await page.pdf({ path: "MediLink-Design-and-Model.pdf", format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: "<div style='width:100%;text-align:center;font-size:9px;color:#6b7280;font-family:Helvetica,Arial,sans-serif;'><span class='pageNumber'></span> / <span class='totalPages'></span></div>", margin: { top: "22mm", bottom: "24mm", left: "18mm", right: "18mm" } });
await browser.close();
console.log("rendered");
