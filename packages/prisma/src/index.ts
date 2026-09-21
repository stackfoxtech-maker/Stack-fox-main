import { PrismaClient } from "@prisma/client";

/**
 * BigInt columns come back as JS `bigint`, and that breaks two things at once.
 *
 * `JSON.stringify(1n)` throws "Do not know how to serialize a BigInt", so any
 * response carrying one is a 500. This was not hypothetical: `Event.seq` has
 * always been BigInt, and `GET /v1/events` returned 500 for any org that
 * actually had events — an empty result was the only case that worked.
 *
 * `Math.min`/`Math.max` throw on a bigint, and `bigint + number` is a
 * TypeError. There are ~45 arithmetic sites across the money paths; widening
 * the money columns to BigInt would have broken every one of them.
 *
 * So the column widens and the JS type does not. A JS number is a double and
 * represents every integer up to 2^53 exactly — 9,007,199,254,740,991 paise,
 * about ₹90 trillion — which is far past anything this system will hold, while
 * `int4` capped a single invoice at ₹2,14,74,836.47.
 *
 * Converting in one place beats converting at 45 call sites, and it means a
 * column widened next year is handled without anyone remembering to.
 */

/**
 * Deep-converts bigint to number. Refuses rather than silently rounding: past
 * 2^53 a double cannot represent consecutive integers, and quietly returning
 * an amount that is off by one paise is worse than failing.
 */
function bigIntsToNumbers<T>(value: T): T {
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error(
        `Value ${value} exceeds the safe integer range and cannot be converted ` +
          "without losing precision. If this is money, the amount is implausible; " +
          "if it is an identifier, it needs handling as a string.",
      );
    }
    return Number(value) as T;
  }

  if (Array.isArray(value)) {
    // Mutate in place: these are freshly-built result objects owned by this
    // call, and copying every list would double the allocation on read paths
    // that already return hundreds of rows.
    for (let i = 0; i < value.length; i++) value[i] = bigIntsToNumbers(value[i]);
    return value;
  }

  // Date, Decimal, Buffer and the like are objects but must not be walked.
  if (value !== null && typeof value === "object" && value.constructor === Object) {
    for (const key of Object.keys(value)) {
      const record = value as Record<string, unknown>;
      record[key] = bigIntsToNumbers(record[key]);
    }
  }

  return value;
}

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient };

function createClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    name: "bigint-to-number",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return bigIntsToNumbers(await query(args));
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export { prisma as db };
