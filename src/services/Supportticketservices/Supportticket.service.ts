import {
  and,
  or,
  eq,
  desc,
  asc,
  sql,
  count,
  sum,
  inArray,
  isNull,
  isNotNull,
  ilike,
  lte,
  type SQL,
} from "drizzle-orm";
import { responses, supportTickets, supportTicketsMedia } from "../../drizzle/schema";
import db from "../../drizzle/db";


// =======================
// TYPES
// =======================

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketResponse = typeof responses.$inferSelect;
export type NewTicketResponse = typeof responses.$inferInsert;
export type TicketMedia = typeof supportTicketsMedia.$inferSelect;
export type NewTicketMedia = typeof supportTicketsMedia.$inferInsert;

export type TicketStatus = SupportTicket["status"];
export type TicketPriority = SupportTicket["priority"];
export type TicketScope = SupportTicket["scope"];

export type CreateTicketInput = Pick<
  NewSupportTicket,
  "digitalId" | "subject" | "description"
> &
  Partial<Pick<NewSupportTicket, "orgId" | "scope" | "priority" | "assignedTo">>;

export type TicketFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  scope?: TicketScope;
  orgId?: number;
  digitalId?: number;
  assignedTo?: number;
  page?: number;
  limit?: number;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// =======================
// INTERNAL HELPERS
// =======================

const getPagination = (page = 1, limit = 20) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
};

const buildTicketConditions = (filters: TicketFilters): SQL | undefined => {
  const conditions: SQL[] = [];

  if (filters.status) conditions.push(eq(supportTickets.status, filters.status));
  if (filters.priority)
    conditions.push(eq(supportTickets.priority, filters.priority));
  if (filters.scope) conditions.push(eq(supportTickets.scope, filters.scope));
  if (filters.orgId !== undefined)
    conditions.push(eq(supportTickets.orgId, filters.orgId));
  if (filters.digitalId !== undefined)
    conditions.push(eq(supportTickets.digitalId, filters.digitalId));
  if (filters.assignedTo !== undefined)
    conditions.push(eq(supportTickets.assignedTo, filters.assignedTo));

  return conditions.length ? and(...conditions) : undefined;
};

const OPEN_STATUSES: TicketStatus[] = [
  "Open",
  "In Progress",
  "Waiting on Customer",
];

// =======================================================
// SUPPORT TICKETS
// =======================================================

// 1. Create a ticket
export const createSupportTicket = async (input: CreateTicketInput) => {
  const scope: TicketScope =
    input.scope ?? (input.orgId ? "Organization" : "Platform");

  if (scope === "Organization" && !input.orgId) {
    throw new Error("Organization tickets require an orgId.");
  }

  const [ticket] = await db
    .insert(supportTickets)
    .values({ ...input, scope })
    .returning();

  return ticket;
};

// 2. Get a ticket by id
export const getSupportTicketById = async (ticketId: number) => {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.ticketId, ticketId))
    .limit(1);

  return ticket ?? null;
};

// 3. Get a ticket with owner, assignee, organization, responses and media
export const getSupportTicketWithDetails = async (
  ticketId: number,
  options: { includeInternal?: boolean } = {}
) => {
  const { includeInternal = false } = options;

  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.ticketId, ticketId),
    with: {
      user: true,
      assignee: true,
      organization: true,
      media: { where: isNull(supportTicketsMedia.responseId) },
      responses: {
        where: includeInternal ? undefined : eq(responses.isInternal, false),
        orderBy: asc(responses.createdAt),
        with: { user: true, media: true },
      },
    },
  });

  return ticket ?? null;
};

