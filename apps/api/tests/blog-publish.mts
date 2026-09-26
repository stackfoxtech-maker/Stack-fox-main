/**
 * Publishing a post from the admin editor must actually publish it.
 *
 * The editor sends lowercase status values ("published", "draft"). The API
 * matched only uppercase and silently fell back to DRAFT, so a post an admin
 * published never appeared on the public site.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/blog-publish.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();
const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { s: res.status, b: (await res.json().catch(() => null)) as any };
}

const email = `blog-admin-${stamp}@example.com`;
const reg = await call("POST", "/auth/register", undefined, {
  name: "Blog Admin",
  email,
  password: "BlogAdmin123!ok",
});
await prisma.user.update({ where: { email }, data: { role: "ADMIN", orgId: null } });
const login = await call("POST", "/auth/login", undefined, {
  email,
  password: "BlogAdmin123!ok",
});
const token = login.b?.data?.accessToken as string;
check(`an admin can sign in -> ${login.s}`, login.s === 200 && !!token && !!reg.b);

const title = `Publish check ${stamp}`;
const created = await call("POST", "/blog", token, {
  title,
  content: "Body text for the publish check.",
  status: "published",
});
const id = (created.b?.data?.id ?? created.b?.id) as string;
const row = await prisma.blogPost.findUnique({ where: { id } });
check(`a lowercase "published" is accepted -> ${created.s}`, created.s < 300);
check(`it is stored as PUBLISHED (got ${row?.status})`, row?.status === "PUBLISHED");

const pub = await call("GET", "/blog");
const listed = JSON.stringify(pub.b ?? {}).includes(title);
check("it appears on the public blog", listed);

const draftTitle = `Draft check ${stamp}`;
const d = await call("POST", "/blog", token, {
  title: draftTitle,
  content: "Draft body.",
  status: "draft",
});
const drow = await prisma.blogPost.findUnique({
  where: { id: (d.b?.data?.id ?? d.b?.id) as string },
});
check(`a lowercase "draft" stays DRAFT (got ${drow?.status})`, drow?.status === "DRAFT");
check(
  "a draft is not on the public blog",
  !JSON.stringify((await call("GET", "/blog")).b ?? {}).includes(draftTitle),
);

const up = await call("PUT", `/blog/${drow!.id}`, token, { status: "published" });
const urow = await prisma.blogPost.findUnique({ where: { id: drow!.id } });
check(`updating to lowercase "published" -> ${up.s}`, up.s < 300);
check(`the update publishes it (got ${urow?.status})`, urow?.status === "PUBLISHED");
check("and stamps a publication date", !!urow?.publishedAt);

const bogus = await call("POST", "/blog", token, {
  title: `Bogus ${stamp}`,
  content: "x",
  status: "not-a-status",
});
const brow = await prisma.blogPost.findFirst({ where: { title: `Bogus ${stamp}` } });
check(
  `an unknown status still falls back to DRAFT (${bogus.s}, ${brow?.status})`,
  brow?.status === "DRAFT",
);

await prisma.blogPost.deleteMany({
  where: { title: { in: [title, draftTitle, `Bogus ${stamp}`] } },
});
await prisma.user.deleteMany({ where: { email } });
await prisma.$disconnect();

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`${checks.length - failed}/${checks.length} passed`);
if (failed) process.exit(1);
console.log("ALL BLOG PUBLISH CHECKS PASSED");
