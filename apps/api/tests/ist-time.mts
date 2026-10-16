/**
 * IST calendar helpers used by the quarterly SOFTEX run and the weekly timesheet
 * compiler. Both fire at night IST, when a UTC server's own calendar is a day behind.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/ist-time.mts
 */
import assert from "node:assert/strict";
import { istMidnight, istParts } from "../src/lib/ist";

const checks: Array<[string, boolean]> = [];
const check = (label: string, pass: boolean) => checks.push([label, pass]);

// 05:00 IST on 1 April 2026 is 23:30 UTC on 31 March.
const firstApril = new Date("2026-03-31T23:30:00Z");
const p = istParts(firstApril);
check(
  "23:30 UTC on 31 Mar is 1 Apr in IST",
  p.month === 3 && p.date === 1 && p.year === 2026,
);

// 00:30 IST on Monday is 19:00 UTC on Sunday.
const monday = istParts(new Date("2026-10-18T19:00:00Z"));
check("19:00 UTC Sunday is Monday in IST", monday.day === 1);

// IST midnight of 1 Jan is 18:30 UTC on 31 Dec.
check(
  "istMidnight(2026, 0, 1) is 18:30 UTC the day before",
  istMidnight(2026, 0, 1).toISOString() === "2025-12-31T18:30:00.000Z",
);

assert.ok(checks.every(([, pass]) => pass));
for (const [label, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
console.log(`\n${checks.length}/${checks.length} passed`);
