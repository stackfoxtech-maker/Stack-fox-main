/**
 * Generate the marketing-site image set via Gemini "nano banana"
 * (gemini-2.5-flash-image). Reads GEMINI_API_KEY from client/.env.
 *
 *   node scripts/gen-images.mjs            # only missing images
 *   node scripts/gen-images.mjs --force    # regenerate everything
 *   node scripts/gen-images.mjs founder-desk portfolio-food   # just these
 *
 * Output: client/public/img/<name>.webp  (falls back to .png)
 */
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const MAX_W = 1400;      // largest we ever render a marketing image
const WEBP_Q = 78;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'img');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// Load .env (KEY=VALUE lines) without a dependency.
try {
  for (const line of readFileSync(join(__dirname, '..', '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env — rely on real env */ }

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Missing GEMINI_API_KEY (put it in client/.env)'); process.exit(1); }

/* Shared look so every photo reads as one set. */
const LOOK =
  'Editorial photograph. Warm cream, oat and soft terracotta colour palette on a warm off-white ground. ' +
  'Soft natural window light, gentle shadows, shallow depth of field. Calm, unhurried, trustworthy, premium ' +
  'magazine quality. Absolutely no text, no lettering, no logos, no watermarks, no visible screen UI.';

const IMAGES = [
  { name: 'founder-desk', ar: '4:3',
    prompt: `An Indian woman founder in her early 30s working calmly at a light oak desk in a bright minimal studio, ` +
      `a faint confident smile, one plant, a cup of chai, a paper notebook. ${LOOK}` },
  { name: 'studio-collab', ar: '3:2',
    prompt: `Three people collaborating around a light oak table with laptops closed and paper sketches spread out, ` +
      `big windows, potted plants, warm cream walls, a relaxed working moment. ${LOOK}` },
  { name: 'about-workspace', ar: '3:2',
    prompt: `Wide interior of a small calm software studio in India: a few empty oak desks, warm task lamps, ` +
      `a low shelf of books and ceramics, large plants, late-afternoon light. ${LOOK}` },
  { name: 'about-craft', ar: '3:2',
    prompt: `Close-up of hands sketching website wireframe boxes with a pencil on warm off-white paper beside a ` +
      `laptop and a coffee, wooden desk, soft focus background. ${LOOK}` },
  { name: 'home-blocks', ar: '16:9',
    prompt: `Overhead flat-lay of pale wooden modular building blocks and square tiles arranged into a neat grid ` +
      `on warm paper, a few terracotta and burnt-orange tiles among cream ones, calm and orderly, lots of negative space. ${LOOK}` },
  { name: 'portfolio-ecommerce', ar: '4:3',
    prompt: `A tidy small-business packing bench: open cardboard boxes of fresh organic vegetables and pantry jars ` +
      `ready to ship, brown paper, twine, a clipboard. Bright, wholesome. ${LOOK}` },
  { name: 'portfolio-healthcare', ar: '4:3',
    prompt: `A calm modern clinic reception area in warm tones: light wood counter, soft seating, a plant, ` +
      `morning light, nobody in frame or one blurred figure. Reassuring and clean. ${LOOK}` },
  { name: 'portfolio-realestate', ar: '4:3',
    prompt: `A small architectural model house and a set of keys on a warm oak table beside a rolled floor plan ` +
      `and a potted olive plant, window light. ${LOOK}` },
  { name: 'portfolio-education', ar: '4:3',
    prompt: `A young student in a warm sunlit library nook reading from a tablet held like a book, stacked books, ` +
      `plants, cosy and focused. ${LOOK}` },
  { name: 'portfolio-food', ar: '4:3',
    prompt: `A restaurant kitchen pass in warm light: two freshly plated modern Indian dishes on the counter, ` +
      `a chef's hand just visible, brass and ceramic, steam. Appetising, editorial. ${LOOK}` },
  { name: 'portfolio-events', ar: '4:3',
    prompt: `An intimate event hall being set up: rows of pale wooden chairs, warm string lights overhead, ` +
      `a small stage with dried-flower arrangements, golden hour through tall windows. ${LOOK}` },
  { name: 'industries-hero', ar: '16:9',
    prompt: `A warm Indian high-street shopfront at golden hour — a small independent boutique with a clean awning, ` +
      `plants by the door, the owner standing relaxed in the doorway. Optimistic, local, prosperous. ${LOOK}` },
  { name: 'contact-call', ar: '3:2',
    prompt: `A person at a warm home-office desk mid friendly video call, laptop open away from camera, gesturing ` +
      `while talking, plant and chai mug, soft window light. Approachable. ${LOOK}` },
];

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const pick = IMAGES.filter((i) => (only.length ? only.includes(i.name) : true));
let ok = 0, skip = 0, fail = 0;

for (const img of pick) {
  const webp = join(OUT, `${img.name}.webp`);
  if (!force && existsSync(webp)) { console.log(`· skip  ${img.name} (exists)`); skip++; continue; }

  process.stdout.write(`… gen   ${img.name} `);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: img.prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: img.ar },
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new Error(`no image in response: ${JSON.stringify(json).slice(0, 300)}`);
    const raw = Buffer.from(part.inlineData.data, 'base64');
    await sharp(raw).resize(MAX_W, null, { withoutEnlargement: true }).webp({ quality: WEBP_Q }).toFile(webp);
    console.log(`✓ ${Math.round(statSync(webp).size / 1024)}kb`);
    ok++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    fail++;
  }
}

console.log(`\ndone — ${ok} generated, ${skip} skipped, ${fail} failed → public/img/`);
process.exit(fail && !ok ? 1 : 0);
