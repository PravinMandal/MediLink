// Dark-mode audit on authenticated portal pages (doctor record, patient pages).
import { chromium } from "playwright";
const base = "http://localhost:3000";
const browser = await chromium.launch();
let bad = 0;
const audit = async (page, name) => {
  const res = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/\d+/g);
      if (!m) return null;
      const [r, g, b2] = m.map(Number);
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2);
    };
    const out = [];
    for (const el of document.querySelectorAll("h1, h2, h3, p, a, button, span, dt, dd, li")) {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.opacity === "0" || !el.textContent.trim()) continue;
      let n = el;
      let bg = null;
      while (n && n !== document.documentElement) {
        const b3 = getComputedStyle(n).backgroundColor;
        if (b3 && !b3.includes("0, 0, 0, 0")) { bg = b3; break; }
        n = n.parentElement;
      }
      if (!bg) bg = getComputedStyle(document.body).backgroundColor;
      const l1 = lum(s.color);
      const l2 = lum(bg);
      if (l1 == null || l2 == null) continue;
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 2.5)
        out.push(`${el.tagName}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 25)}" ${s.color} on ${bg} = ${ratio.toFixed(2)}`);
    }
    return out.slice(0, 5);
  });
  console.log(`${res.length === 0 ? "PASS" : "FAIL"} ${name}`);
  for (const r of res) { console.log("   " + r); bad++; }
};

// login helper as patient, set dark, audit pages
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(base + "/sign-in");
await page.fill('input[type="email"]', "meera@medilink.health");
await page.fill('input[type="password"]', "Password123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
// toggle dark via portal header
await page.locator('button[aria-label*="theme" i]').first().click();
await page.waitForTimeout(500);
console.log("portal theme:", await page.evaluate(() => document.documentElement.dataset.theme));
// doctor record
const q = page.locator('input[name="q"], input[type="search"]').first();
await q.fill("Rahul");
await q.press("Enter");
await page.waitForTimeout(1500);
await page.locator('a[href*="/portal/doctor/patients/"]').first().click();
await page.waitForTimeout(2500);
await audit(page, "doctor record page (dark)");
// tabs
for (const tab of ["timeline", "labs", "documents"]) {
  await page.goto(base + `/portal/doctor/patients/${page.url().split("/patients/")[1]}?tab=${tab}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  await audit(page, `doctor ${tab} tab (dark)`);
}
// patient pages
const pat = await browser.newPage({ viewport: { width: 375, height: 667 } });
await pat.goto(base + "/sign-in");
await pat.fill('input[type="email"]', "rahul@example.com");
await pat.fill('input[type="password"]', "Password123!");
await pat.click('button[type="submit"]');
await pat.waitForTimeout(2500);
await pat.evaluate(() => { localStorage.setItem("medilink-theme", "dark"); });
for (const sub of ["", "timeline", "consents", "emergency", "documents", "access-history"]) {
  await pat.goto(base + "/portal/patient/" + sub, { waitUntil: "networkidle" }).catch(() => {});
  await pat.waitForTimeout(900);
  const t = await pat.evaluate(() => document.documentElement.dataset.theme);
  if (t !== "dark") console.log(`WARN ${sub || "dashboard"} theme=${t}`);
  await audit(pat, `patient /${sub || "dashboard"} (dark)`);
}
// admin
const adm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await adm.goto(base + "/sign-in");
await adm.fill('input[type="email"]', "admin@medilink.health");
await adm.fill('input[type="password"]', "Password123!");
await adm.click('button[type="submit"]');
await adm.waitForTimeout(2500);
await adm.evaluate(() => { localStorage.setItem("medilink-theme", "dark"); });
await adm.goto(base + "/portal/admin", { waitUntil: "networkidle" });
await adm.waitForTimeout(1200);
await audit(adm, "admin (dark)");
await browser.close();
process.exit(bad ? 1 : 0);
