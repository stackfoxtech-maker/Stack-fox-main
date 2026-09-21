import { z } from "zod";
import { strictObject } from "../lib/validate";

/**
 * Schemas for the estimate workspace.
 *
 * The workspace canvas is the input the whole estimate is derived from, and
 * `canonicalHash(canvas)` is what the checkout drift guard compares against —
 * so this is the shape the money is computed from. It was `any[]`, written
 * straight to a Json column and hashed.
 *
 * Items are normally built server-side (`{ serviceId, features }` assembled
 * when a service is added), but PUT /workspaces/:id lets a client send the
 * whole array. Bounding it keeps an unbounded document out of the column and
 * out of the hash.
 */

/** One service on the canvas, with its feature toggles. */
const canvasItem = z
  .object({
    serviceId: z.string().trim().min(1).max(120),
    // Feature id -> enabled. Bounded: a service has tens of features, not
    // thousands.
    features: z.record(z.string().max(120), z.boolean()).optional(),
  })
  // Not strict: the client round-trips items it received, and a field added
  // server-side later should not 400 an older client.
  .passthrough();

/** 200 services on one estimate is already far past any real engagement. */
export const canvas = z.array(canvasItem).max(200);

export const CreateWorkspaceSchema = z
  .object({ canvas: canvas.optional() })
  .passthrough();

export const UpdateWorkspaceSchema = strictObject({
  canvas: canvas.optional(),
  // Multiplies the estimate, so it is bounded on both sides. A zero or
  // negative multiplier would produce a free or negative estimate.
  timelineMult: z.number().min(0.1).max(10).optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide canvas or timelineMult",
});

export const WorkspaceServiceSchema = strictObject({
  serviceId: z.string().trim().min(1, "serviceId is required").max(120),
});

export const ToggleFeatureSchema = strictObject({
  serviceId: z.string().trim().min(1).max(120),
  featureId: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
});

/**
 * A custom line: work that is not in the catalogue, priced by an estimate of
 * hours rather than by points.
 *
 * `estHours` is a three-point estimate (optimistic / likely / pessimistic) per
 * role. It was `Record<string, { o, l, p }>` with no bounds at all — every
 * number unchecked and the record unbounded — and it feeds the line's price.
 */
const threePointHours = z.object({
  o: z.number().min(0).max(10_000),
  l: z.number().min(0).max(10_000),
  p: z.number().min(0).max(10_000),
});

// description, acceptCriteria, estHours and confidence are NOT NULL on the
// model, so they are required here too rather than optional-with-a-fallback:
// a missing one used to reach Prisma as undefined and fail at the driver.
export const CreateCustomLineSchema = strictObject({
  title: z.string().trim().min(1, "title is required").max(300),
  description: z.string().trim().max(20_000),
  acceptCriteria: z.string().trim().max(20_000),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
  // Keyed by role. A handful of roles, not an unbounded map.
  estHours: z.record(z.string().max(60), threePointHours),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

/**
 * Updating a custom line.
 *
 * The handler did `data: body as any` — the whole parsed body spread into
 * `prisma.customLine.update`, so any column on the model was settable,
 * including `workspaceId`. Naming the fields is the fix; `.strict()` makes an
 * attempt to set anything else a 400 rather than a silent write.
 */
export const UpdateCustomLineSchema = strictObject({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(20_000).optional(),
  acceptCriteria: z.string().trim().max(20_000).optional(),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
  estHours: z.record(z.string().max(60), threePointHours).optional(),
  confidence: z.string().trim().max(40).optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide at least one field to update",
});

export const SeReturnSchema = strictObject({
  notes: z.string().trim().max(10_000).optional(),
});

/**
 * The scope-advisor discovery answers.
 *
 * JSON.stringify(answers) is interpolated into a Gemini prompt, so this is the
 * same cost-and-injection surface as the public tools: unbounded input becomes
 * unbounded billed tokens, and text that reads like an instruction is one.
 * Ten questions, short answers.
 */
export const ScopeAdvisorSchema = strictObject({
  answers: z.record(z.string().max(100), z.string().max(2000)),
});
