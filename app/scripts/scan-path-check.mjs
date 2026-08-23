// End-to-end scan-path check: unauthenticated GET of the QR target lands on
// sign-in with `next` preserved.
const url = "http://localhost:3000/portal/doctor/patients/0b6f2a3e-1111-2222-3333-444455556666";
const res = await fetch(url, { redirect: "manual" });
const loc = res.headers.get("location") ?? "";
const ok =
  res.status >= 300 &&
  res.status < 400 &&
  /\/sign-in\?next=/.test(loc) &&
  decodeURIComponent(loc).includes("/portal/doctor/patients/");
console.log("status:", res.status, "location:", loc);
process.exit(ok ? 0 : 1);
