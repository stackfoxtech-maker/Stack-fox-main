/**
 * The webhook destination guard must refuse private and internal addresses in every
 * spelling, including IPv4 written as IPv6.
 *
 *   pnpm --filter @stackfox/api exec tsx tests/ssrf-guard.mts
 */
import { isBlockedAddress } from "../src/lib/safeUrl";

const checks: Array<[string, boolean]> = [];
const blocked = (ip: string) => checks.push([`blocks ${ip}`, isBlockedAddress(ip)]);
const allowed = (ip: string) => checks.push([`allows ${ip}`, !isBlockedAddress(ip)]);

blocked("10.0.0.1");
blocked("127.0.0.1");
blocked("169.254.169.254");
blocked("::1");
blocked("::ffff:10.0.0.1");
// WHATWG URL parsing rewrites the dotted form into hex groups.
blocked("::ffff:a00:1"); // 10.0.0.1
blocked("::ffff:7f00:1"); // 127.0.0.1
blocked("::ffff:a9fe:a9fe"); // 169.254.169.254
blocked("64:ff9b::a00:1"); // NAT64 form of 10.0.0.1
allowed("8.8.8.8");
allowed("::ffff:808:808"); // 8.8.8.8

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
