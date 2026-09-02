// Cloudinary-backed image delivery.
//
// Source files live in client/public/img/ and are (re)uploaded to the
// Cloudinary "stackfox/" folder — see client/scripts/gen-images.mjs.
// We reference them by name here so the CDN does format negotiation
// (webp/avif), quality, and per-viewport resizing for us.

const CLOUD_NAME = 'efgleg53';
const BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

/**
 * cdnImg('founder-desk', 1200)
 *   → …/upload/f_auto,q_auto,c_limit,w_1200/stackfox/founder-desk
 * f_auto  — serve avif/webp when the browser supports it
 * q_auto  — perceptual quality target (usually 60–75%)
 * c_limit — scale down to w, never upscale past the source
 */
export const cdnImg = (name, width = 1400) =>
  `${BASE}/f_auto,q_auto,c_limit,w_${width}/stackfox/${name}`;

/** Responsive srcset string for a full-width-ish image. */
export const cdnSrcSet = (name, widths = [480, 768, 1024, 1400, 1800]) =>
  widths.map((w) => `${cdnImg(name, w)} ${w}w`).join(', ');
