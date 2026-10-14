// End-to-end scan-path check: an unauthenticated GET of an emergency-card
// URL (/e/<40-hex-token>) redirects to sign-in with `next` preserved, so the
// treating clinician returns to the scan after login instead of losing it.
const token = "a".repeat(40);
const url = `http://localhost:3000/e/${token}`;
const res = await fetch(url, { redirect: "manual" });
const loc = res.headers.get("location") ?? "";
const ok =
  res.status >= 300 &&
  res.status < 400 &&
  /\/sign-in\?next=/.test(loc) &&
  decodeURIComponent(loc).includes(`/e/${token}`);
console.log("status:", res.status, "location:", loc);
process.exit(ok ? 0 : 1);
