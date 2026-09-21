import { z } from "zod";
import { businessId, email, strictObject } from "../lib/validate";

/**
 * Schemas for the CRM-side routes: leads, support tickets and RFPs.
 *
 * Most of these were `req.body as any` or `Record<string, any>`. The values
 * are mostly free text destined for a row, so the work here is bounds rather
 * than shape — an unbounded note or description is a row that grows until a
 * list query times out.
 *
 * Two RFP statuses were written straight from the request with no membership
 * check at all, which is the one place here where a wrong value changes
 * business state rather than just storing text.
 */

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);
const note = z.string().trim().max(10_000);

/** An ISO date from a form. Rejected early so `new Date()` never yields NaN. */
const isoDate = z.string().datetime({ offset: true }).or(z.string().date());

// ── Leads ───────────────────────────────────────────────────────────────────
//
// The create and update handlers normalise aliases themselves (ownerName vs
// name, company vs businessName) and the update walks an explicit allowlist,
// so these deliberately accept both spellings rather than forcing a client
// change. Not strict, for the same reason.

export const CreateLeadSchema = z
  .object({
    ownerName: shortText.optional(),
    name: shortText.optional(),
    company: shortText.optional(),
    businessName: shortText.optional(),
    email: email.optional(),
    phone: z.string().trim().max(32).optional(),
    category: shortText.optional(),
    source: shortText.optional(),
    priority: z.string().trim().max(40).optional(),
    stage: z.string().trim().max(40).optional(),
    value: z.number().int().min(0).max(1_000_000_000).optional(),
    notes: note.optional(),
    city: shortText.optional(),
    location: shortText.optional(),
    website: z.string().trim().max(2048).optional(),
    contact: z.string().trim().max(32).optional(),
    assignedTo: z.string().trim().max(120).optional(),
    message: note.optional(),
  })
  .passthrough();

/**
 * The PATCH handler already walks an explicit allowlist with typeof checks, so
 * mass assignment was never possible here. What it had no notion of was
 * length — every one of these went to the row unbounded. Named rather than
 * passthrough so the bounds actually apply.
 */
export const UpdateLeadSchema = z
  .object({
    ownerName: shortText.optional(),
    company: shortText.optional(),
    email: email.optional(),
    category: shortText.optional(),
    location: shortText.optional(),
    website: z.string().trim().max(2048).optional(),
    contact: z.string().trim().max(32).optional(),
    phone: z.string().trim().max(32).optional(),
    priority: z.string().trim().max(40).optional(),
    value: z.number().min(0).max(1_000_000_000).optional(),
    assignedTo: z.string().trim().max(120).optional(),
    stage: z.string().trim().max(40).optional(),
    notes: note.optional(),
  })
  .passthrough();

export const UpdateLeadStageSchema = strictObject({
  // Membership checked by toStage() in the handler, which owns the list.
  stage: z.string().trim().min(1).max(40),
});

export const CreateLeadNoteSchema = strictObject({
  body: note.min(1, "A note body is required"),
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING"]).optional(),
});

export const CreateFollowUpSchema = z
  .object({
    dueAt: isoDate,
    channel: z.string().trim().max(40).optional(),
    note: note.optional(),
    assignedTo: z.string().trim().max(120).optional(),
  })
  .passthrough();

export const UpdateFollowUpSchema = strictObject({
  status: z.string().trim().max(40).optional(),
  note: note.optional(),
  dueAt: isoDate.optional(),
}).refine((b) => Object.keys(b).length > 0, {
  message: "Provide at least one field to update",
});

// ── Support tickets ─────────────────────────────────────────────────────────

export const CreateTicketSchema = z
  .object({
    subject: z.string().trim().min(1, "subject is required").max(300),
    description: longText.min(1, "description is required"),
    projectId: businessId.optional(),
    priority: z.string().trim().max(40).optional(),
    category: z.string().trim().max(100).optional(),
  })
  .passthrough();

export const TicketMessageSchema = strictObject({
  message: note.min(1, "message is required"),
});

export const ResolveTicketSchema = strictObject({
  resolution: longText.optional(),
});

export const CloseTicketSchema = strictObject({
  // Typed `boolean` and never checked. The string "false" is truthy, so a
  // client sending it would have *closed* the ticket it meant to reopen.
  accepted: z.boolean(),
});

// ── RFPs ────────────────────────────────────────────────────────────────────

/**
 * From the model's own comment: INTAKE|SCORING|BID|NO_BID|DRAFTING|SUBMITTED|
 * WON|LOST, plus QUALIFIED which the client sends.
 *
 * These two endpoints wrote the request value straight into `status` with no
 * check of any kind, so any string became the state of the record.
 */
export const RFP_STATUSES = [
  "INTAKE",
  "SCORING",
  "QUALIFIED",
  "BID",
  "NO_BID",
  "DRAFTING",
  "SUBMITTED",
  "WON",
  "LOST",
] as const;

export const CreateRfpSchema = z
  .object({
    // NOTE: the handler takes this from the body and only requires that the
    // caller is authenticated, so an RFP can be created against any org. That
    // is an authorisation gap, not a validation one, and is tracked
    // separately — bounding the value here does not close it.
    orgId: businessId.optional(),
    title: z.string().trim().min(1, "title is required").max(300),
    issuer: shortText.optional(),
    budgetSignal: shortText.optional(),
    brief: z.record(z.string().max(120), z.unknown()).optional(),
    deadline: isoDate.optional(),
  })
  .passthrough();

export const RfpDecisionSchema = strictObject({
  decision: z.enum(RFP_STATUSES),
  reason: note.optional(),
});

export const RfpOutcomeSchema = strictObject({
  outcome: z.enum(RFP_STATUSES),
});

// ── Proposals ───────────────────────────────────────────────────────────────

/**
 * `packages` is a free-form pricing structure written to a Json column, so it
 * is bounded by shape rather than described exactly. totalMin/totalMax are in
 * RUPEES on this model, not paise — see the schema comment — which is why the
 * ceiling here is smaller than the paise fields elsewhere.
 */
const proposalPackages = z.record(
  z.string().max(120),
  z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
);

export const CreateProposalSchema = z
  .object({
    title: z.string().trim().min(1, "A proposal title is required").max(300),
    packages: proposalPackages.optional(),
    notes: note.optional(),
    totalMin: z.number().min(0).max(1_000_000_000).optional(),
    totalMax: z.number().min(0).max(1_000_000_000).optional(),
  })
  .passthrough();

export const UpdateProposalSchema = z
  .object({
    title: z.string().trim().max(300).optional(),
    packages: proposalPackages.optional(),
    notes: note.optional(),
    totalMin: z.number().min(0).max(1_000_000_000).optional(),
    totalMax: z.number().min(0).max(1_000_000_000).optional(),
    status: z.string().trim().max(40).optional(),
  })
  .passthrough();
