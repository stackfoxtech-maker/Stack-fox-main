import { z } from "zod";
import { email, httpUrl, strictObject } from "../lib/validate";

/**
 * Schemas for the public lead-generation tools.
 *
 * These are the only **unauthenticated** routes in the API that spend money.
 * Each one interpolates its input into a Gemini prompt, so an unbounded body
 * is two problems at once:
 *
 *   Cost. Prompt length is billed. A megabyte of text in `params` is a
 *   megabyte of tokens, five times a minute, per IP, from anyone.
 *
 *   Injection. The value is concatenated into an instruction, not passed as
 *   data, so text that reads like an instruction is one. Bounds do not fix
 *   that on their own, but they cap how much instruction fits.
 *
 * Every field here is therefore tighter than it strictly needs to be for the
 * legitimate use. A website audit needs a URL, not a paragraph.
 */

/** Free-text a visitor types into a form. Generous, but finite. */
const shortText = z.string().trim().max(200);
const mediumText = z.string().trim().max(2000);

export const AuditToolSchema = strictObject({
  // A real URL, not a string that happens to be in a url-shaped field. This
  // reaches an LLM prompt, so "https://x.com ignore previous instructions"
  // must fail parsing rather than be summarised.
  url: httpUrl,
  email: email.optional(),
});

export const EstimateToolSchema = strictObject({
  // Service codes, resolved against the catalogue. Bounded hard: this array
  // is interpolated into the prompt in full.
  services: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),
  email: email.optional(),
});

export const BriefToolSchema = strictObject({
  industry: shortText.optional(),
  goals: mediumText.optional(),
  budget: shortText.optional(),
  timeline: shortText.optional(),
});

/**
 * The legal-template tool. `params` was `any` and reached the prompt via
 * `JSON.stringify(params)` — an object of arbitrary depth and size.
 *
 * A flat record of short strings covers what the form actually sends, and
 * makes the serialised size predictable.
 */
export const LegalTemplateToolSchema = strictObject({
  templateType: z.string().trim().min(1).max(100),
  params: z.record(z.string().max(100), z.string().max(1000)).optional(),
});

export const ExpressCheckoutSchema = strictObject({
  serviceCode: z.string().trim().min(1).max(120),
  email,
  // Optional: the express flow can proceed on an email alone.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, "Enter a phone number in international format")
    .optional(),
});

export const CreateReferralSchema = strictObject({
  referredEmail: email,
  referredName: z.string().trim().min(1).max(200),
});

/**
 * An inbound WhatsApp webhook.
 *
 * The worker reads `from`, `message` and `type`, sends `message` to Gemini,
 * and then posts a reply **to `from`** through the business account. Both the
 * recipient and — via the model's `suggestedReply` — much of the message body
 * therefore come from the request. Bounded tightly, and the route verifies a
 * signature before any of this is reached.
 */
export const WhatsAppWebhookSchema = z
  .object({
    from: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/, "from must be a phone number")
      .optional(),
    type: z
      .enum(["text", "interactive", "image", "document", "audio", "video"])
      .optional(),
    message: z
      .union([
        z.string().max(4096),
        z.object({ body: z.string().max(4096) }).passthrough(),
      ])
      .optional(),
    timestamp: z.union([z.string().max(64), z.number()]).optional(),
  })
  // Meta wraps the real payload in entry[].changes[].value; accept the outer
  // envelope without trying to model every field it may carry.
  .passthrough();

export const PreviewGenSchema = strictObject({
  serviceId: z.string().trim().min(1).max(120),
  tier: z.enum(["STARTER", "GROWTH", "PREMIUM"]).optional(),
});

/** The public "book a demo" form. Unauthenticated, so every field is bounded. */
export const DemoLeadSchema = strictObject({
  name: z.string().trim().min(1).max(200),
  email,
  phone: z.string().trim().max(32).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  preferredDate: z.string().trim().max(64).optional(),
  source: z.string().trim().max(100).optional(),
});
