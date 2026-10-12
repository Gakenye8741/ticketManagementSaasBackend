import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import * as service from "./Supportticket.service";
import {
  addMultipleMediaBodySchema,
  assignTicketSchema,
  assigneeIdParamSchema,
  assigneeTicketsFiltersSchema,
  averageResolutionSchema,
  createResponseBodySchema,
  createTicketBodySchema,
  digitalIdParamSchema,
  mediaFileBodySchema,
  mediaIdParamSchema,
  mediaListOptionsSchema,
  orgIdParamSchema,
  organizationTicketsFiltersSchema,
  platformTicketsFiltersSchema,
  responseIdParamSchema,
  responseListOptionsSchema,
  searchTicketsSchema,
  staleTicketsSchema,
  ticketCountFiltersSchema,
  ticketFiltersSchema,
  ticketIdParamSchema,
  unassignedTicketsSchema,
  updateResponseSchema,
  updateTicketPrioritySchema,
  updateTicketSchema,
  updateTicketStatusSchema,
  userTicketsFiltersSchema,
} from "../../validators/Supportticketvalidators";

// =======================================================
// AUTH ASSUMPTIONS
// Your auth middleware must set `req.user`. Adjust the shape / role names
// below to match your app.
// =======================================================

type Role = "superadmin" | "org_admin" | "agent" | "user";

export type AuthUser = {
  digitalId: number;
  orgId?: number | null;
  role: Role;
};

type AuthedRequest = Request & { user?: AuthUser };

const STAFF_ROLES: Role[] = ["superadmin", "org_admin", "agent"];

// =======================================================
// ERRORS + HANDLER WRAPPER
// =======================================================

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const notFound = (what: string) => new HttpError(404, `${what} not found`);

/** Wraps an async controller: maps Zod / HttpError / unknown errors to JSON responses. */
const handle =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res, _next: NextFunction) => {
    try {
      await fn(req as AuthedRequest, res);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: err.flatten(),
        });
      }
      if (err instanceof HttpError) {
        return res.status(err.status).json({ message: err.message });
      }
      console.error("[supportTickets.controller]", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

// =======================================================
// AUTH / PERMISSION HELPERS
// =======================================================

const requireUser = (req: AuthedRequest): AuthUser => {
  if (!req.user) throw new HttpError(401, "Authentication required");
  return req.user;
};

const isStaff = (user: AuthUser) => STAFF_ROLES.includes(user.role);

const requireStaff = (req: AuthedRequest): AuthUser => {
  const user = requireUser(req);
  if (!isStaff(user)) throw new HttpError(403, "Staff access required");
  return user;
};

const requireSuperadmin = (req: AuthedRequest): AuthUser => {
  const user = requireUser(req);
  if (user.role !== "superadmin") {
    throw new HttpError(403, "Superadmin access required");
  }
  return user;
};

type TicketLike = NonNullable<Awaited<ReturnType<typeof service.getSupportTicketById>>>;

/** Staff can touch tickets in their own organization (or ones assigned to them); superadmin can touch all. */
const canAccessTicket = (user: AuthUser, ticket: TicketLike) => {
  if (user.role === "superadmin") return true;
  if (ticket.digitalId === user.digitalId) return true;
  if (!isStaff(user)) return false;
  if (ticket.assignedTo === user.digitalId) return true;
  return ticket.scope === "Organization" && ticket.orgId === user.orgId;
};

/** Loads the ticket and checks the current user may access it. */
const loadAccessibleTicket = async (req: AuthedRequest, ticketId: number) => {
  const user = requireUser(req);
  const ticket = await service.getSupportTicketById(ticketId);
  if (!ticket) throw notFound("Ticket");
  if (!canAccessTicket(user, ticket)) {
    throw new HttpError(403, "You do not have access to this ticket");
  }
  return { user, ticket };
};

/** Like loadAccessibleTicket, but staff only. */
const loadManageableTicket = async (req: AuthedRequest, ticketId: number) => {
  requireStaff(req);
  return loadAccessibleTicket(req, ticketId);
};

/** Non-staff users can never see internal notes, whatever they ask for. */
const canSeeInternal = (user: AuthUser, requested: boolean) =>
  isStaff(user) && requested;

/** Non-staff users can only list their own tickets. */
const ensureSelfOrStaff = (user: AuthUser, digitalId: number) => {
  if (!isStaff(user) && user.digitalId !== digitalId) {
    throw new HttpError(403, "You can only view your own tickets");
  }
};

const ensureOrgAccess = (user: AuthUser, orgId: number) => {
  if (user.role === "superadmin") return;
  if (!isStaff(user) || user.orgId !== orgId) {
    throw new HttpError(403, "You do not have access to this organization");
  }
};

// =======================================================
// SUPPORT TICKETS
// =======================================================

// POST /tickets
export const createTicket = handle(async (req, res) => {
  const user = requireUser(req);
  const body = createTicketBodySchema.parse(req.body);

  // Regular users can only file tickets for their own organization
  if (body.orgId !== undefined && !isStaff(user) && body.orgId !== user.orgId) {
    throw new HttpError(403, "You cannot create tickets for another organization");
  }

  const ticket = await service.createSupportTicket({
    ...body,
    digitalId: user.digitalId,
  });
  res.status(201).json(ticket);
});

// GET /tickets/:ticketId
export const getTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { user } = await loadAccessibleTicket(req, ticketId);
  const { includeInternal } = responseListOptionsSchema.parse(req.query);

  const ticket = await service.getSupportTicketWithDetails(ticketId, {
    includeInternal: canSeeInternal(user, includeInternal),
  });
  if (!ticket) throw notFound("Ticket");
  res.json(ticket);
});

