/**
 * One-off backfill for quotes paid before provisioning existed.
 *
 * This ran on every API boot from server.ts, which is why it is now a script.
 * It contains a branch that DELETES an org's invoices, contracts and
 * engagements before re-provisioning from a quote — and that deletion is scoped
 * to the whole org, not to the quote, so an unrelated engagement for the same
 * client is in range. Its trigger condition (an org whose engagements have no
 * projects) is reachable in ordinary operation.
 *
 * Always dry-run first, read the output, and only then decide.
 *
 *   pnpm --filter @stackfox/api backfill:quotes                        # dry run
 *   pnpm --filter @stackfox/api backfill:quotes -- --apply             # non-destructive only
 *   pnpm --filter @stackfox/api backfill:quotes -- --apply --allow-destructive
 *
 * Take a database backup before the last form.
 */
import "../src/env";
import { prisma } from "@stackfox/prisma";
import { backfillPaidQuotes } from "../src/routes/quotes";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowDestructive = args.has("--allow-destructive");

if (allowDestructive && !apply) {
  console.error("\n  --allow-destructive requires --apply. Refusing to run.\n");
  process.exit(1);
}

console.log(
  `\n  Mode: ${apply ? "APPLY" : "DRY RUN"}` +
    `${allowDestructive ? " + DESTRUCTIVE (will delete invoices and contracts)" : ""}\n`,
);

if (apply && allowDestructive) {
  console.log("  Waiting 10s — Ctrl-C now if you have not taken a backup.\n");
  await new Promise((r) => setTimeout(r, 10_000));
}

try {
  await backfillPaidQuotes({ dryRun: !apply, allowDestructive });
  console.log("\n  Done.\n");
} catch (err) {
  console.error("\n  Backfill failed:", err, "\n");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
