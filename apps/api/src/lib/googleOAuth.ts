/**
 * Google Sign-In, server-side authorization-code flow.
 *
 * The browser never handles the client secret and never sees an id_token: it is
 * bounced to Google, back to /auth/google/callback, and on to the SPA with a
 * StackFox session. Keeping the exchange server-side also means the frontend
 * needs no Google SDK and no build-time client id.
 */
import { apiPublicUrl } from "./urls";

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleProfile {
  /** Google's stable account id (the `sub` claim) — the only safe join key. */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${apiPublicUrl()}/auth/google/callback`;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Google only returns the email on the first consent unless we ask again.
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

/**
 * Trades the one-time code for the caller's profile.
 *
 * The id_token arrives over TLS straight from Google's token endpoint in
 * response to a request carrying our client secret, so its claims are already
 * authenticated — signature verification only matters for tokens that reached
 * us via the browser, which is not this flow.
 */
export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("Google token response contained no id_token");

  const claims = decodeJwtPayload(idToken);
  if (!claims.sub || !claims.email) throw new Error("Google id_token was missing sub or email");

  return {
    googleId: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: claims.name ? String(claims.name) : undefined,
    picture: claims.picture ? String(claims.picture) : undefined,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segment = token.split(".")[1];
  if (!segment) throw new Error("Malformed id_token");
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}
