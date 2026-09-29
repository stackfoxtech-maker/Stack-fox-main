/**
 * The shareable referral link.
 *
 * A client gets one permanent link they can send to anyone (WhatsApp, email, anywhere):
 * `<site>/?ref=CODE`. When someone who opened it pays their first order, the code is claimed
 * and the sender earns the commission through the existing referral path.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/referral-link.mts
 */
import "../src/env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@stackfox/prisma";
import * as ids from "../src/lib/id";
import {
  claimPersonalCode,
  ensureReferralCode,
  referralLink,
} from "../src/lib/referralLink";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function actor(tag: string) {
  const email = `rl-${tag}-${stamp}@example.com`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Link ${tag}`, email, password: "LinkPass123!okay" }),
  });
  const b = (await reg.json()) as any;
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "LinkPass123!okay" }),
  });
  return {
    id: b.data.user.id as string,
    orgId: b.data.user.orgId as string,
    email,
    token: ((await login.json()) as any).data.accessToken as string,
  };
}
const link = async (token?: string) => {
  const r = await fetch(`${BASE}/referrals/link`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: r.status, body: (await r.json()) as any };
};

const sender = await actor("sender");
const friend = await actor("friend");
const other = await actor("other");

// ── Getting the link ────────────────────────────────────────────────────────
check("the link needs a signed-in user", (await link()).status === 401);
const a1 = await link(sender.token);
const a2 = await link(sender.token);
check("a signed-in client gets a link", a1.status === 200 && !!a1.body.data?.url);
check("the code looks like a referral code", /^SF[A-Z0-9]{8}$/.test(a1.body.data.code));
check("the link is `<site>/?ref=CODE`", /\/\?ref=SF[A-Z0-9]{8}$/.test(a1.body.data.url));
check(
  "asking again returns the same code (it is permanent)",
  a2.body.data.code === a1.body.data.code,
);
const par = await Promise.all(
  Array.from({ length: 6 }, () => ensureReferralCode(other.id)),
);
check("six simultaneous first requests still mint one code", new Set(par).size === 1);
const b = await link(friend.token);
check("another user gets a different code", b.body.data.code !== a1.body.data.code);
check(
  "the share message is ready for WhatsApp with the link inside",
  a1.body.data.whatsappUrl.startsWith("https://wa.me/?text=") &&
    decodeURIComponent(a1.body.data.whatsappUrl).includes(a1.body.data.url),
);
check("and for email", a1.body.data.mailtoUrl.startsWith("mailto:?subject="));
check(
  "a custom site base is honoured",
  referralLink("SFTESTCODE", "https://stackfox.in").url ===
    "https://stackfox.in/?ref=SFTESTCODE",
);

// ── Claiming the code when the friend's first order is paid ─────────────────
const order = async (orgId: string, status: string) =>
  prisma.order.create({
    data: { id: ids.orderId(), orgId, status, projectName: "Referral test" } as any,
  });
const code = a1.body.data.code as string;

const o1 = await order(friend.orgId, "PAID");
const claimed = await claimPersonalCode(code, friend.id, o1.id);
check("a new client's first paid order claims the code", !!claimed);
check("the referral belongs to the sender", claimed?.referrerId === sender.id);
check(
  "it names the friend by email",
  claimed?.referredEmail === friend.email.toLowerCase(),
);
check("it starts unpaid, ready to convert", claimed?.status === "PENDING");
check("it carries a commission percentage", (claimed?.commissionPct ?? 0) > 0);

const again = await claimPersonalCode(code, friend.id, o1.id);
check("the same person cannot be claimed twice", again === null);

check(
  "the owner cannot claim their own code",
  (await claimPersonalCode(code, sender.id, (await order(sender.orgId, "PAID")).id)) ===
    null,
);
check(
  "an unknown code claims nothing",
  (await claimPersonalCode("SFNOSUCHCODE", other.id, o1.id)) === null,
);
check(
  "garbage is rejected without a query error",
  (await claimPersonalCode("'; DROP--", other.id, o1.id)) === null,
);

// Not a new client: had a paid order before this one.
await order(other.orgId, "PAID");
const o3 = await order(other.orgId, "PAID");
check(
  "an existing customer is not a referral",
  (await claimPersonalCode(code, other.id, o3.id)) === null,
);

// ── The conversion path uses it ─────────────────────────────────────────────
const worker = readFileSync(
  resolve(process.cwd(), "src/workers/referralProcessor.ts"),
  "utf8",
);
check(
  "the convert job falls back to a personal code when no invite row matches",
  /findUnique\(\{ where: \{ code \} \}\)\)\s*\?\?\s*\(await claimPersonalCode\(code, purchaserId, orderId\)\)/.test(
    worker,
  ),
);
const stats = (await (
  await fetch(`${BASE}/referrals`, {
    headers: { Authorization: `Bearer ${sender.token}` },
  })
).json()) as any;
check(
  "the sender sees the referral in their list",
  (stats.data ?? []).some((r: any) => r.referredEmail === friend.email.toLowerCase()),
);

await prisma.$disconnect();
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL REFERRAL LINK CHECKS PASSED");