// 4. List tickets with filters and pagination (base for most list functions)
export const getAllSupportTickets = async (
  filters: TicketFilters = {}
): Promise<Paginated<SupportTicket>> => {
  const { page, limit, offset } = getPagination(filters.page, filters.limit);
  const where = buildTicketConditions(filters);

  const [data, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(supportTickets)
      .where(where)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(supportTickets).where(where),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// 5. Tickets created by a user
export const getTicketsByUser = async (
  digitalId: number,
  filters: Omit<TicketFilters, "digitalId"> = {}
) => getAllSupportTickets({ ...filters, digitalId });

// 6. Tickets for an organization (organization scope only)
export const getTicketsByOrganization = async (
  orgId: number,
  filters: Omit<TicketFilters, "orgId" | "scope"> = {}
) => getAllSupportTickets({ ...filters, orgId, scope: "Organization" });

// 7. Platform-level tickets for the superadmin
export const getPlatformTickets = async (
  filters: Omit<TicketFilters, "scope"> = {}
) => getAllSupportTickets({ ...filters, scope: "Platform" });

// 8. Tickets assigned to an agent
export const getTicketsByAssignee = async (
  assignedTo: number,
  filters: Omit<TicketFilters, "assignedTo"> = {}
) => getAllSupportTickets({ ...filters, assignedTo });

// 9. Tickets that nobody is handling yet
export const getUnassignedTickets = async (
  options: { orgId?: number; scope?: TicketScope } = {}
) => {
  const conditions: SQL[] = [
    isNull(supportTickets.assignedTo),
    inArray(supportTickets.status, OPEN_STATUSES),
  ];
  if (options.orgId !== undefined)
    conditions.push(eq(supportTickets.orgId, options.orgId));
  if (options.scope) conditions.push(eq(supportTickets.scope, options.scope));

  return db
    .select()
    .from(supportTickets)
    .where(and(...conditions))
    .orderBy(desc(supportTickets.priority), asc(supportTickets.createdAt));
};

// 10. Tickets escalated from organizations to the platform
export const getEscalatedTickets = async () =>
  db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.scope, "Platform"),
        isNotNull(supportTickets.escalatedAt)
      )
    )
    .orderBy(desc(supportTickets.escalatedAt));

// 11. Open tickets with no activity for X days
export const getStaleTickets = async (
  days = 7,
  options: { orgId?: number } = {}
) => {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const conditions: SQL[] = [
    inArray(supportTickets.status, OPEN_STATUSES),
    lte(supportTickets.updatedAt, cutoff),
  ];
  if (options.orgId !== undefined)
    conditions.push(eq(supportTickets.orgId, options.orgId));

  return db
    .select()
    .from(supportTickets)
    .where(and(...conditions))
    .orderBy(asc(supportTickets.updatedAt));
};

// 12. Search tickets by subject or description
export const searchSupportTickets = async (
  term: string,
  filters: TicketFilters = {}
): Promise<Paginated<SupportTicket>> => {
  const { page, limit, offset } = getPagination(filters.page, filters.limit);
  const escaped = term.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const searchCondition = or(
    ilike(supportTickets.subject, pattern),
    ilike(supportTickets.description, pattern)
  );
  const baseConditions = buildTicketConditions(filters);
  const where = baseConditions
    ? and(baseConditions, searchCondition)
    : searchCondition;

  const [data, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(supportTickets)
      .where(where)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(supportTickets).where(where),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// 13. Update subject, description or priority
export const updateSupportTicket = async (
  ticketId: number,
  data: Partial<Pick<NewSupportTicket, "subject" | "description" | "priority">>
) => {
  const [ticket] = await db
    .update(supportTickets)
    .set(data)
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return ticket ?? null;
};

// 14. Change status (sets or clears resolvedAt automatically)
export const updateTicketStatus = async (
  ticketId: number,
  status: TicketStatus
) => {
  const isDone = status === "Resolved" || status === "Closed";

  const [ticket] = await db
    .update(supportTickets)
    .set({ status, resolvedAt: isDone ? new Date() : null })
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return ticket ?? null;
};

// 15. Change priority
export const updateTicketPriority = async (
  ticketId: number,
  priority: TicketPriority
) => {
  const [ticket] = await db
    .update(supportTickets)
    .set({ priority })
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return ticket ?? null;
};

// 16. Assign a ticket to an agent
export const assignTicket = async (ticketId: number, assignedTo: number) => {
  const [ticket] = await db
    .update(supportTickets)
    .set({ assignedTo })
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return ticket ?? null;
};

// 17. Remove the assignee
export const unassignTicket = async (ticketId: number) => {
  const [ticket] = await db
    .update(supportTickets)
    .set({ assignedTo: null })
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return ticket ?? null;
};

// 18. Escalate an organization ticket to the platform superadmin
export const escalateTicketToPlatform = async (
  ticketId: number,
  escalatedBy: number
) => {
  const [ticket] = await db
    .update(supportTickets)
    .set({
      scope: "Platform",
      escalatedAt: new Date(),
      escalatedBy,
      assignedTo: null, // the platform team picks it up fresh
    })
    .where(
      and(
        eq(supportTickets.ticketId, ticketId),
        eq(supportTickets.scope, "Organization")
      )
    )
    .returning();

  return ticket ?? null; // null = not found, or already a platform ticket
};

// 19. Close a ticket
export const closeTicket = async (ticketId: number) =>
  updateTicketStatus(ticketId, "Closed");

// 20. Resolve a ticket
export const resolveTicket = async (ticketId: number) =>
  updateTicketStatus(ticketId, "Resolved");

// 21. Reopen a ticket
export const reopenTicket = async (ticketId: number) =>
  updateTicketStatus(ticketId, "Open");

// 22. Delete a ticket (responses and media are removed by cascade)
export const deleteSupportTicket = async (ticketId: number) => {
  const [deleted] = await db
    .delete(supportTickets)
    .where(eq(supportTickets.ticketId, ticketId))
    .returning();

  return deleted ?? null;
};

// 23. Count tickets grouped by status
export const countTicketsByStatus = async (
  filters: Pick<TicketFilters, "orgId" | "scope" | "assignedTo"> = {}
) => {
  const rows = await db
    .select({ status: supportTickets.status, total: count() })
    .from(supportTickets)
    .where(buildTicketConditions(filters))
    .groupBy(supportTickets.status);

  return Object.fromEntries(rows.map((r) => [r.status, r.total])) as Partial<
    Record<TicketStatus, number>
  >;
};

// 24. Count tickets grouped by priority
export const countTicketsByPriority = async (
  filters: Pick<TicketFilters, "orgId" | "scope" | "assignedTo"> = {}
) => {
  const rows = await db
    .select({ priority: supportTickets.priority, total: count() })
    .from(supportTickets)
    .where(buildTicketConditions(filters))
    .groupBy(supportTickets.priority);

  return Object.fromEntries(rows.map((r) => [r.priority, r.total])) as Partial<
    Record<TicketPriority, number>
  >;
};

// 25. Check whether a user owns a ticket (for permission checks)
export const isTicketOwner = async (ticketId: number, digitalId: number) => {
  const [row] = await db
    .select({ ticketId: supportTickets.ticketId })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.ticketId, ticketId),
        eq(supportTickets.digitalId, digitalId)
      )
    )
    .limit(1);

  return Boolean(row);
};

