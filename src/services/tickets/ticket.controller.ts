import { Request, Response, NextFunction } from "express";
import {
  generateTicketsForBooking,
  getTicketById,
  getTicketByToken,
  getTicketsByBookingId,
  getTicketsByEventId,
  getTicketsByHolderId,
  getTicketsByPurchaserId,
  assignTicket,
  bulkAssignBundleTickets,
  initiateTicketTransfer,
  claimTransferredTicket,
  scanTicket,
  unassignTicket,
  getTicketsByBundleId,
  countEventTickets,
  countScannedAttendees,
  updateTicketHolder,
  resetTicketScan,
  deleteTicket,
  getUnassignedUserTickets,
} from "./ticket.service";
import {
  assignTicketSchema,
  bulkAssignBundleTicketsSchema,
  initiateTicketTransferSchema,
  claimTransferredTicketSchema,
  scanTicketSchema,
  unassignTicketSchema,
  updateTicketHolderSchema,
} from "../../validators/Ticket.validator";

// ==========================================
// NEW: SMALL HELPERS
// ==========================================

/**
 * The logged-in user's digitalId, taken from the verified login token.
 * IMPORTANT: this reads `req.user.digitalId`. If your auth middleware stores
 * the id somewhere else (e.g. req.user.id or res.locals.user), change ONLY this line.
 * The id is never read from req.body, so nobody can act as another user.
 */
const requireActorId = (req: Request, res: Response): number | null => {
  const id = Number((req as any).user?.digitalId);
  if (!id || Number.isNaN(id)) {
    res.status(401).json({ success: false, message: "Please log in to continue 🔐" });
    return null;
  }
  return id;
};

/**
 * Turns the service's known errors into proper status codes so the app
 * shows the real message (e.g. "This ticket has been refunded...") instead of
 * a generic "Something went wrong". Anything unknown goes to your error middleware.
 */
const handleTicketError = (error: any, res: Response, next: NextFunction) => {
  const msg: string = error?.message ?? "";

  if (msg.includes("Unauthorized")) {
    return res.status(403).json({ success: false, message: msg });
  }
  if (msg.includes("not found")) {
    return res.status(404).json({ success: false, message: msg });
  }
  // Refunded / no longer valid / already scanned / already used
  if (
    msg.includes("refunded") ||
    msg.includes("no longer valid") ||
    msg.includes("can't be changed") ||
    msg.includes("can't be transferred") ||
    msg.includes("can't be claimed") ||
    msg.includes("already been used")
  ) {
    return res.status(409).json({ success: false, message: msg });
  }
  return next(error);
};