// GET /tickets  (staff: everything in their scope; users: only their own)
export const listTickets = handle(async (req, res) => {
  const user = requireUser(req);
  const filters = ticketFiltersSchema.parse(req.query);

  if (user.role === "superadmin") {
    return res.json(await service.getAllSupportTickets(filters));
  }
  if (isStaff(user)) {
    return res.json(
      await service.getAllSupportTickets({
        ...filters,
        orgId: user.orgId ?? undefined,
        scope: "Organization",
      })
    );
  }
  res.json(
    await service.getAllSupportTickets({ ...filters, digitalId: user.digitalId })
  );
});

// GET /tickets/mine
export const getMyTickets = handle(async (req, res) => {
  const user = requireUser(req);
  const filters = userTicketsFiltersSchema.parse(req.query);
  res.json(await service.getTicketsByUser(user.digitalId, filters));
});

// GET /users/:digitalId/tickets
export const getTicketsByUser = handle(async (req, res) => {
  const user = requireUser(req);
  const { digitalId } = digitalIdParamSchema.parse(req.params);
  ensureSelfOrStaff(user, digitalId);
  const filters = userTicketsFiltersSchema.parse(req.query);
  res.json(await service.getTicketsByUser(digitalId, filters));
});

// GET /organizations/:orgId/tickets
export const getTicketsByOrganization = handle(async (req, res) => {
  const user = requireStaff(req);
  const { orgId } = orgIdParamSchema.parse(req.params);
  ensureOrgAccess(user, orgId);
  const filters = organizationTicketsFiltersSchema.parse(req.query);
  res.json(await service.getTicketsByOrganization(orgId, filters));
});

// GET /platform/tickets  (superadmin)
export const getPlatformTickets = handle(async (req, res) => {
  requireSuperadmin(req);
  const filters = platformTicketsFiltersSchema.parse(req.query);
  res.json(await service.getPlatformTickets(filters));
});

// GET /agents/:assignedTo/tickets
export const getTicketsByAssignee = handle(async (req, res) => {
  const user = requireStaff(req);
  const { assignedTo } = assigneeIdParamSchema.parse(req.params);
  if (user.role === "agent" && user.digitalId !== assignedTo) {
    throw new HttpError(403, "Agents can only view their own assigned tickets");
  }
  const filters = assigneeTicketsFiltersSchema.parse(req.query);
  res.json(await service.getTicketsByAssignee(assignedTo, filters));
});

// GET /tickets/assigned  (tickets assigned to the logged-in staff member)
export const getMyAssignedTickets = handle(async (req, res) => {
  const user = requireStaff(req);
  const filters = assigneeTicketsFiltersSchema.parse(req.query);
  res.json(await service.getTicketsByAssignee(user.digitalId, filters));
});