// 26. Average resolution time in hours (optionally per organization)
export const getAverageResolutionHours = async (
  options: { orgId?: number } = {}
) => {
  const conditions: SQL[] = [isNotNull(supportTickets.resolvedAt)];
  if (options.orgId !== undefined)
    conditions.push(eq(supportTickets.orgId, options.orgId));

  const [row] = await db
    .select({
      hours: sql<number | null>`avg(extract(epoch from (${supportTickets.resolvedAt} - ${supportTickets.createdAt})) / 3600)`,
    })
    .from(supportTickets)
    .where(and(...conditions));

  return row?.hours ? Number(row.hours) : null;
};

// =======================================================
// RESPONSES
// =======================================================

// 27. Add a response (also bumps the ticket's updatedAt)
export const createResponse = async (
  data: Pick<NewTicketResponse, "ticketId" | "digitalId" | "message"> &
    Partial<Pick<NewTicketResponse, "isStaff" | "isInternal">>
) =>
  db.transaction(async (tx) => {
    const [response] = await tx.insert(responses).values(data).returning();

    await tx
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.ticketId, data.ticketId));

    return response;
  });

// 28. Get all responses of a ticket (hide internal notes by default)
export const getResponsesByTicket = async (
  ticketId: number,
  options: { includeInternal?: boolean } = {}
) => {
  const { includeInternal = false } = options;
  const conditions: SQL[] = [eq(responses.ticketId, ticketId)];
  if (!includeInternal) conditions.push(eq(responses.isInternal, false));

  return db
    .select()
    .from(responses)
    .where(and(...conditions))
    .orderBy(asc(responses.createdAt));
};

// 29. Get one response
export const getResponseById = async (responseId: number) => {
  const [response] = await db
    .select()
    .from(responses)
    .where(eq(responses.responseId, responseId))
    .limit(1);

  return response ?? null;
};

// 30. Get the latest response of a ticket
export const getLatestResponse = async (
  ticketId: number,
  options: { includeInternal?: boolean } = {}
) => {
  const conditions: SQL[] = [eq(responses.ticketId, ticketId)];
  if (!options.includeInternal) conditions.push(eq(responses.isInternal, false));

  const [response] = await db
    .select()
    .from(responses)
    .where(and(...conditions))
    .orderBy(desc(responses.createdAt))
    .limit(1);

  return response ?? null;
};

