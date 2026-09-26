/**
 * Generates docs/openapi.json and docs/API.md from what the code already says.
 *
 * The original task noted this becomes nearly free once the zod layer exists,
 * and that is what happened: 116 schemas across twelve modules now describe
 * every request body in the API, so the reference does not have to be written
 * by hand — or, worse, written once and left to drift.
 *
 * Two sources, both derived rather than authored:
 *
 *   Paths      scanned out of routes/*.ts and server.ts (which declares
 *              /health itself). Static rather than by booting the app,
 *              because booting it needs Postgres and Redis and this has to run
 *              in CI on a checkout with neither.
 *
 *   Schemas    imported from routes/*Schemas.ts and converted with
 *              zod-to-json-schema.
 *
 * ── What this deliberately does not claim ───────────────────────────────────
 *
 * Request bodies are emitted as a **component library**, not bound to
 * individual paths. Nothing in the code declares "this route uses that
 * schema" — the link is a `parseBody(req, reply, X)` call inside each handler
 * — so binding them would mean either 200-odd hand-written annotations that
 * drift, or a guess. A guess in a reference document is worse than an absence,
 * because a reader cannot tell which they are looking at.
 *
 * So: the paths are complete and real, the schemas are complete and real, and
 * the mapping between them is stated as absent. If per-route bodies become
 * worth the maintenance, the honest way is a `schema` option on each route,
 * which Fastify reads natively.
 *
 *   pnpm --filter @stackfox/api docs:api
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");
const routesDir = join(srcDir, "routes");
const docsDir = resolve(here, "../../../docs");

// ── Paths ───────────────────────────────────────────────────────────────────

type Route = { method: string; path: string; file: string };

/**
 * Matches `app.get("/x", ...)` and the multi-line form with an options object.
 * Deliberately narrow: a false positive would invent an endpoint.
 */
