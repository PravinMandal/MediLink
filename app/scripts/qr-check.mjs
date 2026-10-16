// Final QR validation: rasterize our SVG at 4x and decode with jsQR in
// Chromium (isolated from jsQR's node module resolution).
// NOTE: run with `npx tsx scripts/qr-check.mjs` (node cannot import .tsx).
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { EmergencyCard } from "../src/components/emergency-card.tsx";
import { chromium } from "playwright";
import jsQR from "jsqr";

// Opaque emergency URL shape (D29: never a raw patient-UUID URL).
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const url = `${BASE}/e/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
const html = renderToStaticMarkup(
  React.createElement(EmergencyCard, {
    data: {
      patientName: "Rahul Sharma", patientId: "p1", sex: "male", dob: "1990-04-12",
      bloodGroup: "B+", bloodGroupVerified: true,
      allergies: [{ substance: "Penicillin", criticality: "high", reaction: "anaphylaxis" }],
      meds: [], conditions: [], ecName: "Meera Sharma", ecPhone: "+91 98765 43210",
      emergencyUrl: url,
    },
  }),
);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 4 });
await page.setContent(`<body style="margin:0;background:#fff">${html}</body>`);
const el = await page.$('svg[role="img"][aria-label^="QR code"]');
if (!el) {
  console.error("QR FAILED: QR svg element not found in rendered EmergencyCard");
  await page.close();
  await browser.close();
  process.exit(1);
}
const buf = await el.screenshot();
await page.close();
await browser.close();
const { PNG } = await import("pngjs");
const png = PNG.sync.read(buf);
const out = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (out && out.data === url) {
  console.log("QR DECODES CORRECTLY:", out.data);
  process.exit(0);
} else {
  console.error("QR FAILED:", out ? `mismatch: ${out.data}` : "not decodable");
  process.exit(1);
}