// 31. Get responses written by a user
export const getResponsesByUser = async (digitalId: number) =>
  db
    .select()
    .from(responses)
    .where(eq(responses.digitalId, digitalId))
    .orderBy(desc(responses.createdAt));

// 32. Edit a response message
export const updateResponse = async (responseId: number, message: string) => {
  const [response] = await db
    .update(responses)
    .set({ message })
    .where(eq(responses.responseId, responseId))
    .returning();

  return response ?? null;
};

// 33. Delete a response (its media is removed by cascade)
export const deleteResponse = async (responseId: number) => {
  const [deleted] = await db
    .delete(responses)
    .where(eq(responses.responseId, responseId))
    .returning();

  return deleted ?? null;
};

// 34. Count responses of a ticket
export const countResponsesByTicket = async (
  ticketId: number,
  options: { includeInternal?: boolean } = {}
) => {
  const conditions: SQL[] = [eq(responses.ticketId, ticketId)];
  if (!options.includeInternal) conditions.push(eq(responses.isInternal, false));

  const [{ value }] = await db
    .select({ value: count() })
    .from(responses)
    .where(and(...conditions));

  return value;
};

// =======================================================
// SUPPORT TICKETS MEDIA
// =======================================================

type MediaFileInput = Pick<
  NewTicketMedia,
  "uploadedBy" | "fileName" | "fileUrl" | "mimeType" | "fileSize"
>;

// 35. Attach a file to the ticket itself
export const addTicketMedia = async (
  ticketId: number,
  file: MediaFileInput
) => {
  const [media] = await db
    .insert(supportTicketsMedia)
    .values({ ...file, ticketId, responseId: null })
    .returning();

  return media;
};

// 36. Attach a file to a specific response
export const addResponseMedia = async (
  ticketId: number,
  responseId: number,
  file: MediaFileInput
) => {
  const [media] = await db
    .insert(supportTicketsMedia)
    .values({ ...file, ticketId, responseId })
    .returning();

  return media;
};

// 37. Attach several files at once
export const addMultipleMedia = async (items: NewTicketMedia[]) => {
  if (items.length === 0) return [];
  return db.insert(supportTicketsMedia).values(items).returning();
};

// 38. Get all media of a ticket (or only the ticket-level files)
export const getMediaByTicket = async (
  ticketId: number,
  options: { ticketLevelOnly?: boolean } = {}
) => {
  const conditions: SQL[] = [eq(supportTicketsMedia.ticketId, ticketId)];
  if (options.ticketLevelOnly)
    conditions.push(isNull(supportTicketsMedia.responseId));

  return db
    .select()
    .from(supportTicketsMedia)
    .where(and(...conditions))
    .orderBy(asc(supportTicketsMedia.createdAt));
};

// 39. Get media attached to a response
export const getMediaByResponse = async (responseId: number) =>
  db
    .select()
    .from(supportTicketsMedia)
    .where(eq(supportTicketsMedia.responseId, responseId))
    .orderBy(asc(supportTicketsMedia.createdAt));

// 40. Get one media record
export const getMediaById = async (mediaId: number) => {
  const [media] = await db
    .select()
    .from(supportTicketsMedia)
    .where(eq(supportTicketsMedia.mediaId, mediaId))
    .limit(1);

  return media ?? null;
};

// 41. Total size in bytes of all files on a ticket (useful for upload limits)
export const getTotalMediaSizeForTicket = async (ticketId: number) => {
  const [row] = await db
    .select({ total: sum(supportTicketsMedia.fileSize) })
    .from(supportTicketsMedia)
    .where(eq(supportTicketsMedia.ticketId, ticketId));

  return Number(row?.total ?? 0);
};

// 42. Count files on a ticket
export const countMediaByTicket = async (ticketId: number) => {
  const [{ value }] = await db
    .select({ value: count() })
    .from(supportTicketsMedia)
    .where(eq(supportTicketsMedia.ticketId, ticketId));

  return value;
};

// 43. Delete one media record (remember to delete the file from storage too)
export const deleteMedia = async (mediaId: number) => {
  const [deleted] = await db
    .delete(supportTicketsMedia)
    .where(eq(supportTicketsMedia.mediaId, mediaId))
    .returning();

  return deleted ?? null;
};

// 44. Delete all media of a ticket
export const deleteAllMediaForTicket = async (ticketId: number) =>
  db
    .delete(supportTicketsMedia)
    .where(eq(supportTicketsMedia.ticketId, ticketId))
    .returning();