// Behavioral + visual verification against the local dev server.
// Usage: node scripts/verify.mjs [baseUrl]  (default http://localhost:3000)
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const results = [];
const consoleErrors = [];
const consoleWarnings = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

async function fresh(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
    if (m.type() === "warning") consoleWarnings.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  return page;
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 667 };

/* ---------- Marketing page ---------- */
{
  const page = await fresh(DESKTOP);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  record("marketing renders", (await page.locator("h1").count()) > 0);
  const h1 = await page.textContent("h1");
  record("hero thesis present", /history|receipts/i.test(h1 ?? ""));
  // no horizontal overflow at both viewports
  const overflowD = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  record("marketing desktop no h-overflow", !overflowD);
  // 3D section present and lazy (matched by its heading copy)
  const journey = page.getByRole("heading", { name: /lab report|chain/i }).first();
  record("record-journey section in DOM", (await journey.count()) > 0);
  await page.screenshot({ path: "shots/verify-marketing-desktop.png", fullPage: true });

  // scroll through the journey to exercise the canvas
  if ((await journey.count()) > 0) await journey.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
  }
  record("canvas mounted (3D active)", (await page.locator("canvas").count()) > 0);
  const overflowJ = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  record("no h-overflow during journey", !overflowJ);
  await page.close();
}

{
  const page = await fresh(MOBILE);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const overflowM = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  record("marketing mobile no h-overflow", !overflowM);
  await page.screenshot({ path: "shots/verify-marketing-mobile.png", fullPage: true });
  await page.close();
}

/* ---------- Auth redirect guard ---------- */
{
  const page = await fresh(DESKTOP);
  await page.goto(base + "/sign-in?next=//evil.com", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "meera@medilink.health");
  await page.fill('input[name="password"]', "wrong-password");
  await page.click('button[type="submit"]');
  // stay-or-error: bad credentials must leave us on /sign-in with an error
  await page.waitForTimeout(1500);
  await page.waitForURL((u) => !u.href.includes("/sign-in"), { timeout: 8000 }).catch(() => {});
  record("bad login shows error, no redirect to evil.com",
    !/^https?:\/\/evil\.com/.test(page.url()) && page.url().includes("/sign-in"));
  await page.close();
}

/* ---------- Portal (requires seeded demo login) ---------- */
const demoLogin = async (page, email, password) => {
  await page.goto(base + "/sign-in", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 15000 }).catch(() => {});
  return page.url().includes("/portal");
};

{
  const page = await fresh(DESKTOP);
  const doctorIn = await demoLogin(page, "meera@medilink.health", "Password123!");
  record("doctor demo login", doctorIn, page.url());
  if (doctorIn) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "shots/verify-doctor-home.png", fullPage: true });
    // patient search
    const search = page.locator('input[name="q"], input[type="search"]').first();
    if ((await search.count()) > 0) {
      await search.fill("Rahul");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      record("doctor patient search finds Rahul", (await page.getByText(/Rahul/i).count()) > 0);
      const link = page.locator('a[href*="/portal/doctor/patients/"]').first();
      if ((await link.count()) > 0) {
        await link.click();
        await page.waitForTimeout(1800);
        record("patient record page loads", (await page.locator("main").count()) > 0);
        const overflowP = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        record("patient record no h-overflow", !overflowP);
        await page.screenshot({ path: "shots/verify-doctor-patient.png", fullPage: true });
      }
    } else {
      record("doctor patient search input present", false, "no search input found");
    }
    // sign out via portal link/button
    const signout = page.locator('form:has(button), [data-signout], button:has-text("Sign out")').first();
    if ((await signout.count()) > 0) await signout.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.close();
}

{
  const page = await fresh(MOBILE);
  const patientIn = await demoLogin(page, "rahul@example.com", "Password123!");
  record("patient demo login", patientIn, page.url());
  if (patientIn) {
    for (const sub of ["consents", "documents", "timeline", "access-history", "emergency", "profile"]) {
      await page.goto(base + "/portal/patient/" + sub, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(600);
      const ok = (await page.locator("main").count()) > 0;
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      record(`patient /${sub} renders mobile`, ok && !overflow);
    }
    await page.screenshot({ path: "shots/verify-patient-mobile.png", fullPage: true });
  }
  await page.close();
}

/* ---------- Admin ---------- */
{
  const page = await fresh(DESKTOP);
  const adminIn = await demoLogin(page, "admin@medilink.health", "Password123!");
  record("admin demo login", adminIn, page.url());
  if (adminIn) {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "shots/verify-admin.png", fullPage: true });
  }
  await page.close();
}

/* ---------- Health endpoint ---------- */
{
  const page = await fresh(DESKTOP);
  const res = await page.request.get(base + "/api/health");
  const body = await res.json().catch(() => ({}));
  record("/api/health ok", res.status() === 200 && body.ok === true, JSON.stringify(body));
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (consoleErrors.length) {
  console.log("\nConsole errors (" + consoleErrors.length + "):");
  console.log([...new Set(consoleErrors)].slice(0, 10).join("\n"));
}
console.log(`Console warnings: ${new Set(consoleWarnings).size} unique`);
process.exit(failed.length ? 1 : 0);
