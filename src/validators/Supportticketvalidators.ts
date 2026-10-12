import { z } from "zod";

// =======================================================
// SHARED PRIMITIVES
// =======================================================

/** Positive integer id. `coerce` lets it accept "12" from URL params / query strings. */
const id = z.coerce.number().int().positive();

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

/** Safe boolean for query strings: "true"/"false"/"1"/"0" or a real boolean. */
const boolish = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

// =======================================================
// ENUMS
// NOTE: status and scope values come from your code.
// Priority values were not visible in the code you shared, so adjust
// TICKET_PRIORITIES to match your Drizzle enum exactly.
// =======================================================

export const TICKET_STATUSES = [
  "Open",
  "In Progress",
  "Waiting on Customer",
  "Resolved",
  "Closed",
] as const;

export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const; // <-- adjust

export const TICKET_SCOPES = ["Organization", "Platform"] as const;

export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export const ticketScopeSchema = z.enum(TICKET_SCOPES);

// =======================================================
// LIMITS
// =======================================================

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 10_000;
const MESSAGE_MAX = 10_000;
const SEARCH_TERM_MAX = 100;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES_PER_BATCH = 20;

// =======================================================
// ROUTE PARAMS
// =======================================================

export const ticketIdParamSchema = z.object({ ticketId: id });
export const responseIdParamSchema = z.object({ responseId: id });
export const mediaIdParamSchema = z.object({ mediaId: id });
export const digitalIdParamSchema = z.object({ digitalId: id });
export const orgIdParamSchema = z.object({ orgId: id });
export const assigneeIdParamSchema = z.object({ assignedTo: id });

// =======================================================
// SUPPORT TICKETS
// =======================================================

// 1. createSupportTicket
const createTicketShape = z.object({
  digitalId: id,
  subject: trimmedString(3, SUBJECT_MAX, "Subject"),
  description: trimmedString(10, DESCRIPTION_MAX, "Description"),
  orgId: id.optional(),
  scope: ticketScopeSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedTo: id.optional(),
});

type ScopeRuleInput = { scope?: string; orgId?: number };
const orgTicketNeedsOrg = (d: ScopeRuleInput) =>
  d.scope !== "Organization" || d.orgId !== undefined;
const platformTicketNoOrg = (d: ScopeRuleInput) =>
  d.scope !== "Platform" || d.orgId === undefined;

export const createTicketSchema = createTicketShape
  .refine(orgTicketNeedsOrg, {
    message: "Organization tickets require an orgId.",
    path: ["orgId"],
  })
  .refine(platformTicketNoOrg, {
    message: "Platform tickets must not have an orgId.",
    path: ["orgId"],
  });

/** Request body for the controller: digitalId is taken from the logged-in user. */
export const createTicketBodySchema = createTicketShape
  .omit({ digitalId: true, assignedTo: true })
  .refine(orgTicketNeedsOrg, {
    message: "Organization tickets require an orgId.",
    path: ["orgId"],
  })
  .refine(platformTicketNoOrg, {
    message: "Platform tickets must not have an orgId.",
    path: ["orgId"],
  });

// 4. getAllSupportTickets and every list function built on it
export const ticketFiltersSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  scope: ticketScopeSchema.optional(),
  orgId: id.optional(),
  digitalId: id.optional(),
  assignedTo: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 5-8. Filters where one field is fixed by the route
export const userTicketsFiltersSchema = ticketFiltersSchema.omit({
  digitalId: true,
});
export const organizationTicketsFiltersSchema = ticketFiltersSchema.omit({
  orgId: true,
  scope: true,
});
export const platformTicketsFiltersSchema = ticketFiltersSchema.omit({
  scope: true,
});
export const assigneeTicketsFiltersSchema = ticketFiltersSchema.omit({
  assignedTo: true,
});

// 9. getUnassignedTickets
export const unassignedTicketsSchema = z.object({
  orgId: id.optional(),
  scope: ticketScopeSchema.optional(),
});

// 11. getStaleTickets
export const staleTicketsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  orgId: id.optional(),
});

// 12. searchSupportTickets
export const searchTicketsSchema = ticketFiltersSchema.extend({
  term: z
    .string({ required_error: "Search term is required" })
    .trim()
    .min(1, "Search term cannot be empty")
    .max(SEARCH_TERM_MAX, `Search term must be at most ${SEARCH_TERM_MAX} characters`),
});

// 13. updateSupportTicket (at least one field must be sent)
export const updateTicketSchema = z
  .object({
    subject: trimmedString(3, SUBJECT_MAX, "Subject"),
    description: trimmedString(10, DESCRIPTION_MAX, "Description"),
    priority: ticketPrioritySchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update.",
  });

// 14. updateTicketStatus
export const updateTicketStatusSchema = z.object({ status: ticketStatusSchema });

// 15. updateTicketPriority
export const updateTicketPrioritySchema = z.object({
  priority: ticketPrioritySchema,
});