// ==========================================
// 1. GENERATE TICKETS FOR BOOKING CONTROLLER
// ==========================================
export const generateTicketsForBookingController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: "Valid booking ID is required 🚫" });
    }

    const data = await generateTicketsForBooking(bookingId);
    return res.status(201).json({
      success: true,
      message: "Tickets generated successfully 🎟️",
      count: data.length,
      data,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 2. GET TICKET BY ID CONTROLLER
// ==========================================
export const getTicketByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Number(req.params.id);
    const data = await getTicketById(ticketId);

    if (!data) {
      return res.status(404).json({ success: false, message: "Ticket not found 🚫" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    next(error);
  }
};
// ==========================================
// 3. GET TICKET BY TOKEN CONTROLLER
// (refunded tickets are still returned so the app can show a "Refunded" state)
// ==========================================
export const getTicketByTokenController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    const data = await getTicketByToken(token);

    if (!data) {
      return res.status(404).json({ success: false, message: "Ticket token not found 🚫" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 4. GET TICKETS BY BOOKING ID CONTROLLER
// ==========================================
export const getTicketsByBookingIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const data = await getTicketsByBookingId(bookingId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 5. GET TICKETS BY EVENT ID CONTROLLER
// ==========================================
export const getTicketsByEventIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const data = await getTicketsByEventId(eventId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 6. GET TICKETS BY HOLDER ID CONTROLLER
// ==========================================
export const getTicketsByHolderIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const digitalId = Number(req.params.digitalId);
    const data = await getTicketsByHolderId(digitalId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 7. GET TICKETS BY PURCHASER ID CONTROLLER
// ==========================================
export const getTicketsByPurchaserIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const purchaserDigitalId = Number(req.params.purchaserDigitalId);
    const data = await getTicketsByPurchaserId(purchaserDigitalId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 8. ASSIGN TICKET CONTROLLER
// ==========================================
export const assignTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = requireActorId(req, res);
    if (actorId === null) return;

    const ticketId = Number(req.params.id);
    const validatedBody = assignTicketSchema.parse(req.body);

    const data = await assignTicket(ticketId, validatedBody, actorId);
    return res.status(200).json({
      success: true,
      message: "Ticket assigned successfully ✅",
      data,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 9. BULK ASSIGN BUNDLE TICKETS CONTROLLER
// ==========================================
export const bulkAssignBundleTicketsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = requireActorId(req, res);
    if (actorId === null) return;

    const validatedBody = bulkAssignBundleTicketsSchema.parse(req.body);

    const data = await bulkAssignBundleTickets(
      validatedBody.groupBundleId,
      validatedBody.assignments,
      actorId
    );
    return res.status(200).json({
      success: true,
      message: "Bundle tickets assigned successfully 📦✅",
      count: data.length,
      data,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 10. INITIATE TICKET TRANSFER CONTROLLER
// ==========================================
export const initiateTicketTransferController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = requireActorId(req, res);
    if (actorId === null) return;

    const validatedBody = initiateTicketTransferSchema.parse(req.body);

    const result = await initiateTicketTransfer(validatedBody.ticketId, actorId);
    return res.status(200).json({
      success: true,
      message: "Ticket transfer initiated successfully 🔄",
      data: result,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 11. CLAIM TRANSFERRED TICKET CONTROLLER
// ==========================================
export const claimTransferredTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = requireActorId(req, res);
    if (actorId === null) return;

    const validatedBody = claimTransferredTicketSchema.parse(req.body);

    const data = await claimTransferredTicket(
      validatedBody.claimToken,
      actorId,
      validatedBody.attendeeInfo
    );

    return res.status(200).json({
      success: true,
      message: "Ticket claimed successfully 🎉",
      data,
    });
  } catch (error: any) {
    const msg: string = error?.message ?? "";
    if (msg.includes("Invalid") || msg.includes("expired")) {
      return res.status(400).json({ success: false, message: msg });
    }
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 12. SCAN TICKET CONTROLLER
// The service now enforces that the ticket belongs to the organizer's org.
// Cross-org scans return "not_found" (404) so we never leak token existence.
// ==========================================
export const scanTicketController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedBody = scanTicketSchema.parse(req.body);

    // ── 1. Authenticated user's org (from JWT / session middleware) ──
    const user = req.user as
      | { digitalId?: number; orgId?: number | null; role?: string }
      | undefined;

    if (!user?.orgId) {
      return res.status(403).json({
        success: false,
        status: "no_org",
        message: "Your account is not linked to an organization 🚫",
      });
    }

    // ── 2. Optional event scoping (from body or query) ──
    const requestedEventId =
      (req.body?.eventId ?? req.query?.eventId) !== undefined
        ? Number(req.body?.eventId ?? req.query?.eventId)
        : undefined;

    // ── 3. Call the org-scoped service ──
    const result = await scanTicket(
      validatedBody.ticketToken,
      user.orgId,
      Number.isFinite(requestedEventId) ? requestedEventId : undefined
    );

    // ── 4. Map result.status → HTTP status ──
    const httpStatus =
      result.status === "valid"        ? 200 :
      result.status === "duplicate"    ? 409 :
      result.status === "refunded"     ? 400 :
      result.status === "wrong_event"  ? 400 :
      result.status === "not_found"    ? 404 :
                                         400;

    return res.status(httpStatus).json(result);
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 13. UNASSIGN TICKET CONTROLLER
// ==========================================
export const unassignTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = requireActorId(req, res);
    if (actorId === null) return;

    const ticketId = Number(req.params.id);
    unassignTicketSchema.parse(req.body);

    const data = await unassignTicket(ticketId, actorId);
    return res.status(200).json({
      success: true,
      message: "Ticket unassigned successfully ↩️",
      data,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 14. GET TICKETS BY BUNDLE ID CONTROLLER
// ==========================================
export const getTicketsByBundleIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bundleIdParam = req.params.bundleId;
    const bundleId = Array.isArray(bundleIdParam) ? bundleIdParam[0] : bundleIdParam;
    const data = await getTicketsByBundleId(bundleId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 15. COUNT EVENT TICKETS CONTROLLER
// ==========================================
export const countEventTicketsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const totalTickets = await countEventTickets(eventId);

    return res.status(200).json({ success: true, eventId, totalTickets });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 16. COUNT SCANNED ATTENDEES CONTROLLER
// ==========================================
export const countScannedAttendeesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Number(req.params.eventId);
    const scannedCount = await countScannedAttendees(eventId);

    return res.status(200).json({ success: true, eventId, scannedCount });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 17. UPDATE TICKET HOLDER CONTROLLER
// NOTE: this should be admin-only in your routes.
// ==========================================
export const updateTicketHolderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = updateTicketHolderSchema.parse(req.body);

    const data = await updateTicketHolder(validatedBody.ticketId, validatedBody.newDigitalId);
    return res.status(200).json({
      success: true,
      message: "Ticket holder updated successfully 👤",
      data,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 18. RESET TICKET SCAN CONTROLLER
// NOTE: this should be admin-only in your routes.
// ==========================================
export const resetTicketScanController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Number(req.params.id);
    const data = await resetTicketScan(ticketId);

    return res.status(200).json({
      success: true,
      message: "Ticket scan status reset successfully 🔄",
      data,
    });
  } catch (error: any) {
    handleTicketError(error, res, next);
  }
};

// ==========================================
// 19. DELETE TICKET CONTROLLER
// NOTE: this should be admin-only in your routes.
// ==========================================
export const deleteTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Number(req.params.id);
    const success = await deleteTicket(ticketId);

    if (!success) {
      return res.status(404).json({ success: false, message: "Ticket not found or already deleted 🚫" });
    }

    return res.status(200).json({ success: true, message: "Ticket deleted successfully 🗑️" });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 20. GET UNASSIGNED USER TICKETS CONTROLLER
// ==========================================
export const getUnassignedUserTicketsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const digitalId = Number(req.params.digitalId);
    const data = await getUnassignedUserTickets(digitalId);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error: any) {
    next(error);
  }
};