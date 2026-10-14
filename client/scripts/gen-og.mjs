/** One-off: node scripts/gen-og.mjs → public/og-image.png (1200×630 social card). */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FAF8F5"/>
  <rect x="0" y="0" width="16" height="630" fill="#FF4D00"/>
  <text x="90" y="290" font-family="Arial, Helvetica, sans-serif" font-size="130" font-weight="700" fill="#1A1A1A">StackFox</text>
  <text x="92" y="380" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#FF4D00" font-weight="700">Smart Code, Swift Delivery.</text>
  <text x="92" y="470" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#555">Browse, configure and price IT services — 240+ options, transparent INR pricing.</text>
  <text x="92" y="560" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#888">www.stackfox.in</text>
</svg>`;
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(join(pub, "og-image.png"));
console.log("public/og-image.png written");