// 16. assignTicket
export const assignTicketSchema = z.object({ assignedTo: id });

// 18. escalateTicketToPlatform
export const escalateTicketSchema = z.object({ escalatedBy: id });

// 23-24. countTicketsByStatus / countTicketsByPriority
export const ticketCountFiltersSchema = ticketFiltersSchema.pick({
  orgId: true,
  scope: true,
  assignedTo: true,
});

// 25. isTicketOwner
export const isTicketOwnerSchema = z.object({ ticketId: id, digitalId: id });

// 26. getAverageResolutionHours
export const averageResolutionSchema = z.object({ orgId: id.optional() });

// =======================================================
// RESPONSES
// =======================================================

// 27. createResponse
export const createResponseSchema = z.object({
  ticketId: id,
  digitalId: id,
  message: trimmedString(1, MESSAGE_MAX, "Message"),
  isStaff: boolish.optional(),
  isInternal: boolish.optional(),
});

/** Request body for the controller: ticketId, digitalId and isStaff are set server-side. */
export const createResponseBodySchema = z.object({
  message: trimmedString(1, MESSAGE_MAX, "Message"),
  isInternal: boolish.optional(),
});

// 28, 30, 34. Include-internal option
export const responseListOptionsSchema = z.object({
  includeInternal: boolish.default(false),
});

// 32. updateResponse
export const updateResponseSchema = z.object({
  message: trimmedString(1, MESSAGE_MAX, "Message"),
});

// =======================================================
// SUPPORT TICKETS MEDIA
// =======================================================

const mediaFileSchema = z.object({
  uploadedBy: id,
  fileName: trimmedString(1, 255, "File name"),
  fileUrl: z.string().trim().url("File URL must be a valid URL"),
  mimeType: z
    .string()
    .trim()
    .regex(/^[\w.+-]+\/[\w.+-]+$/, "Invalid MIME type"),
  fileSize: z
    .number()
    .int()
    .positive("File size must be greater than 0")
    .max(MAX_FILE_SIZE_BYTES, "File is too large (max 25 MB)"),
});

/** Request bodies for the controller: uploadedBy and ticketId are set server-side. */
export const mediaFileBodySchema = mediaFileSchema.omit({ uploadedBy: true });

export const addMultipleMediaBodySchema = z.object({
  files: z
    .array(mediaFileBodySchema.extend({ responseId: id.nullable().optional() }))
    .min(1, "Provide at least one file")
    .max(MAX_FILES_PER_BATCH, `You can upload at most ${MAX_FILES_PER_BATCH} files at once`),
});

// 35. addTicketMedia
export const addTicketMediaSchema = mediaFileSchema;

// 36. addResponseMedia
export const addResponseMediaSchema = mediaFileSchema;

// 37. addMultipleMedia
export const addMultipleMediaSchema = z
  .array(
    mediaFileSchema.extend({
      ticketId: id,
      responseId: id.nullable().optional(),
    })
  )
  .min(1, "Provide at least one file")
  .max(MAX_FILES_PER_BATCH, `You can upload at most ${MAX_FILES_PER_BATCH} files at once`);

// 38. getMediaByTicket
export const mediaListOptionsSchema = z.object({
  ticketLevelOnly: boolish.default(false),
});

// =======================================================
// INFERRED TYPES
// =======================================================

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;
export type TicketFiltersQuery = z.infer<typeof ticketFiltersSchema>;
export type SearchTicketsQuery = z.infer<typeof searchTicketsSchema>;
export type StaleTicketsQuery = z.infer<typeof staleTicketsSchema>;
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusBody = z.infer<typeof updateTicketStatusSchema>;
export type UpdateTicketPriorityBody = z.infer<typeof updateTicketPrioritySchema>;
export type AssignTicketBody = z.infer<typeof assignTicketSchema>;
export type EscalateTicketBody = z.infer<typeof escalateTicketSchema>;
export type CreateResponseBody = z.infer<typeof createResponseBodySchema>;
export type UpdateResponseBody = z.infer<typeof updateResponseSchema>;
export type MediaFileBody = z.infer<typeof mediaFileSchema>;
export type AddMultipleMediaBody = z.infer<typeof addMultipleMediaSchema>;

// =======================================================
// USAGE EXAMPLE (Express)
// =======================================================
//
// import { createTicketSchema, ticketFiltersSchema } from "./supportTickets.validators";
//
// router.post("/tickets", async (req, res) => {
//   const parsed = createTicketSchema.safeParse(req.body);
//   if (!parsed.success) {
//     return res.status(400).json({ errors: parsed.error.flatten() });
//   }
//   const ticket = await createSupportTicket(parsed.data);
//   res.status(201).json(ticket);
// });
//
// router.get("/tickets", async (req, res) => {
//   const filters = ticketFiltersSchema.parse(req.query); // throws ZodError on bad input
//   res.json(await getAllSupportTickets(filters));
// });