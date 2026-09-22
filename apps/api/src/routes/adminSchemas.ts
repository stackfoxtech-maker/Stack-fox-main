import { z } from "zod";
import type { Prisma } from "@stackfox/prisma";
import { paise, strictObject } from "../lib/validate";

/**
 * Write schemas for the admin catalogue routes.
 *
 * Fifteen handlers spread `req.body` straight into Prisma:
 *
 *   const created = await prisma.serviceUnit.create({ data: body });
 *
 * Any caller past the role check could therefore write any column on the model,
 * including ones no UI exposes — and the guard on that route tree admits SE and
 * SENIOR_PM, so it was reachable by non-administrators.
 *
 * Each schema mirrors its Prisma model exactly. Writing them from the model
 * rather than from the UI caught real drift: the first draft invented
 * `Flag.defaultValue` as a union (it is a Boolean), `NotificationContent.channel`
 * and `.active` (neither exists), and `ComplianceItem.notes` (it is `data`).
 * The compiler rejected all of it, which is the point of doing this.
 *
 * Every schema is `.strict()`: an unexpected field is rejected rather than
 * dropped, because silently ignoring it hides both client bugs and mass
 * assignment attempts.
 *
 * Update schemas are `.partial()` of their create counterpart minus identity
 * fields — a PATCH that can rewrite a row's own id is a rename masquerading as
 * an edit.
 */

/** Prisma's Json columns want InputJsonValue, which a plain record is not. */
const json = z.record(z.unknown()).transform((v) => v as Prisma.InputJsonObject);
const jsonArray = z.array(z.unknown()).transform((v) => v as Prisma.InputJsonValue);

export const CreateServiceSchema = strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  categoryTier1: z.string().min(1).max(64),
  categoryTier2: z.string().max(64).optional(),
  baseWeight: z.number().int().positive(),
  sacCode: z.string().min(4).max(16),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  currentVersion: z.number().int().positive().optional(),
  starterPrice: paise.optional(),
  starterTimelineDays: z.number().int().positive().optional(),
  growthPreset: json.optional(),
  premiumMinimum: paise.optional(),
  premiumIncludes: json.optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.omit({ id: true }).partial();

export const CreateFeatureSchema = strictObject({
  id: z.string().min(1).max(80),
  serviceId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Fibonacci 1-13 per the model comment. */
  weight: z.number().int().positive(),
  defaultState: z.boolean().optional(),
  acceptCriteria: z.string().max(5000).optional(),
  dependencies: jsonArray.optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const UpdateFeatureSchema = CreateFeatureSchema.omit({
  id: true,
  serviceId: true,
}).partial();

export const CreateDependencySchema = strictObject({
  fromId: z.string().min(1).max(64),
  toId: z.string().min(1).max(64),
  type: z.enum(["REQUIRES", "RECOMMENDS", "ENHANCES", "CONFLICTS"]),
});

export const CreateBundleSchema = strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  /** [{ serviceId, features[] }] */
  members: jsonArray,
  discountPct: z.number().int().min(0).max(100),
  matchThreshold: z.number().int().min(0).max(100).optional(),
  status: z.string().min(1).max(32).optional(),
});

export const UpdateBundleSchema = CreateBundleSchema.omit({ id: true }).partial();

export const CreateRateCardSchema = strictObject({
  type: z.enum(["POINT", "ROLE"]),
  /** "point", or a role slug. */
  key: z.string().min(1).max(64),
  /** paise */
  rate: paise,
  effectiveFrom: z.coerce.date(),
});

export const UpdateRateCardSchema = strictObject({
  rate: paise.optional(),
  effectiveFrom: z.coerce.date().optional(),
});

export const CreateFlagSchema = strictObject({
  id: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  type: z.enum(["BOOL", "VARIANT"]).optional(),
  rules: json.optional(),
  defaultValue: z.boolean().optional(),
});

export const UpdateFlagSchema = CreateFlagSchema.omit({ id: true }).partial();

export const CreateNotificationTemplateSchema = strictObject({
  /** {event_code}.{channel} */
  key: z.string().min(1).max(128),
  subject: z.string().max(300).optional(),
  body: z.string().min(1).max(20_000),
  ctaLabel: z.string().max(120).optional(),
  ctaUrlTpl: z.string().max(500).optional(),
});

export const UpdateNotificationTemplateSchema = CreateNotificationTemplateSchema.omit({
  key: true,
}).partial();

export const CreateComplianceItemSchema = strictObject({
  orgId: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  status: z.string().max(32).optional(),
  dueDate: z.coerce.date().optional(),
  engagementId: z.string().max(64).optional(),
  period: z.string().max(32).optional(),
  penaltyRule: json.optional(),
  data: json.optional(),
  filedAt: z.coerce.date().optional(),
});

export const UpdateComplianceItemSchema = CreateComplianceItemSchema.omit({
  orgId: true,
}).partial();
