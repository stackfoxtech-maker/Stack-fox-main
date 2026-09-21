import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Outbound-URL guard for anything the platform fetches on a third party's
 * instruction — today that is webhook delivery, where the destination is
 * supplied by whoever registered the endpoint.
 *
 * Without this, a registered endpoint pointing at `http://169.254.169.254/...`
 * or an internal service turns the dispatcher into a blind SSRF primitive
 * running inside the deployment network, and any `http://` destination sends
 * business events over the wire in clear text.
 *
 * DNS is resolved here and every resolved address is checked, because a
 * hostname that looks public can resolve to a private one. This narrows but
 * does not close the DNS-rebinding window — the address is resolved again by
 * `fetch` — so treat this as one layer, not the only one. An egress allowlist
 * at the network boundary is the durable fix.
 */

/** RFC1918, loopback, link-local (incl. cloud metadata), CGNAT, and friends. */
function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable — fail closed
  }
  const [a, b] = p;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const v = ip.toLowerCase().split("%")[0]; // strip any zone id
  if (v === "::" || v === "::1") return true; // unspecified, loopback
  if (v.startsWith("fe80")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:10.0.0.1) and IPv4-compatible forms
  const mapped = v.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true; // not an IP at all — fail closed
}

export interface UrlCheck {
  ok: boolean;
  /** Present when ok is false. Safe to store on a delivery record. */
  reason?: string;
}

/**
 * True when `raw` is an https URL on a publicly routable host.
 *
 * Set `allowHttp` only for local development against a non-TLS listener; it is
 * never appropriate in a deployed environment.
 */
export async function assertPublicHttpUrl(
  raw: string,
  opts: { allowHttp?: boolean } = {},
): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed URL" };
  }

  const allowHttp = opts.allowHttp ?? process.env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    return { ok: false, reason: `scheme ${url.protocol} is not allowed` };
  }

  // Credentials in the URL are a redirect-laundering trick and have no
  // legitimate use for a webhook destination.
  if (url.username || url.password) {
    return { ok: false, reason: "URL credentials are not allowed" };
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // unwrap [::1]

  // A literal IP needs no resolution.
  if (isIP(host)) {
    return isBlockedAddress(host)
      ? { ok: false, reason: "destination is a private or reserved address" }
      : { ok: true };
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return { ok: false, reason: "destination is an internal hostname" };
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "destination hostname does not resolve" };
  }

  if (!addresses.length)
    return { ok: false, reason: "destination hostname does not resolve" };
  if (addresses.some((a) => isBlockedAddress(a.address))) {
    return { ok: false, reason: "destination resolves to a private or reserved address" };
  }

  return { ok: true };
}
