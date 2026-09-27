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
    const ticketId = Number(req.params.id);
    const validatedBody = assignTicketSchema.parse(req.body);

    const data = await assignTicket(ticketId, validatedBody);
    return res.status(200).json({
      success: true,
      message: "Ticket assigned successfully ✅",
      data,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("Ticket not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ==========================================
// 9. BULK ASSIGN BUNDLE TICKETS CONTROLLER
// ==========================================
export const bulkAssignBundleTicketsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = bulkAssignBundleTicketsSchema.parse(req.body);

    const data = await bulkAssignBundleTickets(validatedBody.groupBundleId, validatedBody.assignments);
    return res.status(200).json({
      success: true,
      message: "Bundle tickets assigned successfully 📦✅",
      count: data.length,
      data,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 10. INITIATE TICKET TRANSFER CONTROLLER
// ==========================================
export const initiateTicketTransferController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = initiateTicketTransferSchema.parse(req.body);

    const result = await initiateTicketTransfer(validatedBody.ticketId, validatedBody.holderId);
    return res.status(200).json({
      success: true,
      message: "Ticket transfer initiated successfully 🔄",
      data: result,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes("Ticket not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ==========================================
// 11. CLAIM TRANSFERRED TICKET CONTROLLER
// ==========================================
export const claimTransferredTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = claimTransferredTicketSchema.parse(req.body);

    const data = await claimTransferredTicket(
      validatedBody.claimToken,
      validatedBody.newHolderDigitalId,
      validatedBody.attendeeInfo
    );

    return res.status(200).json({
      success: true,
      message: "Ticket claimed successfully 🎉",
      data,
    });
  } catch (error: any) {
    if (error.message && (error.message.includes("Invalid") || error.message.includes("expired"))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ==========================================
// 12. SCAN TICKET CONTROLLER
// ==========================================
export const scanTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedBody = scanTicketSchema.parse(req.body);

    const result = await scanTicket(validatedBody.ticketToken);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// ==========================================
// 13. UNASSIGN TICKET CONTROLLER
// ==========================================
export const unassignTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Number(req.params.id);
    const validatedBody = unassignTicketSchema.parse(req.body);

    const data = await unassignTicket(ticketId, validatedBody.ownerId);
    return res.status(200).json({
      success: true,
      message: "Ticket unassigned successfully ↩️",
      data,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes("Ticket not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
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
    next(error);
  }
};

// ==========================================
// 18. RESET TICKET SCAN CONTROLLER
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
    next(error);
  }
};

// ==========================================
// 19. DELETE TICKET CONTROLLER
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