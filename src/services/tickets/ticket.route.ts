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

// 1. Generate tickets for a booking
TicketRouter.post("/booking/:bookingId/generate", adminOrOrganizerAuth, generateTicketsForBookingController);

// 2. Get ticket by ID
TicketRouter.get("/:id", anyAuthenticatedUser, getTicketByIdController);

// 3. Get ticket by token
TicketRouter.get("/token/:token", anyAuthenticatedUser, getTicketByTokenController);

// 4. Get tickets by booking ID
TicketRouter.get("/booking/:bookingId", anyAuthenticatedUser, getTicketsByBookingIdController);

// 5. Get tickets by event ID
TicketRouter.get("/event/:eventId", adminOrOrganizerAuth, getTicketsByEventIdController);

// 6. Get tickets by holder ID
TicketRouter.get("/holder/:digitalId", anyAuthenticatedUser, getTicketsByHolderIdController);

// 7. Get tickets by purchaser ID
TicketRouter.get("/purchaser/:purchaserDigitalId", anyAuthenticatedUser, getTicketsByPurchaserIdController);

// 8. Assign ticket to an attendee
TicketRouter.patch("/:id/assign", anyAuthenticatedUser, assignTicketController);

// 9. Bulk assign bundle tickets
TicketRouter.patch("/bundle/assign-bulk", anyAuthenticatedUser, bulkAssignBundleTicketsController);

// 10. Initiate ticket transfer
TicketRouter.post("/transfer/initiate", anyAuthenticatedUser, initiateTicketTransferController);

// 11. Claim transferred ticket
TicketRouter.post("/transfer/claim", anyAuthenticatedUser, claimTransferredTicketController);

// 12. Scan ticket at gate (Allowed for scanners, organizers, and admins)
TicketRouter.post("/scan", authMiddleware(["scanner", "organizer", "admin"]), scanTicketController);

// 13. Unassign ticket
TicketRouter.patch("/:id/unassign", anyAuthenticatedUser, unassignTicketController);

// 14. Get tickets by bundle ID
TicketRouter.get("/bundle/:bundleId", anyAuthenticatedUser, getTicketsByBundleIdController);

// 15. Count total tickets for event
TicketRouter.get("/event/:eventId/count", adminOrOrganizerAuth, countEventTicketsController);

// 16. Count scanned attendees for event
TicketRouter.get("/event/:eventId/scanned-count", adminOrOrganizerAuth, countScannedAttendeesController);

// 17. Update ticket holder
TicketRouter.patch("/holder/update", anyAuthenticatedUser, updateTicketHolderController);

// 18. Reset ticket scan
TicketRouter.patch("/:id/reset-scan", adminOrOrganizerAuth, resetTicketScanController);

// 19. Delete ticket record
TicketRouter.delete("/:id", adminAuth, deleteTicketController);

// 20. Get unassigned user tickets
TicketRouter.get("/holder/:digitalId/unassigned", anyAuthenticatedUser, getUnassignedUserTicketsController);

export default TicketRouter;