import { prisma } from "@stackfox/prisma";
import { TIER_MULTIPLIERS } from "./estimate";
import { findCatalogueItem } from "./catalogue";

/**
 * Server-side pricing.
 *
 * Lifted out of routes/cart.ts so the quote path can use the same resolver.
 * It was private there, and POST /quotes/from-cart therefore computed its
 * subtotal from the price the *client* sent:
 *
 *   items.reduce((s, i) => s + i.price * i.quantity, 0)
 *
 * The cart deliberately ignores that field — cart.mts asserts a tampered
 * price is discarded — but the quote trusted it, and a quote's total becomes
 * the grandTotal of a real Invoice through provisionQuote. One endpoint
 * defended the price and its sibling did not.
 *
 * Prices returned are in RUPEES, matching what the cart and quote rows store.
 */

export async function catalogPrice(
  itemId: string,
  itemType: string,
  tier?: string,
): Promise<{ name: string; price: number; source: string } | null> {
  const listed = findCatalogueItem(itemId);
  if (listed) {
    return { name: listed.name, price: listed.price, source: "catalogue" };
  }

  // Database-backed ids (SF-CAT-NNN) and slugs, priced in paise.
  if (itemType === "package") {
    const pkg = await prisma.package.findUnique({ where: { id: itemId } });
    if (pkg) return { name: pkg.name, price: Number(pkg.flatPrice) / 100, source: "db" };
  }

  const service = await prisma.serviceUnit.findFirst({
    where: { OR: [{ id: itemId }, { slug: itemId }], status: "PUBLISHED" },
  });
  if (!service) return null;

  const starter = Number(service.starterPrice ?? 0);
  const premiumMinimum = Number(service.premiumMinimum ?? 0);
  // One table for every path. This was a private 1.4 for Premium here while the
  // quote path used 2.2, so Premium could price below Growth in the cart.
  const multiplier = TIER_MULTIPLIERS[tier ?? ""] ?? 1;
  const paise =
    tier === "PREMIUM" && premiumMinimum
      ? Math.max(premiumMinimum, Math.round(starter * multiplier))
      : Math.round(starter * multiplier);

  return { name: service.name, price: paise / 100, source: "db" };
}
