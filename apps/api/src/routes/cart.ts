import type { FastifyInstance } from "fastify";
import { prisma } from "@stackfox/prisma";
import { requireAuth } from "../plugins/auth";
import { redis } from "../lib/redis";
import { randomBytes } from "crypto";
import { findCatalogueItem } from "../lib/catalogue";

/**
 * Cart.
 *
 * This was a module-level `Map`, so every cart was lost on restart, invisible
 * to a second API instance, and grew without bound. It now lives in Redis under
 * a per-user key with a 30-day TTL, which survives deploys and works behind a
 * load balancer.
 *
 * Prices are re-read from the catalogue on every mutation rather than trusted
 * from the request body — otherwise a client can POST `price: 1` and check out
 * at a price they chose.
 */

interface CartItem {
  _id: string;
  itemId: string;
  itemType: string;
  name: string;
  price: number; // rupees, as displayed
  quantity: number;
  notes?: string;
}

const TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_ITEMS = 50;
const GST_RATE = 18;

const key = (userId: string) => `cart:${userId}`;

async function readCart(userId: string): Promise<CartItem[]> {
  try {
    const raw = await redis.get(key(userId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    // A cart is a convenience, not a record — an unavailable cache must not 500
    // the dashboard. Callers see an empty cart and can rebuild it.
    return [];
  }
}

async function writeCart(userId: string, items: CartItem[]): Promise<void> {
  await redis.set(key(userId), JSON.stringify(items), "EX", TTL_SECONDS);
}

function calcTotals(items: CartItem[]) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const gstAmount = Math.round(subtotal * (GST_RATE / 100));
  return {
    items,
    subtotal,
    gstRate: GST_RATE,
    gstAmount,
    total: subtotal + gstAmount,
    itemCount: items.reduce((c, i) => c + i.quantity, 0),
  };
}

/**
 * Authoritative price for a catalogue line, in rupees.
 *
 * Resolution order matters. The storefront renders from `shared/stackfox-data.json`,
 * so that is where the ids and prices a customer clicks come from; the
 * `ServiceUnit` table is a second, unreconciled catalogue used by the delivery
 * side. Check the storefront first, fall back to the database, and only then
 * reject — pricing solely off `ServiceUnit` rejected every real add-to-cart.
 *
 * Returns null when the id is in neither, so unknown items are refused rather
 * than trusting a price from the request body.
 */
async function catalogPrice(
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
    if (pkg) return { name: pkg.name, price: pkg.flatPrice / 100, source: "db" };
  }

  const service = await prisma.serviceUnit.findFirst({
    where: { OR: [{ id: itemId }, { slug: itemId }], status: "PUBLISHED" },
  });
  if (!service) return null;

  const starter = service.starterPrice ?? 0;
  const multiplier = tier === "PREMIUM" ? 1.4 : tier === "GROWTH" ? 1.5 : 1;
  const paise =
    tier === "PREMIUM" && service.premiumMinimum
      ? Math.max(service.premiumMinimum, Math.round(starter * multiplier))
      : Math.round(starter * multiplier);

  return { name: service.name, price: paise / 100, source: "db" };
}

export async function cartRoutes(app: FastifyInstance) {
  app.get("/cart", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { data: { cart: calcTotals(await readCart(req.user!.sub)) } };
  });

  app.post("/cart/add", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const userId = req.user!.sub;
    const { itemId, itemType = "service", quantity = 1, notes, tier } = req.body as {
      itemId?: string;
      itemType?: string;
      quantity?: number;
      notes?: string;
      tier?: string;
    };

    if (!itemId) return reply.code(400).send({ message: "itemId is required" });

    const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));

    const priced = await catalogPrice(itemId, itemType, tier);
    if (!priced) {
      req.log.warn({ itemId, itemType }, "Add-to-cart rejected: id not in catalogue or database");
      return reply.code(404).send({
        message: "That item is no longer available. Please refresh and try again.",
      });
    }

    const items = await readCart(userId);
    const idx = items.findIndex((i) => i.itemId === itemId && i.itemType === itemType);

    if (idx >= 0) {
      items[idx].quantity = Math.min(99, items[idx].quantity + qty);
      // Refresh price and name in case the catalogue moved since it was added.
      items[idx].price = priced.price;
      items[idx].name = priced.name;
      if (notes !== undefined) items[idx].notes = notes;
    } else {
      if (items.length >= MAX_ITEMS) {
        return reply.code(409).send({ message: `A cart can hold at most ${MAX_ITEMS} line items.` });
      }
      items.push({
        _id: `cart_${randomBytes(8).toString("hex")}`,
        itemId,
        itemType,
        name: priced.name,
        price: priced.price,
        quantity: qty,
        notes,
      });
    }

    await writeCart(userId, items);
    return { data: { cart: calcTotals(items) } };
  });

  app.post("/cart/remove", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const userId = req.user!.sub;
    const { cartItemId } = req.body as { cartItemId?: string };
    if (!cartItemId) return reply.code(400).send({ message: "cartItemId is required" });

    const items = (await readCart(userId)).filter((i) => i._id !== cartItemId);
    await writeCart(userId, items);
    return { data: { cart: calcTotals(items) } };
  });

  app.post("/cart/update-quantity", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const userId = req.user!.sub;
    const { cartItemId, quantity } = req.body as { cartItemId?: string; quantity?: number };
    if (!cartItemId) return reply.code(400).send({ message: "cartItemId is required" });

    const items = await readCart(userId);
    const item = items.find((i) => i._id === cartItemId);
    if (!item) return reply.code(404).send({ message: "That item is no longer in your cart." });

    item.quantity = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
    await writeCart(userId, items);
    return { data: { cart: calcTotals(items) } };
  });

  app.post("/cart/clear", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    try {
      await redis.del(key(req.user!.sub));
    } catch {
      /* an unreachable cache is already an empty cart */
    }
    return { data: { cart: calcTotals([]) } };
  });
}
