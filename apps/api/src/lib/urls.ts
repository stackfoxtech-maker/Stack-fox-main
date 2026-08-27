/**
 * Public base URLs.
 *
 * OAuth and emailed links leave the server and are opened by a browser, so they
 * cannot use the bind address — they need the URL the outside world reaches us
 * on. Both fall back to the dev defaults so a local checkout works with no
 * extra configuration.
 */

/** Where the SPA is served, e.g. https://stackfox.in — used for redirects and email links. */
export function webAppUrl(): string {
  const explicit = process.env.WEB_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  // CORS_ORIGIN is already "the origins the browser app runs on"; the first
  // entry is the canonical one.
  const firstCors = process.env.CORS_ORIGIN?.split(",")[0]?.trim();
  return (firstCors || "http://localhost:5173").replace(/\/$/, "");
}

/** Where this API is reachable from a browser — Google redirects the user back here. */
export function apiPublicUrl(): string {
  const explicit = process.env.API_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `http://localhost:${process.env.PORT ?? 4000}`;
}
