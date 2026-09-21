import { z } from "zod";
import { businessId, paise, strictObject } from "../lib/validate";

/**
 * Schemas for the delivery-side routes: cart, projects, milestones and change
 * requests.
 *
 * The one that matters most is `costDelta` on a change request. An approved
 * change request with a positive cost delta **creates an invoice** — see
 * routes/projects.ts, the G-041 block — so that number is a billable amount
 * arriving unvalidated. It was typed `costDelta: number` and written straight
 * to the row; a negative value produced a negative invoice, and a fractional
 * one produced sub-paise money.
 */

// ── Cart ────────────────────────────────────────────────────────────────────

/**
 * Cart quantities. Capped because the cart total feeds the checkout estimate,
 * and because a quantity is a human choosing how many of something they want.
 */
const quantity = z.number().int().positive().max(999);

/**
 * Deliberately NOT strict, unlike the admin and identity schemas.
 *
 * The client sends `name` and `price` alongside the id, and the server
 * ignores both and prices from the catalogue — that is the whole point of
 * server-side pricing, and cart.mts asserts a tampered price is ignored.
 *
 * A strict schema turns those ignored fields into a 400 and breaks a working
 * client to defend against something already defended. They are declared here
 * so the intent is visible, and their values are never read.
 */
export const AddToCartSchema = z.object({
  itemId: z.string().trim().min(1, "itemId is required").max(120),
  // Resolved against the catalogue; "package" takes a different lookup path.
  itemType: z.string().trim().max(40).optional(),
  quantity: quantity.optional(),
  notes: z.string().trim().max(2000).optional(),
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),

  // Accepted and ignored. The catalogue decides both.
  name: z.string().trim().max(300).optional(),
  price: z.number().optional(),
});

export const RemoveFromCartSchema = strictObject({
  cartItemId: z.string().trim().min(1, "cartItemId is required").max(120),
});

export const UpdateCartQuantitySchema = strictObject({
  cartItemId: z.string().trim().min(1, "cartItemId is required").max(120),
  // The handler clamps to 1..99 — zero does NOT remove an item, /cart/remove
  // does. Accepting a wider range here and letting the clamp win keeps the
  // existing behaviour rather than turning a clamp into a 400.
  quantity: z.number().int().min(0).max(999),
});

// ── Projects and milestones ─────────────────────────────────────────────────

/**
 * Membership is checked against PROJECT_TRANSITIONS in the handler, which is
 * the single source of truth for what may follow what. This only bounds it.
 */
export const UpdateProjectStatusSchema = strictObject({
  status: z.string().trim().min(1).max(50),
});

export const MilestoneFeedbackSchema = strictObject({
  feedback: z.string().trim().min(1, "feedback is required").max(10_000),
});

// ── Change requests ─────────────────────────────────────────────────────────

const urgency = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional();

export const CreateChangeRequestSchema = strictObject({
  title: z.string().trim().min(1, "title is required").max(300),
  description: z.string().trim().min(1, "description is required").max(20_000),
  urgency,
  // Milestone numbers, not ids. Bounded so the array cannot be unbounded.
  affectedMilestones: z.array(z.number().int().positive().max(1000)).max(200).optional(),
});

/**
 * The assessment that decides what a change costs.
 *
 * `costDelta` becomes an invoice once the request is approved, so it is
 * integer paise like every other money field — never a float, never negative.
 * A reduction in scope is handled by cancelling and re-quoting rather than by
 * a negative invoice.
 *
 * `timelineDelta` is in days and may legitimately be negative: a change can
 * pull a date forward.
 */
export const AssessChangeRequestSchema = strictObject({
  costDelta: paise,
  timelineDelta: z.number().int().min(-3650).max(3650),
  scopeImpact: z.string().trim().max(10_000).optional(),
});

// ── Engagements and programmes ──────────────────────────────────────────────

export const CreateProgramSchema = strictObject({
  name: z.string().trim().min(1).max(200),
  clientId: businessId.optional(),
  budgetEnvelope: paise.optional(),
});
