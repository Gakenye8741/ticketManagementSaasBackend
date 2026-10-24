import { Router } from "express";
import {
  adminAuth,
  adminOrOrganizerAuth,
  scannerAuth,
  anyAuthenticatedUser,
  authMiddleware,
} from "../../middleware/bearAuth";
import {
  generateTicketsForBookingController,
  getTicketByIdController,
  getTicketByTokenController,
  getTicketsByBookingIdController,
  getTicketsByEventIdController,
  getTicketsByHolderIdController,
  getTicketsByPurchaserIdController,
  assignTicketController,
  bulkAssignBundleTicketsController,
  initiateTicketTransferController,
  claimTransferredTicketController,
  scanTicketController,
  unassignTicketController,
  getTicketsByBundleIdController,
  countEventTicketsController,
  countScannedAttendeesController,
  updateTicketHolderController,
  resetTicketScanController,
  deleteTicketController,
  getUnassignedUserTicketsController,
} from "./ticket.controller";

const TicketRouter = Router();

// ==========================================
// TICKET ROUTES
// ==========================================
//
// Route order matters in Express: the FIRST match wins.
// So every fixed-path route and every sub-path (like /bundle/assign-bulk
// or /holder/update) must be declared BEFORE the generic "/:id" route.
// Otherwise "/bundle/assign-bulk" would be swallowed by "/:id/assign"
// (with id = "bundle") and return a 400 instead of doing the bulk assign.
// ==========================================

// 1. Generate tickets for a booking
TicketRouter.post("/booking/:bookingId/generate", adminOrOrganizerAuth, generateTicketsForBookingController);

// 2. Scan ticket at gate (Allowed for scanners, organizers, and admins)
//    Declared early so it can never be shadowed by a "/:id" route.
TicketRouter.post("/scan", authMiddleware(["scanner", "organizer", "admin"]), scanTicketController);

// 3. Get ticket by token
TicketRouter.get("/token/:token", anyAuthenticatedUser, getTicketByTokenController);

// 4. Get tickets by booking ID
TicketRouter.get("/booking/:bookingId", anyAuthenticatedUser, getTicketsByBookingIdController);

// 5. Get tickets by event ID
TicketRouter.get("/event/:eventId", adminOrOrganizerAuth, getTicketsByEventIdController);

// 6. Count total tickets for event (must come BEFORE "/event/:eventId")
TicketRouter.get("/event/:eventId/count", adminOrOrganizerAuth, countEventTicketsController);

// 7. Count scanned attendees for event (must come BEFORE "/event/:eventId")
TicketRouter.get("/event/:eventId/scanned-count", adminOrOrganizerAuth, countScannedAttendeesController);

// 8. Get tickets by holder ID
TicketRouter.get("/holder/:digitalId", anyAuthenticatedUser, getTicketsByHolderIdController);

// 9. Get unassigned user tickets (must come BEFORE "/holder/:digitalId")
TicketRouter.get("/holder/:digitalId/unassigned", anyAuthenticatedUser, getUnassignedUserTicketsController);

// 10. Update ticket holder (admin only). Must be BEFORE "/:id" routes.
TicketRouter.patch("/holder/update", adminAuth, updateTicketHolderController);

// 11. Bulk assign bundle tickets. Must be BEFORE "/bundle/:bundleId" and "/:id/assign".
TicketRouter.patch("/bundle/assign-bulk", anyAuthenticatedUser, bulkAssignBundleTicketsController);

// 12. Get tickets by bundle ID
TicketRouter.get("/bundle/:bundleId", anyAuthenticatedUser, getTicketsByBundleIdController);

// 13. Get tickets by purchaser ID
TicketRouter.get("/purchaser/:purchaserDigitalId", anyAuthenticatedUser, getTicketsByPurchaserIdController);

// 14. Initiate ticket transfer
TicketRouter.post("/transfer/initiate", anyAuthenticatedUser, initiateTicketTransferController);

// 15. Claim transferred ticket
TicketRouter.post("/transfer/claim", anyAuthenticatedUser, claimTransferredTicketController);

// 16. Assign ticket to an attendee
TicketRouter.patch("/:id/assign", anyAuthenticatedUser, assignTicketController);

// 17. Unassign ticket
TicketRouter.patch("/:id/unassign", anyAuthenticatedUser, unassignTicketController);

// 18. Reset ticket scan (admin or organizer)
TicketRouter.patch("/:id/reset-scan", adminOrOrganizerAuth, resetTicketScanController);

// 19. Delete ticket record (admin only)
TicketRouter.delete("/:id", adminAuth, deleteTicketController);

// 20. Get ticket by ID — LAST, after every fixed path is already matched.
TicketRouter.get("/:id", anyAuthenticatedUser, getTicketByIdController);

export default TicketRouter;