// GET /tickets/unassigned
export const getUnassignedTickets = handle(async (req, res) => {
  const user = requireStaff(req);
  const options = unassignedTicketsSchema.parse(req.query);

  // Org staff are limited to their own organization
  const scoped =
    user.role === "superadmin"
      ? options
      : { ...options, orgId: user.orgId ?? undefined, scope: "Organization" as const };

  res.json(await service.getUnassignedTickets(scoped));
});

// GET /tickets/escalated  (superadmin)
export const getEscalatedTickets = handle(async (req, res) => {
  requireSuperadmin(req);
  res.json(await service.getEscalatedTickets());
});

// GET /tickets/stale
export const getStaleTickets = handle(async (req, res) => {
  const user = requireStaff(req);
  const { days, orgId } = staleTicketsSchema.parse(req.query);
  const scopedOrgId = user.role === "superadmin" ? orgId : user.orgId ?? undefined;
  res.json(await service.getStaleTickets(days, { orgId: scopedOrgId }));
});

// GET /tickets/search?term=...
export const searchTickets = handle(async (req, res) => {
  const user = requireUser(req);
  const { term, ...filters } = searchTicketsSchema.parse(req.query);

  let scoped = filters;
  if (user.role !== "superadmin") {
    scoped = isStaff(user)
      ? { ...filters, orgId: user.orgId ?? undefined, scope: "Organization" }
      : { ...filters, digitalId: user.digitalId };
  }
  res.json(await service.searchSupportTickets(term, scoped));
});

// PATCH /tickets/:ticketId
export const updateTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const body = updateTicketSchema.parse(req.body);
  const { user, ticket } = await loadAccessibleTicket(req, ticketId);

  // Owners may edit text only; changing priority is staff-only
  if (body.priority !== undefined && !isStaff(user)) {
    throw new HttpError(403, "Only staff can change priority");
  }
  if (!isStaff(user) && ticket.digitalId !== user.digitalId) {
    throw new HttpError(403, "You cannot edit this ticket");
  }

  res.json(await service.updateSupportTicket(ticketId, body));
});

// PATCH /tickets/:ticketId/status
export const updateTicketStatus = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { status } = updateTicketStatusSchema.parse(req.body);
  await loadManageableTicket(req, ticketId);
  res.json(await service.updateTicketStatus(ticketId, status));
});

// PATCH /tickets/:ticketId/priority
export const updateTicketPriority = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { priority } = updateTicketPrioritySchema.parse(req.body);
  await loadManageableTicket(req, ticketId);
  res.json(await service.updateTicketPriority(ticketId, priority));
});

// PATCH /tickets/:ticketId/assign
export const assignTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { assignedTo } = assignTicketSchema.parse(req.body);
  await loadManageableTicket(req, ticketId);
  res.json(await service.assignTicket(ticketId, assignedTo));
});

// PATCH /tickets/:ticketId/unassign
export const unassignTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadManageableTicket(req, ticketId);
  res.json(await service.unassignTicket(ticketId));
});

// POST /tickets/:ticketId/escalate
export const escalateTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { user } = await loadManageableTicket(req, ticketId);

  const ticket = await service.escalateTicketToPlatform(ticketId, user.digitalId);
  if (!ticket) {
    throw new HttpError(409, "Ticket is already a platform ticket");
  }
  res.json(ticket);
});

// POST /tickets/:ticketId/close
export const closeTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadManageableTicket(req, ticketId);
  res.json(await service.closeTicket(ticketId));
});

// POST /tickets/:ticketId/resolve
export const resolveTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadManageableTicket(req, ticketId);
  res.json(await service.resolveTicket(ticketId));
});

// POST /tickets/:ticketId/reopen  (owner or staff)
export const reopenTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadAccessibleTicket(req, ticketId);
  res.json(await service.reopenTicket(ticketId));
});

// DELETE /tickets/:ticketId  (superadmin)
export const deleteTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  requireSuperadmin(req);
  const deleted = await service.deleteSupportTicket(ticketId);
  if (!deleted) throw notFound("Ticket");
  res.status(204).send();
});

