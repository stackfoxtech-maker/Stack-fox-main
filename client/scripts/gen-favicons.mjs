/**
 * One-off: node scripts/gen-favicons.mjs
 * Builds clean favicons from public/logo-512.png (which has a baked-in checkerboard, so the
 * orange fox is keyed out by colour). Google needs a favicon whose size is a multiple of 48px,
 * and requests /favicon.ico by default — so write 48/96 PNGs, an apple-touch icon and a real .ico.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const { data, info } = await sharp(join(pub, "logo-512.png"))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const [r, g, b] = [out[i], out[i + 1], out[i + 2]];
  const orange = Math.max(0, Math.min(1, (r - b - 140) / 60));
  const p = i / 4,
    x = p % info.width,
    y = (p / info.width) | 0;
  const dark = r + g + b < 200 && x > 235 && x < 275 && y > 325 && y < 355 ? 1 : 0; // the nose only
  out[i + 3] = Math.round(255 * Math.max(orange, dark));
}
const fox = await sharp(out, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

const icon = (size, bg) =>
  sharp(fox)
    .resize(Math.round(size * 0.9), Math.round(size * 0.9), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()
    .then((buf) =>
      sharp({ create: { width: size, height: size, channels: 4, background: bg } })
        .composite([{ input: buf, gravity: "centre" }])
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const white = { r: 255, g: 255, b: 255, alpha: 1 };
writeFileSync(join(pub, "favicon-96.png"), await icon(96, clear));
writeFileSync(join(pub, "apple-touch-icon.png"), await icon(180, white));

// .ico with PNG-embedded 16/32/48 entries
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => icon(s, clear)));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + 16 * i;
  head[o] = s;
  head[o + 1] = s;
  head.writeUInt16LE(1, o + 4);
  head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(pngs[i].length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
writeFileSync(join(pub, "favicon.ico"), Buffer.concat([head, ...pngs]));
console.log("favicon-96.png, apple-touch-icon.png, favicon.ico written");
