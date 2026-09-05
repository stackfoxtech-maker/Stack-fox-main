import sanitizeHtmlLib from "sanitize-html";

/**
 * Strips script/event-handler payloads from user-authored HTML (blog posts,
 * guides) before it's stored. Content still passes through the client-side
 * sanitizer at render time too — this is defense-in-depth for anything that
 * writes through the API directly rather than the SPA.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(["h1", "h2", "img"]),
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height"],
      a: ["href", "name", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
