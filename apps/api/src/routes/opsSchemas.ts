import { z } from "zod";
import { businessId, email, paise, strictObject } from "../lib/validate";

/**
 * Schemas for the remaining operational routes.
 *
 * Mostly bounds on free text headed for a row. Three are worth reading:
 * the assistant's `history` and `catalog`, both of which are interpolated
 * into a Gemini prompt by the *client's* own request, and the notification
 * preferences blob, which went into a Json column as `any`.
 */

const shortText = z.string().trim().max(300);
const longText = z.string().trim().max(20_000);
const note = z.string().trim().max(10_000);
const url = z.string().trim().max(2048);

// ── Assistant ───────────────────────────────────────────────────────────────

/**
 * The chat turn.
 *
 * `history` is replayed into the prompt on every request, so its length is
 * multiplied by the conversation length — the cost grows quadratically with a
 * conversation nobody is bounding. The audit called this out as "unbounded
 * assistant history"; 40 turns of 4k characters is already a large prompt.
 */
export const AssistantChatSchema = strictObject({
  message: z.string().trim().min(1, "message is required").max(4000),
  history: z
    .array(
      strictObject({
        role: z.enum(["user", "model"]),
        text: z.string().max(4000),
      }),
    )
    .max(40)
    .optional(),
});

/**
 * The scope-recommendation call.
 *
 * `catalog` is sent by the *client* and interpolated into the prompt, which is
 * odd on its face — the server has the catalogue. Bounded rather than removed,
 * because changing where it comes from is a behaviour change the client would
 * have to follow.
 */
export const AssistantRecommendSchema = strictObject({
  answers: z.record(z.string().max(100), z.string().max(2000)),
  catalog: z
    .array(
      z
        .object({
          id: z.string().trim().max(120),
          name: z.string().trim().max(300),
          catId: z.string().trim().max(120).optional(),
          price: z.number().optional(),
        })
        .passthrough(),
    )
    .max(300),
});

// ── Blog ────────────────────────────────────────────────────────────────────

export const CreateBlogPostSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(300),
    content: z.string().trim().min(1, "content is required").max(200_000),
    category: shortText.optional(),
  })
  .passthrough();

/** `topic` goes straight into a Gemini prompt. */
export const GenerateArticleSchema = strictObject({
  topic: z.string().trim().min(1, "topic is required").max(300),
  category: shortText.optional(),
});

// ── Engagements and programmes ──────────────────────────────────────────────

export const CreateEngagementSchema = z
  .object({
    clientId: businessId,
    model: z.enum(["FPM", "TNM", "RET", "DED", "DSC"]),
    commercial: z.record(z.string().max(120), z.unknown()).optional(),
    methodology: z.string().trim().max(60).optional(),
    programId: businessId.optional(),
  })
  .passthrough();

export const UpdateEngagementStatusSchema = strictObject({
  status: z.string().trim().min(1).max(40),
});

/**
 * Program.clientId is NOT NULL, and the handler read `body.orgId ?? body.clientId`
 * — so a request with neither reached Prisma as undefined and failed at the
 * driver. One of the two spellings is required here instead, and `orgId` is
 * normalised to `clientId` so the handler has a single field to read.
 */
export const CreateProgramSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200),
    orgId: businessId.optional(),
    clientId: businessId.optional(),
    budgetEnvelope: paise.optional(),
  })
  .passthrough()
  .transform((b) => ({ ...b, clientId: b.clientId ?? b.orgId }))
  .refine((b): b is typeof b & { clientId: string } => Boolean(b.clientId), {
    message: "clientId (or orgId) is required",
  });

// ── Estimates ───────────────────────────────────────────────────────────────

export const CreateEstimateSchema = strictObject({
  workspaceId: z.string().trim().min(1, "workspaceId is required").max(120),
});

// ── Feedback and reviews ────────────────────────────────────────────────────

const rating1to5 = z.number().int().min(1).max(5);

export const CreateFeedbackSchema = z
  .object({
    projectRef: z.string().trim().max(120).optional(),
    rating: rating1to5,
    // Net promoter score is 0-10, not 1-5.
    nps: z.number().int().min(0).max(10).optional(),
    comment: note.optional(),
  })
  .passthrough();