// GET /tickets/stats/status
export const countTicketsByStatus = handle(async (req, res) => {
  const user = requireStaff(req);
  const filters = ticketCountFiltersSchema.parse(req.query);
  const scoped =
    user.role === "superadmin"
      ? filters
      : { ...filters, orgId: user.orgId ?? undefined, scope: "Organization" as const };
  res.json(await service.countTicketsByStatus(scoped));
});

// GET /tickets/stats/priority
export const countTicketsByPriority = handle(async (req, res) => {
  const user = requireStaff(req);
  const filters = ticketCountFiltersSchema.parse(req.query);
  const scoped =
    user.role === "superadmin"
      ? filters
      : { ...filters, orgId: user.orgId ?? undefined, scope: "Organization" as const };
  res.json(await service.countTicketsByPriority(scoped));
});

// GET /tickets/stats/resolution-time
export const getAverageResolutionHours = handle(async (req, res) => {
  const user = requireStaff(req);
  const { orgId } = averageResolutionSchema.parse(req.query);
  const scopedOrgId = user.role === "superadmin" ? orgId : user.orgId ?? undefined;
  const hours = await service.getAverageResolutionHours({ orgId: scopedOrgId });
  res.json({ hours });
});

// =======================================================
// RESPONSES
// =======================================================

// POST /tickets/:ticketId/responses
export const createResponse = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const body = createResponseBodySchema.parse(req.body);
  const { user } = await loadAccessibleTicket(req, ticketId);

  const staff = isStaff(user);
  if (body.isInternal && !staff) {
    throw new HttpError(403, "Only staff can post internal notes");
  }

  const response = await service.createResponse({
    ticketId,
    digitalId: user.digitalId,
    message: body.message,
    isStaff: staff,
    isInternal: staff ? body.isInternal ?? false : false,
  });
  res.status(201).json(response);
});

// GET /tickets/:ticketId/responses
export const getResponsesByTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { includeInternal } = responseListOptionsSchema.parse(req.query);
  const { user } = await loadAccessibleTicket(req, ticketId);

  res.json(
    await service.getResponsesByTicket(ticketId, {
      includeInternal: canSeeInternal(user, includeInternal),
    })
  );
});

// GET /tickets/:ticketId/responses/latest
export const getLatestResponse = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { includeInternal } = responseListOptionsSchema.parse(req.query);
  const { user } = await loadAccessibleTicket(req, ticketId);

  res.json(
    await service.getLatestResponse(ticketId, {
      includeInternal: canSeeInternal(user, includeInternal),
    })
  );
});

// GET /tickets/:ticketId/responses/count
export const countResponsesByTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { includeInternal } = responseListOptionsSchema.parse(req.query);
  const { user } = await loadAccessibleTicket(req, ticketId);

  const count = await service.countResponsesByTicket(ticketId, {
    includeInternal: canSeeInternal(user, includeInternal),
  });
  res.json({ count });
});

// GET /responses/:responseId
export const getResponse = handle(async (req, res) => {
  const { responseId } = responseIdParamSchema.parse(req.params);
  const response = await service.getResponseById(responseId);
  if (!response) throw notFound("Response");

  const { user } = await loadAccessibleTicket(req, response.ticketId);
  if (response.isInternal && !isStaff(user)) throw notFound("Response");
  res.json(response);
});

// GET /users/:digitalId/responses
export const getResponsesByUser = handle(async (req, res) => {
  const user = requireUser(req);
  const { digitalId } = digitalIdParamSchema.parse(req.params);
  ensureSelfOrStaff(user, digitalId);

  const rows = await service.getResponsesByUser(digitalId);
  res.json(isStaff(user) ? rows : rows.filter((r) => !r.isInternal));
});

// PATCH /responses/:responseId  (author or staff)
export const updateResponse = handle(async (req, res) => {
  const { responseId } = responseIdParamSchema.parse(req.params);
  const { message } = updateResponseSchema.parse(req.body);

  const existing = await service.getResponseById(responseId);
  if (!existing) throw notFound("Response");

  const { user } = await loadAccessibleTicket(req, existing.ticketId);
  if (existing.digitalId !== user.digitalId && !isStaff(user)) {
    throw new HttpError(403, "You can only edit your own responses");
  }
  res.json(await service.updateResponse(responseId, message));
});

