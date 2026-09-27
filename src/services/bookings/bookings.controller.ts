import { Request, Response } from "express";
import {
  createBookingService,
  updateBookingStatusService,
  cancelBookingService,
  getAllBookingsService,
  getBookingByIdService,
  getBookingsByUserNationalIdService,
  getBookingsByEventIdService,
  updateBookingService,
  deleteBookingService,
  getTicketTypeByName, // ← now imported directly
} from "./bookings.service";
import { TInsertBooking } from "../../drizzle/schema";

// -----------------------------------------------------------------------------
// 📚 GETTERS
// -----------------------------------------------------------------------------

// Get all bookings
export const getAllBookings = async (req: Request, res: Response) => {
  try {
    const allBookings = await getAllBookingsService();
    if (!allBookings?.length) {
      res.status(404).json({ message: "🔍 No bookings found" }); return;
    }
    res.status(200).json(allBookings);
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to retrieve bookings"}` });
  }
};

// Get booking by ID
export const getBookingById = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.id);
  if (Number.isNaN(bookingId)) {
    res.status(400).json({ error: "🚫 Invalid booking ID" });return;
  }

  try {
    const booking = await getBookingByIdService(bookingId);
    if (!booking) {
     res.status(404).json({ message: "🔍 Booking not found" }); return;
    }
    res.status(200).json(booking);
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to retrieve booking"}` });
  }
};

// Get bookings by User National ID
export const getBookingsByUserNationalId = async (req: Request, res: Response) => {
  const nationalId = Number(req.params.nationalId);
  if (Number.isNaN(nationalId)) {
     res.status(400).json({ error: "🚫 Invalid national ID" });return;
  }

  try {
    const bookings = await getBookingsByUserNationalIdService(nationalId);
    if (!bookings?.length) {
     res.status(404).json({ message: `🔍 No bookings found for national ID ${nationalId}` }); return; 
    }
    res.status(200).json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || `Failed to retrieve bookings for national ID ${nationalId}`}` });
  }
};

// Get bookings by Event ID
export const getBookingsByEventId = async (req: Request, res: Response) => {
  const eventId = Number(req.params.eventId);
  if (Number.isNaN(eventId)) {
     res.status(400).json({ error: "🚫 Invalid event ID" });return;
  }

  try {
    const bookings = await getBookingsByEventIdService(eventId);
    if (!bookings?.length) {
       res.status(404).json({ message: `🔍 No bookings found for event ID ${eventId}` });return;
    }
    res.status(200).json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || `Failed to retrieve bookings for event ID ${eventId}`}` });
  }
};

// -----------------------------------------------------------------------------
// ✍️ WRITERS
// -----------------------------------------------------------------------------

// Create new booking
export const createBooking = async (req: Request, res: Response) => {
  const { nationalId, eventId, quantity, totalAmount, ticketTypeName } = req.body;

  // Basic presence validation
  if (!nationalId || !eventId || !quantity || !totalAmount || !ticketTypeName) {
    res.status(400).json({
      error: "⚠️ Essential fields (nationalId, eventId, quantity, totalAmount, ticketTypeName) are required",
    }); return;
  }

  // Type coercion/validation
  const parsedNationalId = Number(nationalId);
  const parsedEventId = Number(eventId);
  const parsedQuantity = Number(quantity);
  const parsedTotalAmount = Number(totalAmount);

  if ([parsedNationalId, parsedEventId, parsedQuantity].some(Number.isNaN) || Number.isNaN(parsedTotalAmount)) {
     res.status(400).json({ error: "🚫 Invalid data types for eventId, quantity, totalAmount, or nationalId" });return;
  }

  try {
    // 🔍 Resolve ticket type via service
    const ticketType = await getTicketTypeByName(ticketTypeName);
    if (!ticketType) {
       res.status(404).json({ error: "🚫 Ticket type not found!" });return;
    }

    const newBooking: TInsertBooking = {
      nationalId: parsedNationalId,
      eventId: parsedEventId,
      quantity: parsedQuantity,
      totalAmount: parsedTotalAmount.toString(), // drizzle schema expects string
      ticketTypeId: ticketType.ticketTypeId,
    };

    const result = await createBookingService(newBooking);
    res.status(201).json({ message: "✅ Booking created successfully", booking: result });
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to create booking"}` });
  }
};

// Update booking
export const updateBooking = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.id);
  if (Number.isNaN(bookingId)) {
   res.status(400).json({ error: "🚫 Invalid booking ID" }); return;
  }

  const updateData: Record<string, any> = {};

  for (const key in req.body) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      let value: any = req.body[key];

      switch (key) {
        case "nationalId":
        case "eventId":
        case "quantity":
        case "ticketTypeId":
          value = Number(value);
          if (Number.isNaN(value)) {
             res.status(400).json({ error: `🚫 Invalid number format for ${key}` });return;
          }
          break;
        case "totalAmount":
          value = Number(value);
          if (Number.isNaN(value)) {
             res.status(400).json({ error: `🚫 Invalid number format for ${key}` });return;
          }
          value = value.toString();
          break;
      }

      updateData[key] = value;
    }
  }

  if (!Object.keys(updateData).length) {
     res.status(400).json({ error: "📝 No fields provided for update" });return;
  }

  try {
    const result = await updateBookingService(bookingId, updateData);
    res.status(200).json({ message: `🔄 ${result}` });
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to update booking"}` });
  }
};

// Delete booking
export const deleteBooking = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.id);
  if (Number.isNaN(bookingId)) {
     res.status(400).json({ error: "🚫 Invalid booking ID" });return;
  }

  try {
    const result = await deleteBookingService(bookingId);
    res.status(200).json({ message: `🗑️ ${result}` });
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to delete booking"}` });
  }
};

// -----------------------------------------------------------------------------
// 🔄 STATUS HELPERS
// -----------------------------------------------------------------------------

// Update Booking Status
export const updateBookingStatus = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.id);
  const { status } = req.body;

  if (Number.isNaN(bookingId)) {
   res.status(400).json({ error: "🚫 Invalid booking ID" }); return; 
  }

  const validStatuses = ["Pending", "Confirmed", "Cancelled"] as const;
  if (!status || !validStatuses.includes(status)) {
   res.status(400).json({
      error: `🚫 Invalid or missing status. Must be one of: ${validStatuses.join(", ")}`,
    });
    return;
  }

  try {
    const result = await updateBookingStatusService(bookingId, status);
    res.status(200).json({ message: `✅ ${result.message}` });
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to update booking status"}` });
  }
};

// Cancel Booking
export const cancelBooking = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.id);
  if (Number.isNaN(bookingId)) {
     res.status(400).json({ error: "🚫 Invalid booking ID" });
     return;
  }

  try {
    const result = await cancelBookingService(bookingId);
    res.status(200).json({ message: `✅ ${result}` });
  } catch (error: any) {
    res.status(500).json({ error: `🚫 ${error.message || "Failed to cancel booking"}` });
  }
};

// -----------------------------------------------------------------------------
// 📝 NOTE: Controller now aligns with the updated service layer.
// -----------------------------------------------------------------------------
