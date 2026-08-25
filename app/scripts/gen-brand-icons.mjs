/* Generates app-icon PNGs from the brand SVG marks via sharp.
   Run: node scripts/gen-brand-icons.mjs */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

const brandDir = path.resolve("public/brand");

for (const size of [192, 512]) {
  const svg = await readFile(path.join(brandDir, "logo-obsidian.svg"));
  await sharp(svg, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(path.join(brandDir, `app-icon-${size}.png`));
  console.log(`wrote app-icon-${size}.png`);
}
