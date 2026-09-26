/**
 * Write paths, exercised end to end.
 *
 * The audit of 22-23 Sep swept 135 GET endpoints as anonymous, client and
 * admin and found zero 500s. That is a real result, but it covers less than
 * half the API: ~160 POST/PATCH/PUT/DELETE endpoints were deliberately not
 * swept, because firing blind mutations at production creates and destroys
 * real records.
 *
 * So the half where money moves, records are created and data is destroyed had
 * no evidence behind it at all. This suite closes part of that gap against a
 * throwaway database.
 *
 * It also answers a specific open question. `workspaces` has **zero rows** in
 * production, which is odd because the service Builder is a headline,
 * top-of-funnel feature with its own public route. Two explanations, needing
 * opposite responses: nobody reaches it, or saving silently fails. Creating
 * one here tells us which — if the endpoints work, the problem is the funnel,
 * not the backend.
 *
 * Deliberately NOT covered, and why:
 *
 *   file upload      local storage is unconfigured (`storage: false`), so
 *                    these 503 by design rather than exercising anything
 *   payments         completing one needs a real Razorpay charge
 *   admin mutations  a separate surface; needs its own fixtures
 *
 * Requires the API on :4000 and a reachable database.
 *   pnpm --filter @stackfox/api exec tsx tests/mutation-smoke.mts
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";

const BASE = process.env.TEST_API_URL ?? "http://localhost:4000";
const stamp = Date.now();

const checks: Array<[string, boolean, string]> = [];
const check = (label: string, pass: boolean, note = "") =>
  checks.push([label, pass, note]);

type Body = Record<string, any> | null;

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ s: number; b: Body }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* empty body */
  }
  return { s: res.status, b: parsed as Body };
}

/** Registration is rate limited; back off rather than failing the whole run. */
async function register(tag: string) {
  const email = `mut-${tag}-${stamp}@example.com`;
  for (let i = 0; i < 6; i++) {
    const r = await call("POST", "/auth/register", undefined, {
      name: `Mutation ${tag}`,
      email,
      password: "mutation-smoke-pass-12345",
    });
    if (r.b?.data?.accessToken) {
      return { email, token: r.b.data.accessToken as string, user: r.b.data.user };
    }
    if (r.s !== 429) throw new Error(`register failed: ${r.s} ${JSON.stringify(r.b)}`);
    await new Promise((r) => setTimeout(r, 8_000));
  }
  throw new Error("register rate-limited out");
}

const actor = await register("a");
const other = await register("b");

const createdWorkspaceIds: string[] = [];
const createdTicketIds: string[] = [];