// DELETE /responses/:responseId  (author or staff)
export const deleteResponse = handle(async (req, res) => {
  const { responseId } = responseIdParamSchema.parse(req.params);

  const existing = await service.getResponseById(responseId);
  if (!existing) throw notFound("Response");

  const { user } = await loadAccessibleTicket(req, existing.ticketId);
  if (existing.digitalId !== user.digitalId && !isStaff(user)) {
    throw new HttpError(403, "You can only delete your own responses");
  }
  await service.deleteResponse(responseId);
  res.status(204).send();
});

// =======================================================
// SUPPORT TICKETS MEDIA
// =======================================================

// POST /tickets/:ticketId/media
export const addTicketMedia = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const file = mediaFileBodySchema.parse(req.body);
  const { user } = await loadAccessibleTicket(req, ticketId);

  const media = await service.addTicketMedia(ticketId, {
    ...file,
    uploadedBy: user.digitalId,
  });
  res.status(201).json(media);
});

// POST /tickets/:ticketId/responses/:responseId/media
export const addResponseMedia = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { responseId } = responseIdParamSchema.parse(req.params);
  const file = mediaFileBodySchema.parse(req.body);
  const { user } = await loadAccessibleTicket(req, ticketId);

  const response = await service.getResponseById(responseId);
  if (!response || response.ticketId !== ticketId) throw notFound("Response");

  const media = await service.addResponseMedia(ticketId, responseId, {
    ...file,
    uploadedBy: user.digitalId,
  });
  res.status(201).json(media);
});

// POST /tickets/:ticketId/media/bulk
export const addMultipleMedia = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const { files } = addMultipleMediaBodySchema.parse(req.body);
  const { user } = await loadAccessibleTicket(req, ticketId);

  const items = files.map((f) => ({
    ...f,
    ticketId,
    responseId: f.responseId ?? null,
    uploadedBy: user.digitalId,
  }));
  res.status(201).json(await service.addMultipleMedia(items));
});

// GET /tickets/:ticketId/media
export const getMediaByTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  const options = mediaListOptionsSchema.parse(req.query);
  await loadAccessibleTicket(req, ticketId);
  res.json(await service.getMediaByTicket(ticketId, options));
});

// GET /responses/:responseId/media
export const getMediaByResponse = handle(async (req, res) => {
  const { responseId } = responseIdParamSchema.parse(req.params);
  const response = await service.getResponseById(responseId);
  if (!response) throw notFound("Response");

  const { user } = await loadAccessibleTicket(req, response.ticketId);
  if (response.isInternal && !isStaff(user)) throw notFound("Response");
  res.json(await service.getMediaByResponse(responseId));
});

// GET /media/:mediaId
export const getMedia = handle(async (req, res) => {
  const { mediaId } = mediaIdParamSchema.parse(req.params);
  const media = await service.getMediaById(mediaId);
  if (!media) throw notFound("Media");

  await loadAccessibleTicket(req, media.ticketId);
  res.json(media);
});

// GET /tickets/:ticketId/media/stats
export const getMediaStats = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadAccessibleTicket(req, ticketId);

  const [count, totalBytes] = await Promise.all([
    service.countMediaByTicket(ticketId),
    service.getTotalMediaSizeForTicket(ticketId),
  ]);
  res.json({ count, totalBytes });
});

// DELETE /media/:mediaId  (uploader or staff)
export const deleteMedia = handle(async (req, res) => {
  const { mediaId } = mediaIdParamSchema.parse(req.params);
  const media = await service.getMediaById(mediaId);
  if (!media) throw notFound("Media");

  const { user } = await loadAccessibleTicket(req, media.ticketId);
  if (media.uploadedBy !== user.digitalId && !isStaff(user)) {
    throw new HttpError(403, "You can only delete files you uploaded");
  }

  await service.deleteMedia(mediaId);
  // TODO: also delete the physical file from storage using media.fileUrl
  res.status(204).send();
});

// DELETE /tickets/:ticketId/media  (staff)
export const deleteAllMediaForTicket = handle(async (req, res) => {
  const { ticketId } = ticketIdParamSchema.parse(req.params);
  await loadManageableTicket(req, ticketId);
  const deleted = await service.deleteAllMediaForTicket(ticketId);
  // TODO: also delete the physical files from storage
  res.json({ deleted: deleted.length });
});