export const CreateReviewSchema = strictObject({
  revieweeId: z.string().trim().min(1).max(120),
  rating: rating1to5,
  comment: note.optional(),
  period: z.string().trim().min(1).max(40),
});

// ── Jobs ────────────────────────────────────────────────────────────────────

export const JobApplicationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email,
    phone: z.string().trim().max(32).optional(),
    experience: shortText.optional(),
    coverLetter: longText.optional(),
    portfolioUrl: url.optional(),
    linkedinUrl: url.optional(),
  })
  .passthrough();

export const UpdateStatusSchema = strictObject({
  status: z.string().trim().min(1).max(40),
});

// ── Messages ────────────────────────────────────────────────────────────────

export const StartConversationSchema = strictObject({
  userId: z.string().trim().min(1, "userId is required").max(120),
  title: shortText.optional(),
  projectId: businessId.optional(),
});

export const StartTeamConversationSchema = strictObject({
  projectId: businessId.optional(),
});

export const SendMessageSchema = strictObject({
  conversationId: z.string().trim().min(1).max(120),
  // The handler already rejects over 10,000; this refuses it before the body
  // is parsed into memory rather than after.
  text: z.string().trim().min(1, "text is required").max(10_000),
});

// ── Notifications ───────────────────────────────────────────────────────────

export const MarkNotificationsReadSchema = strictObject({
  // Goes into `id: { in: ids }`. Unbounded, this is an unbounded IN clause.
  ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
});

/**
 * Notification preferences, written to a Json column. It was `any`, so an
 * arbitrary document of arbitrary size became a user row.
 */
export const NotificationPrefsSchema = z.record(
  z.string().max(100),
  z.union([z.boolean(), z.string().max(200), z.number()]),
);

// ── Admin, reports, RFP notes, tasks, timesheets ────────────────────────────

export const ScreeningReviewSchema = strictObject({
  result: z.string().trim().min(1).max(60),
  reviewNote: note.optional(),
});

export const GenerateReportSchema = strictObject({
  // Membership checked against REPORT_TYPES in the handler.
  type: z.string().trim().min(1).max(60),
});

export const CreateSdnNoteSchema = z
  .object({
    content: z.union([longText, z.record(z.string().max(120), z.unknown())]),
    category: z.string().trim().max(60).optional(),
  })
  .passthrough();

export const CreateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(300),
    assigneeId: z.string().trim().min(1, "assigneeId is required").max(120),
    description: longText.optional(),
    priority: z.string().trim().max(40).optional(),
    status: z.string().trim().max(40).optional(),
    dueDate: z.string().trim().max(64).optional(),
    projectId: businessId.optional(),
  })
  .passthrough();

export const QueryTimesheetLineSchema = strictObject({
  lineId: z.string().trim().min(1, "lineId is required").max(120),
  note: note.optional(),
});

export const ResolveTimesheetLineSchema = strictObject({
  lineId: z.string().trim().min(1, "lineId is required").max(120),
});

export const ReferralSchema = strictObject({
  referredEmail: email,
  referredName: z.string().trim().min(1).max(200),
});

export const MilestoneDeliverablesSchema = z
  .object({
    deliverables: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
  })
  .passthrough();

// ── Checkout ────────────────────────────────────────────────────────────────
//
// Steps 2-5 each wrote the entire request body into a field on the checkout
// session — `req.body as Record<string, unknown>` — so the session document
// was whatever the caller sent, at whatever size. The session is
// Postgres-backed since Phase 2, which makes that a row rather than a cache
// entry.
//
// The exact shapes are client-driven and change with the form, so these bound
// rather than enumerate: a flat-ish record of sane values, capped.

const sessionValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(1000), z.number(), z.boolean()])).max(200),
  z.record(
    z.string().max(120),
    z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]),
  ),
]);

export const CheckoutStepSchema = z.record(z.string().max(120), sessionValue);

export const CheckoutSignSchema = z
  .object({
    rail: z.string().trim().min(1).max(60),
    evidence: z.record(z.string().max(120), sessionValue).optional(),
  })
  .passthrough();

export const ExpressCheckoutSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email,
    phone: z.string().trim().max(32).optional(),
    packageId: z.string().trim().min(1).max(120),
    addOns: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  })
  .passthrough();