const ROUTE_RE =
  /\bapp\.(get|post|put|patch|delete|head|options)\(\s*["'`]([^"'`]+)["'`]/g;

function scanRoutes(): Route[] {
  const sources: Array<[label: string, path: string]> = [
    // server.ts registers every module under prefix "/", so a scanned path is
    // the real path — but it also declares /health directly.
    ["server", join(srcDir, "server.ts")],
    ...readdirSync(routesDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith("Schemas.ts"))
      .map((f) => [f.replace(/\.ts$/, ""), join(routesDir, f)] as [string, string]),
  ];

  const out: Route[] = [];
  for (const [file, full] of sources) {
    const src = readFileSync(full, "utf8");
    for (const m of src.matchAll(ROUTE_RE)) {
      out.push({ method: m[1].toUpperCase(), path: m[2], file });
    }
  }
  return out.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

/** `/users/:id` -> `/users/{id}`, and the params OpenAPI needs. */
function toOpenApiPath(path: string): { path: string; params: string[] } {
  const params: string[] = [];
  const converted = path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    params.push(name);
    return `{${name}}`;
  });
  return { path: converted, params };
}

// ── Schemas ─────────────────────────────────────────────────────────────────

async function collectSchemas(): Promise<Record<string, unknown>> {
  const components: Record<string, unknown> = {};
  const files = readdirSync(routesDir).filter((f) => f.endsWith("Schemas.ts"));

  for (const file of files) {
    // pathToFileURL, not the bare path: this repo lives on A:\, and Node's ESM
    // loader reads a leading "a:" as an unsupported URL scheme.
    const mod: Record<string, unknown> = await import(
      pathToFileURL(join(routesDir, file)).href
    );
    for (const [name, value] of Object.entries(mod)) {
      // A zod schema is anything with safeParse. Everything else exported from
      // these modules (constant arrays like RFP_STATUSES) is skipped.
      if (!value || typeof (value as { safeParse?: unknown }).safeParse !== "function")
        continue;
      try {
        components[name] = zodToJsonSchema(value as ZodTypeAny, {
          $refStrategy: "none",
          target: "openApi3",
        });
      } catch (err) {
        console.warn(`  skipped ${name} from ${file}: ${(err as Error).message}`);
      }
    }
  }
  return components;
}

// ── Emit ────────────────────────────────────────────────────────────────────

const routes = scanRoutes();
const schemas = await collectSchemas();

const paths: Record<string, Record<string, unknown>> = {};
for (const r of routes) {
  const { path, params } = toOpenApiPath(r.path);
  paths[path] ??= {};
  paths[path][r.method.toLowerCase()] = {
    summary: `${r.method} ${r.path}`,
    tags: [r.file],
    ...(params.length
      ? {
          parameters: params.map((name) => ({
            name,
            in: "path",
            required: true,
            schema: { type: "string" },
          })),
        }
      : {}),
    responses: {
      "200": { description: "Success" },
      "400": {
        description:
          "Invalid request. Body is { error, details: [{ path, message }], requestId }.",
      },
      "401": { description: "Missing or invalid credentials." },
      "404": {
        description:
          "Not found — also returned for a resource outside the caller's tenancy, " +
          "deliberately, so an id cannot be probed for existence.",
      },
      "500": {
        description:
          "Body is { error, requestId }. The internal message is never returned; " +
          "quote the requestId.",
      },
    },
  };
}

const spec = {
  openapi: "3.0.3",
  info: {
    title: "StackFox API",
    version: "1.0.0",
    description: [
      "Generated from the source by scripts/generate-openapi.mts. Do not edit by hand.",
      "",
      "**Authentication.** First-party routes take a JWT bearer token. The `/v1`",
      "routes take an `x-api-key` instead, and the organisation is resolved from",
      "that key — never from a request parameter.",
      "",
      "**Errors.** Every error carries a `requestId`. A 4xx message is written for",
      "the caller; a 500 never includes the internal message.",
      "",
      "**Request bodies** are listed under `components.schemas` as a library.",
      "They are not bound to individual paths: nothing in the code declares that",
      "mapping, and guessing it would be worse than omitting it. See the header",
      "of the generator for the reasoning.",
    ].join("\n"),
  },
  servers: [
    {
      url: "https://stackfox-api-production-c639.up.railway.app",
      description: "Production",
    },
    { url: "http://localhost:4000", description: "Local" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    schemas,
  },
  paths,
};

// ── A readable index, because nobody reads openapi.json ─────────────────────

const byFile = new Map<string, Route[]>();
for (const r of routes) {
  const list = byFile.get(r.file) ?? [];
  list.push(r);
  byFile.set(r.file, list);
}

const publicRoutes = routes.filter((r) => r.path.startsWith("/v1"));

const md = [
  "# API reference",
  "",
  "Generated by `scripts/generate-openapi.mts`. **Do not edit by hand** — run",
  "`pnpm --filter @stackfox/api docs:api`.",
  "",
  `${routes.length} endpoints across ${byFile.size} modules. ` +
    `${Object.keys(schemas).length} request schemas.`,
  "",
  "## Authentication",
  "",
  "| Surface | Credential | Tenancy |",
  "| --- | --- | --- |",
  "| First-party routes | `Authorization: Bearer <jwt>` | From the token's `orgId` |",
  `| \`/v1\` (${publicRoutes.length} endpoints) | \`x-api-key\` | **From the key**, never from a request parameter |`,
  "",
  "An access token and a refresh token are not interchangeable: a refresh token",
  "presented as a bearer credential is rejected.",
  "",
  "### Obtaining an x-api-key",
  "",
  "Keys are issued per client organisation by internal staff — there is no",
  "self-serve signup. An admin issues one from **Admin → API Keys**",
  "(`/app/admin/api-keys`): search for the client by name or email, then",
  "**Issue key**. The plaintext is shown exactly once at creation and is never",
  "stored, so a lost key is reissued rather than recovered.",
  "",
  'Equivalently, `POST /api-keys?orgId=<org>` with `{ "label"?, "scopes"? }`',
  '(`scopes` defaults to `["read"]`; `/v1` is a reporting surface and the only',
  "write scope covers webhook registration). `GET /api-keys?orgId=<org>` lists",
  "existing keys; `DELETE /api-keys/:id` revokes one — revoked, never deleted,",
  "so the row remains the record of who held it and when it was last used.",
  "",
  "## Error shape",
  "",
  "Every error response carries a `requestId`, echoed in the `x-request-id`",
  "header. Quote it — it is how a failure is found in the logs.",
  "",
  "```json",
  '{ "error": "Use at least 8 characters", "details": [{ "path": "password", "message": "..." }], "requestId": "…" }',
  "```",
  "",
  "A 500 returns `{ error, requestId }` and never the internal message.",
  "A resource outside the caller's tenancy returns **404, not 403**, so an id",
  "cannot be probed for existence.",
  "",
  "## Endpoints",
  "",
];

for (const [file, list] of [...byFile.entries()].sort()) {
  md.push(`### ${file}`, "");
  for (const r of list) md.push(`- \`${r.method.padEnd(6)} ${r.path}\``);
  md.push("");
}

md.push(
  "## Request schemas",
  "",
  "Listed as a library rather than per-endpoint. The link between a route and",
  "its schema is a `parseBody(req, reply, X)` call inside the handler, which no",
  "generator can read without guessing — and a guess in a reference is worse",
  "than an omission, because the reader cannot tell which it is.",
  "",
  "Full JSON Schema for each is in `docs/openapi.json`.",
  "",
);
for (const name of Object.keys(schemas).sort()) md.push(`- \`${name}\``);
md.push("");

// ── Write, or verify what is already on disk ────────────────────────────────

const outputs: Array<[name: string, content: string]> = [
  ["openapi.json", JSON.stringify(spec, null, 2) + "\n"],
  ["API.md", md.join("\n")],
];

console.log(`  ${routes.length} endpoints, ${Object.keys(schemas).length} schemas`);

/**
 * --check verifies rather than writes, and is what CI runs so a new endpoint
 * cannot ship undocumented.
 *
 * The comparison happens here in Node rather than as `git diff --exit-code` in
 * the npm script, for two reasons. git diff reports nothing for an *untracked*
 * file, so that gate passed whether or not the docs had ever been generated —
 * a check that cannot fail. And pnpm runs scripts through cmd.exe on Windows,
 * where `test -z "$(...)"` is not syntax, so the shell version failed
 * unconditionally instead. Reading the file and comparing strings has neither
 * problem, and also catches a file that is missing entirely.
 */
if (process.argv.includes("--check")) {
  const stale = outputs.filter(([name, content]) => {
    try {
      return readFileSync(join(docsDir, name), "utf8") !== content;
    } catch {
      return true; // missing entirely counts as stale
    }
  });

  if (stale.length) {
    console.error(
      `\n  out of date: ${stale.map(([n]) => `docs/${n}`).join(", ")}\n` +
        `  These are generated from the routes and the zod schemas. Run:\n` +
        `    pnpm --filter @stackfox/api docs:api\n`,
    );
    process.exit(1);
  }
  console.log(`  docs/openapi.json and docs/API.md are up to date`);
} else {
  mkdirSync(docsDir, { recursive: true });
  for (const [name, content] of outputs) {
    writeFileSync(join(docsDir, name), content, "utf8");
  }
  console.log(`  wrote docs/openapi.json and docs/API.md`);
}