try {
  // ── Workspaces: does the Builder's backend actually save? ─────────────────
  //
  // This is the question F-17 exists to answer.
  {
    const created = await call("POST", "/workspaces", actor.token, {});
    const wsId = created.b?.data?.id ?? created.b?.id;
    if (wsId) createdWorkspaceIds.push(wsId);

    check(
      `a workspace can be created -> ${created.s}`,
      (created.s === 200 || created.s === 201) && !!wsId,
      "zero workspaces exist in production; this says whether the API is at fault",
    );

    if (wsId) {
      const service = await prisma.serviceUnit.findFirst({
        where: { status: "PUBLISHED" },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      if (service) {
        const added = await call("POST", `/workspaces/${wsId}/add-service`, actor.token, {
          serviceId: service.id,
        });
        check(
          `a service can be added to it -> ${added.s}`,
          added.s === 200 || added.s === 201,
        );

        const readBack = await call("GET", `/workspaces/${wsId}`, actor.token);
        const canvas = readBack.b?.data?.canvas ?? readBack.b?.canvas ?? [];
        check(
          `the service persists on the canvas (${Array.isArray(canvas) ? canvas.length : "?"} item(s))`,
          Array.isArray(canvas) && canvas.some((c: any) => c?.serviceId === service.id),
          "a create that does not persist is the silent-failure explanation",
        );

        const removed = await call(
          "POST",
          `/workspaces/${wsId}/remove-service`,
          actor.token,
          { serviceId: service.id },
        );
        check(`and can be removed again -> ${removed.s}`, removed.s === 200);
      }

      // Another user must not be able to read or change it.
      const stranger = await call("GET", `/workspaces/${wsId}`, other.token);
      check(
        `another user cannot read this workspace -> ${stranger.s}`,
        stranger.s === 403 || stranger.s === 404,
        "workspaces carry the estimate the checkout price is derived from",
      );
    }
  }

  // ── Support tickets: the full lifecycle ───────────────────────────────────
  {
    const created = await call("POST", "/support", actor.token, {
      subject: `Smoke ticket ${stamp}`,
      description: "Raised by the mutation smoke suite.",
    });
    const ticketId = created.b?.data?.id ?? created.b?.id ?? created.b?.data?._id;
    if (ticketId) createdTicketIds.push(ticketId);

    check(
      `a support ticket can be raised -> ${created.s}`,
      (created.s === 200 || created.s === 201) && !!ticketId,
      "tickets has zero rows in production; support has never been used",
    );

    if (ticketId) {
      const replied = await call("POST", `/support/${ticketId}/reply`, actor.token, {
        message: "A reply from the same user.",
      });
      check(
        `the reporter can reply -> ${replied.s}`,
        replied.s === 200 || replied.s === 201,
      );

      const mine = await call("GET", "/support", actor.token);
      const rows = mine.b?.data ?? mine.b ?? [];
      check(
        "the ticket appears in the reporter's own list",
        Array.isArray(rows) && rows.some((t: any) => (t.id ?? t._id) === ticketId),
      );

      // Tenancy: someone else's ticket must not be readable.
      const stranger = await call("GET", `/support/${ticketId}`, other.token);
      check(
        `another user cannot read it -> ${stranger.s}`,
        stranger.s === 403 || stranger.s === 404,
        "support threads contain whatever a customer chose to disclose",
      );
    }
  }

  // ── Validation actually rejects, rather than storing junk ─────────────────
  {
    const noSubject = await call("POST", "/support", actor.token, {
      description: "no subject at all",
    });
    check(
      `a ticket with no subject is refused -> ${noSubject.s}`,
      noSubject.s === 400,
      "the zod layer exists to stop exactly this reaching a row",
    );

    const huge = await call("POST", "/support", actor.token, {
      subject: "x".repeat(5000),
      description: "bounded?",
    });
    check(
      `an over-long subject is refused -> ${huge.s}`,
      huge.s === 400,
      "an unbounded string is a row that grows until a list query times out",
    );

    const unknownWorkspace = await call(
      "POST",
      "/workspaces/does-not-exist/add-service",
      actor.token,
      { serviceId: "SF-WEB-001" },
    );
    check(
      `adding to a non-existent workspace -> ${unknownWorkspace.s}`,
      unknownWorkspace.s === 404 || unknownWorkspace.s === 403,
      "never 500, and never a silent success",
    );
  }

  // ── Unauthenticated writes ────────────────────────────────────────────────
  {
    for (const [method, path, body] of [
      ["POST", "/support", { subject: "anon", description: "anon" }],
      ["POST", "/feedback", { rating: 5 }],
    ] as Array<[string, string, unknown]>) {
      const r = await call(method, path, undefined, body);
      check(
        `${method} ${path} with no token -> ${r.s}`,
        r.s === 401,
        "a write path that accepts an anonymous caller is the /v1 bug again",
      );
    }
  }

  // ── The guest-draft boundary ──────────────────────────────────────────────
  //
  // `POST /workspaces` DOES accept an anonymous caller, and that is deliberate:
  // routes/workspaces.ts documents the builder as usable before signup, so a
  // workspace with no `userId` is a guest draft reachable by anyone holding its
  // unguessable UUID. An earlier version of this suite asserted 401 here and
  // failed — the assumption was wrong, not the code.
  //
  // The boundary that actually matters is the other one: the moment a
  // workspace belongs to somebody, an anonymous caller must not reach it. That
  // is the transition where a guest convenience would become a data leak.
  {
    const guest = await call("POST", "/workspaces", undefined, {});
    const guestId = guest.b?.data?.id ?? guest.b?.id;
    if (guestId) createdWorkspaceIds.push(guestId);

    check(
      `an anonymous guest draft can be created -> ${guest.s}`,
      guest.s === 200 || guest.s === 201,
      "the builder is deliberately usable before signup",
    );

    if (guestId) {
      const row = await prisma.workspace.findUnique({
        where: { id: guestId },
        select: { userId: true },
      });
      check(
        "the guest draft is genuinely unowned (userId null)",
        row?.userId == null,
        "if it silently attached to a user, the guest path is not what it claims",
      );
    }

    // The owned workspace from the first block must NOT be anonymously
    // readable. This is the check that would catch a real leak.
    const owned = createdWorkspaceIds.find((id) => id !== guestId);
    if (owned) {
      const anon = await call("GET", `/workspaces/${owned}`, undefined);
      check(
        `an owned workspace is NOT readable anonymously -> ${anon.s}`,
        anon.s === 401 || anon.s === 403 || anon.s === 404,
        "a workspace carries the estimate the checkout price derives from",
      );
    }
  }
} finally {
  // Clean up in dependency order.
  if (createdTicketIds.length) {
    await prisma.ticketReply
      .deleteMany({ where: { ticketId: { in: createdTicketIds } } })
      .catch(() => {});
    await prisma.ticket
      .deleteMany({ where: { id: { in: createdTicketIds } } })
      .catch(() => {});
  }
  if (createdWorkspaceIds.length) {
    await prisma.workspace
      .deleteMany({ where: { id: { in: createdWorkspaceIds } } })
      .catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: { in: [actor.email, other.email] } } });
  await prisma.$disconnect();
}

console.log("\n--- MUTATION SMOKE ---");
let failed = 0;
for (const [label, pass, note] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${note && !pass ? `  (${note})` : ""}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
console.log(failed === 0 ? "ALL MUTATION SMOKE CHECKS PASSED" : `${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);
