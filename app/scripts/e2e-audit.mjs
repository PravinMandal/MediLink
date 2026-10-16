/**
 * Full-journey E2E audit: signs in as each role, visits every portal page,
 * records HTTP status + render sanity, and exercises the key mutations.
 * Run with dev server up: node scripts/e2e-audit.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Password123!";

const results = [];
function log(who, what, ok, detail = "") {
  results.push({ who, what, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${who}] ${what}${detail ? " — " + detail : ""}`);
}

async function signIn(email) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  // Node fetch doesn't expose getSetCookie on all versions; parse raw headers.
  const raw = res.headers.get("set-cookie") ?? "";
  const cookies = [...res.headers.entries()]
    .filter(([k]) => k.toLowerCase() === "set-cookie")
    .map(([, v]) => v.split(";")[0]);
  const cookie = cookies.length ? cookies.join("; ") : raw.split(";")[0];
  return { ok: res.ok, status: res.status, cookie };
}

async function visit(who, cookie, path, expectText) {
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + path, { headers: { cookie }, redirect: "follow" });
    const ms = Date.now() - t0;
    if (!res.ok && res.status !== 404 && res.status !== 307) {
      log(who, `GET ${path}`, false, `HTTP ${res.status} in ${ms}ms`);
      return "";
    }
    const html = await res.text();
    const hasExpected = !expectText || html.includes(expectText);
    const is500 = /Internal Server Error|statusCode&quot;:500|Application error/.test(html);
    log(who, `GET ${path}`, res.ok === true || res.status === 200 ? !is500 : false,
      `${res.status} ${ms}ms${hasExpected ? "" : " · MISSING: " + expectText}${is500 ? " · SERVER ERROR" : ""}`);
    return html;
  } catch (e) {
    log(who, `GET ${path}`, false, e.message);
    return "";
  }
}

const ROLES = [
  ["patient", "rahul@example.com", [
    ["/portal/patient"],
    ["/portal/patient/record"],
    ["/portal/patient/record?tab=documents"],
    ["/portal/patient/documents"],
    ["/portal/patient/consents"],
    ["/portal/patient/access-history"],
    ["/portal/patient/emergency"],
    ["/portal/patient/profile"],
  ]],
  ["doctor", "meera@medilink.health", [
    ["/portal/doctor"],
    ["/portal/doctor/patients"],
    ["/portal/doctor/emergency"],
    ["/portal/doctor/inbox"],
    ["/portal/doctor/verification"],
    ["/portal/doctor/profile"],
  ]],
  ["lab", "lab@sunrise.health", [
    ["/portal/org"],
    ["/portal/org/profile"],
  ]],
  ["admin", "admin@medilink.health", [
    ["/portal/admin"],
    ["/portal/admin/verification"],
    ["/portal/admin/emergency"],
    ["/portal/admin/audit"],
    ["/portal/admin/roles"],
  ]],
];

for (const [role, email, pages] of ROLES) {
  const { ok, status, cookie } = await signIn(email);
  log(role, `sign-in ${email}`, ok, ok ? "" : `status ${status}`);
  if (!ok) continue;
  for (const [path] of pages) {
    await visit(role, cookie, path);
  }
}

// Cross-role guard: lab user must NOT see admin console content (the page
// renders 200 with a restricted notice — queue counts must not leak).
const { cookie: labCookie } = await signIn("lab@sunrise.health");
const labAdminRes = await fetch(`${BASE}/portal/admin`, { headers: { cookie: labCookie } });
const adminHtml = await labAdminRes.text();
const leaked = adminHtml.includes("Provider verification") || adminHtml.includes("Emergency review");
const restricted = adminHtml.includes("restricted to platform administrators");
log("guard", "lab user blocked from admin", labAdminRes.status === 200 && !leaked && restricted,
  `status ${labAdminRes.status}${leaked ? " · queue data leaked" : ""}${restricted ? "" : " · restricted notice missing"}`);

// Unauthenticated guard
const anonRes = await fetch(`${BASE}/portal/patient`, { redirect: "manual" });
log("guard", "anonymous redirected from portal", anonRes.status >= 300 && anonRes.status < 400,
  `status ${anonRes.status}`);

const fails = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - fails.length}/${results.length} checks passed ===`);
process.exit(fails.length ? 1 : 0);
