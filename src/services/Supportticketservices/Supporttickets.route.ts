import { Router } from "express";

import {
  adminAuth,
  adminOrOrganizerAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth"; // adjust path

import {
  // tickets
  createTicket,
  getTicket,
  listTickets,
  getMyTickets,
  getMyAssignedTickets,
  getTicketsByUser,
  getTicketsByOrganization,
  getTicketsByAssignee,
  getPlatformTickets,
  searchTickets,
  getUnassignedTickets,
  getEscalatedTickets,
  getStaleTickets,
  countTicketsByStatus,
  countTicketsByPriority,
  getAverageResolutionHours,
  updateTicket,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
  unassignTicket,
  escalateTicket,
  closeTicket,
  resolveTicket,
  reopenTicket,
  deleteTicket,
  // responses
  createResponse,
  getResponsesByTicket,
  getLatestResponse,
  countResponsesByTicket,
  getResponse,
  getResponsesByUser,
  updateResponse,
  deleteResponse,
  // media
  addTicketMedia,
  addResponseMedia,
  addMultipleMedia,
  getMediaByTicket,
  getMediaByResponse,
  getMedia,
  getMediaStats,
  deleteMedia,
  deleteAllMediaForTicket,
} from "./Supporttickets.controller"; // adjust path

const supportTicketsRouter = Router();

// =======================================================
// TICKETS: fixed paths first, so they are not read as /:ticketId
// =======================================================

// any logged-in user can open a ticket
supportTicketsRouter.post("/tickets", anyAuthenticatedUser, createTicket);

// admin only
supportTicketsRouter.get("/tickets", adminAuth, listTickets);

// any logged-in user: their own tickets
supportTicketsRouter.get("/tickets/mine", anyAuthenticatedUser, getMyTickets);

// staff (admin or organizer): tickets assigned to me
supportTicketsRouter.get("/tickets/assigned", adminOrOrganizerAuth, getMyAssignedTickets);

// admin only
supportTicketsRouter.get("/tickets/platform", adminAuth, getPlatformTickets);
supportTicketsRouter.get("/tickets/escalated", adminAuth, getEscalatedTickets);

// any logged-in user (the controller limits results to what they may see)
supportTicketsRouter.get("/tickets/search", anyAuthenticatedUser, searchTickets);

// staff (admin or organizer)
supportTicketsRouter.get("/tickets/unassigned", adminOrOrganizerAuth, getUnassignedTickets);
supportTicketsRouter.get("/tickets/stale", adminOrOrganizerAuth, getStaleTickets);

// staff stats
supportTicketsRouter.get("/tickets/stats/status", adminOrOrganizerAuth, countTicketsByStatus);
supportTicketsRouter.get("/tickets/stats/priority", adminOrOrganizerAuth, countTicketsByPriority);
supportTicketsRouter.get(
  "/tickets/stats/resolution-time",
  adminOrOrganizerAuth,
  getAverageResolutionHours
);

// =======================================================
// TICKETS: lists by user / organization / agent
// =======================================================

// owner or staff (the controller checks which)
supportTicketsRouter.get("/users/:digitalId/tickets", anyAuthenticatedUser, getTicketsByUser);

// staff (the controller limits organizers to their own organization)
supportTicketsRouter.get(
  "/organizations/:orgId/tickets",
  adminOrOrganizerAuth,
  getTicketsByOrganization
);
supportTicketsRouter.get(
  "/agents/:assignedTo/tickets",
  adminOrOrganizerAuth,
  getTicketsByAssignee
);

// =======================================================
// TICKETS: single ticket
// =======================================================

// owner or staff (the controller checks which)
supportTicketsRouter.get("/tickets/:ticketId", anyAuthenticatedUser, getTicket);
supportTicketsRouter.patch("/tickets/:ticketId", anyAuthenticatedUser, updateTicket);
supportTicketsRouter.post("/tickets/:ticketId/reopen", anyAuthenticatedUser, reopenTicket);

// staff only
supportTicketsRouter.patch("/tickets/:ticketId/status", adminOrOrganizerAuth, updateTicketStatus);
supportTicketsRouter.patch(
  "/tickets/:ticketId/priority",
  adminOrOrganizerAuth,
  updateTicketPriority
);
supportTicketsRouter.patch("/tickets/:ticketId/assign", adminOrOrganizerAuth, assignTicket);
supportTicketsRouter.patch("/tickets/:ticketId/unassign", adminOrOrganizerAuth, unassignTicket);
supportTicketsRouter.post("/tickets/:ticketId/escalate", adminOrOrganizerAuth, escalateTicket);
supportTicketsRouter.post("/tickets/:ticketId/close", adminOrOrganizerAuth, closeTicket);
supportTicketsRouter.post("/tickets/:ticketId/resolve", adminOrOrganizerAuth, resolveTicket);

// admin only
supportTicketsRouter.delete("/tickets/:ticketId", adminAuth, deleteTicket);

// =======================================================
// RESPONSES
// =======================================================

supportTicketsRouter.post("/tickets/:ticketId/responses", anyAuthenticatedUser, createResponse);
supportTicketsRouter.get("/tickets/:ticketId/responses", anyAuthenticatedUser, getResponsesByTicket);

// fixed sub-paths before anything that could read them as an id
supportTicketsRouter.get(
  "/tickets/:ticketId/responses/latest",
  anyAuthenticatedUser,
  getLatestResponse
);
supportTicketsRouter.get(
  "/tickets/:ticketId/responses/count",
  anyAuthenticatedUser,
  countResponsesByTicket
);

// owner or staff (the controller checks which)
supportTicketsRouter.get("/users/:digitalId/responses", anyAuthenticatedUser, getResponsesByUser);
supportTicketsRouter.get("/responses/:responseId", anyAuthenticatedUser, getResponse);
supportTicketsRouter.patch("/responses/:responseId", anyAuthenticatedUser, updateResponse);
supportTicketsRouter.delete("/responses/:responseId", anyAuthenticatedUser, deleteResponse);

// =======================================================
// MEDIA
// =======================================================

supportTicketsRouter.post("/tickets/:ticketId/media", anyAuthenticatedUser, addTicketMedia);
supportTicketsRouter.post("/tickets/:ticketId/media/bulk", anyAuthenticatedUser, addMultipleMedia);
supportTicketsRouter.post(
  "/tickets/:ticketId/responses/:responseId/media",
  anyAuthenticatedUser,
  addResponseMedia
);

supportTicketsRouter.get("/tickets/:ticketId/media", anyAuthenticatedUser, getMediaByTicket);
supportTicketsRouter.get("/tickets/:ticketId/media/stats", anyAuthenticatedUser, getMediaStats);
supportTicketsRouter.get(
  "/responses/:responseId/media",
  anyAuthenticatedUser,
  getMediaByResponse
);
supportTicketsRouter.get("/media/:mediaId", anyAuthenticatedUser, getMedia);

supportTicketsRouter.delete("/media/:mediaId", anyAuthenticatedUser, deleteMedia);
// staff only: remove every file on a ticket
supportTicketsRouter.delete(
  "/tickets/:ticketId/media",
  adminOrOrganizerAuth,
  deleteAllMediaForTicket
);

export default supportTicketsRouter;