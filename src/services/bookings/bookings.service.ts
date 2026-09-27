import db from "../../drizzle/db";
import { bookings, ticketTypes } from "../../drizzle/schema";
import { TInsertBooking, TSelectBooking } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Get All Bookings
export const getAllBookingsService = async (): Promise<TSelectBooking[]> => {
  const result = await db
    .select()
    .from(bookings)
    .execute();

  if (!result.length) {
    throw new Error("No bookings found");
  }

  return result;
};

// Get Booking By ID
export const getBookingByIdService = async (bookingId: number): Promise<TSelectBooking | null> => {
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingId, bookingId))
    .limit(1)
    .execute();

  if (!result.length) {
    throw new Error("Booking not found");
  }

  return result[0];
};

// Get Bookings By User National ID
export const getBookingsByUserNationalIdService = async (nationalId: number): Promise<TSelectBooking[]> => {
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.nationalId, nationalId))
    .execute();

  if (!result.length) {
    throw new Error(`No bookings found for national ID ${nationalId}`);
  }

  return result;
};

// Get Bookings By Event ID
export const getBookingsByEventIdService = async (eventId: number): Promise<TSelectBooking[]> => {
  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.eventId, eventId))
    .execute();

  if (!result.length) {
    throw new Error(`No bookings found for event ID ${eventId}`);
  }

  return result;
};

// Update Booking
export const updateBookingService = async (bookingId: number, updateData: { [key: string]: any }): Promise<string> => {
  const result = await db
    .update(bookings)
    .set(updateData)
    .where(eq(bookings.bookingId, bookingId))
    .returning();

  if (!result.length) {
    throw new Error("Booking not found for update");
  }

  return "Booking updated successfully";
};

// Delete Booking
export const deleteBookingService = async (bookingId: number): Promise<string> => {
  const result = await db
    .delete(bookings)
    .where(eq(bookings.bookingId, bookingId))
    .returning();

  if (!result.length) {
    throw new Error("Booking not found for deletion");
  }

  return "Booking deleted successfully";
};

// Create Booking
export const createBookingService = async (bookingData: TInsertBooking) => {
  const { ticketTypeId, quantity, totalAmount, nationalId, eventId } = bookingData;

  if (ticketTypeId === null || typeof ticketTypeId !== 'number') {
    throw new Error("Invalid or missing ticket type ID provided for booking.");
  }

  const ticketTypeResult = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.ticketTypeId, ticketTypeId))
    .limit(1)
    .execute();

  if (!ticketTypeResult.length) {
    throw new Error("Ticket type not found");
  }

  const ticket = ticketTypeResult[0];

  if (ticket.quantity === null || ticket.quantity < quantity) {
    throw new Error("Not enough tickets available");
  }

  const transaction = await db.transaction(async (tx) => {
    try {
      await tx.update(ticketTypes)
        .set({ quantity: ticket.quantity - quantity })
        .where(eq(ticketTypes.ticketTypeId, ticketTypeId));

      const newBooking = await tx.insert(bookings)
        .values({ ...bookingData, bookingStatus: "Pending" })
        .returning();

      return newBooking;
    } catch (error: any) {
      throw new Error(error.message || "Failed to create booking transaction");
    }
  });

  return transaction;
};

// Update Booking Status
export const updateBookingStatusService = async (bookingId: number, status: "Pending" | "Confirmed" | "Cancelled") => {
  const bookingQueryResult = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingId, bookingId))
    .limit(1)
    .execute();

  if (!bookingQueryResult.length) {
    throw new Error("Booking not found");
  }

  const booking = bookingQueryResult[0];

  if (booking.ticketTypeId === null || typeof booking.ticketTypeId !== 'number') {
    throw new Error("Booking has an invalid or missing ticket type ID.");
  }

  const bookedTicketTypeId: number = booking.ticketTypeId;

  const ticketTypeQueryResult = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.ticketTypeId, bookedTicketTypeId))
    .limit(1)
    .execute();

  if (!ticketTypeQueryResult.length) {
    throw new Error("Ticket type not found for the booking");
  }

  const ticket = ticketTypeQueryResult[0];

  await db.transaction(async (tx) => {
    if (status === "Confirmed") {
      if (ticket.quantity === null || ticket.quantity < booking.quantity) {
        throw new Error("Not enough tickets available to confirm this booking.");
      }

      await tx.update(ticketTypes)
        .set({ quantity: ticket.quantity - booking.quantity })
        .where(eq(ticketTypes.ticketTypeId, bookedTicketTypeId));
    }

    await tx.update(bookings)
      .set({ bookingStatus: status })
      .where(eq(bookings.bookingId, bookingId));
  });

  return { message: "Booking status updated successfully" };
};

// Cancel Booking
export const cancelBookingService = async (bookingId: number) => {
  const bookingQueryResult = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingId, bookingId))
    .limit(1)
    .execute();

  if (!bookingQueryResult.length) {
    throw new Error("Booking not found");
  }

  const booking = bookingQueryResult[0];

  if (booking.ticketTypeId === null || typeof booking.ticketTypeId !== 'number') {
    throw new Error("Booking has an invalid or missing ticket type ID.");
  }

  const bookedTicketTypeId: number = booking.ticketTypeId;

  const ticketTypeQueryResult = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.ticketTypeId, bookedTicketTypeId))
    .limit(1)
    .execute();

  if (!ticketTypeQueryResult.length) {
    throw new Error("Ticket type not found for the booking");
  }

  const ticket = ticketTypeQueryResult[0];

  await db.transaction(async (tx) => {
    const newQuantity = (ticket.quantity || 0) + booking.quantity;
    await tx.update(ticketTypes)
      .set({ quantity: newQuantity })
      .where(eq(ticketTypes.ticketTypeId, bookedTicketTypeId));

    await tx.update(bookings)
      .set({ bookingStatus: "Cancelled" })
      .where(eq(bookings.bookingId, bookingId));
  });

  return { message: "Booking cancelled and ticket quantity updated" };
};

// New function to get ticket type by name
export const getTicketTypeByName = async (name: string) => {
  const result = await db
    .select()
    .from(ticketTypes)
    .where(eq(ticketTypes.name, name)) // Assuming name is the field for ticket type
    .limit(1)
    .execute();

  if (!result.length) {
    throw new Error("Ticket type not found");
  }

  return result[0]; // Return the first matching ticket type
};