import { eq, inArray, desc, ilike, and, sql, gte } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  events,
  bookings,
  TInsertEvent,
  TSelectEvent,
  TSelectBooking,
  ticketTypes,
  organizerVerifications,
} from "../../drizzle/schema";
import { processAndEmailTicketService } from "../EmailTicket/emailTicket.Service";
import { getVerificationByUserId } from "../verification/verification.service";
import { generateTicketsForBooking } from "../tickets/ticket.service";

// Export types for controllers and validators
export type { TInsertEvent, TSelectEvent, TSelectBooking };

// ==========================================
// PART 1: EVENTS SERVICES (1 - 11)
// ==========================================

// 1. 🔍 Get all events
export const getAllEventsService = async (): Promise<TSelectEvent[]> => {
  return await db.query.events.findMany({
    orderBy: [desc(events.createdAt)],
    with: {
      venue: true,
      organization: true,
    },
  });
};

// 2. 🔍 Get event by ID
export const getEventByIdService = async (
  eventId: number
): Promise<TSelectEvent | undefined> => {
  return await db.query.events.findFirst({
    where: eq(events.eventId, eventId),
    with: {
      venue: true,
      organization: true,
    },
  });
};

// 3. 🔍 Get events by title (case-insensitive, partial match)
export const getEventsByTitleService = async (
  title: string
): Promise<TSelectEvent[]> => {
  return await db.query.events.findMany({
    where: ilike(events.title, `%${title}%`),
    with: {
      venue: true,
    },
  });
};

// 4. 🔍 Get events by category (case-insensitive, partial match)
export const getEventsByCategoryService = async (
  category: string
): Promise<TSelectEvent[]> => {
  return await db.query.events.findMany({
    where: ilike(events.category, `%${category}%`),
    with: {
      venue: true,
    },
  });
};

// 5. 🏢 Get events by Organization (tenant) ID
export const getEventsByOrganizationService = async (
  orgId: number
): Promise<TSelectEvent[]> => {
  return await db.query.events.findMany({
    where: eq(events.orgId, orgId),
    orderBy: [desc(events.createdAt)],
    with: {
      venue: true,
    },
  });
};

// 6. ⏳ Get upcoming events
export const getUpcomingEventsService = async (): Promise<TSelectEvent[]> => {
  return await db.query.events.findMany({
    where: eq(events.status, "upcoming"),
    orderBy: [desc(events.date)],
    with: {
      venue: true,
    },
  });
};

// 7. 👤 Get events by user's digitalId (based on bookings)
export const getEventsByUserIdService = async (
  digitalId: number
): Promise<TSelectEvent[]> => {
  const userBookings = await db.query.bookings.findMany({
    where: eq(bookings.digitalId, digitalId),
    orderBy: [desc(bookings.createdAt)],
  });

  const eventIds = userBookings.map((b) => b.eventId).filter((id): id is number => id !== null);

  if (eventIds.length === 0) return [];

  return await db.query.events.findMany({
    where: inArray(events.eventId, eventIds),
    orderBy: [desc(events.createdAt)],
    with: {
      venue: true,
    },
  });
};

// 8. ➕ Create a new event with Organization & User Digital ID verification check
export const createEventService = async (
  eventData: TInsertEvent
): Promise<{ success: boolean; message: string; data?: TSelectEvent }> => {
  const orgId = eventData.orgId;

  if (!orgId) {
    return { 
      success: false, 
      message: "Organization ID is missing. Cannot verify event organizer ❌" 
    };
  }

  // 1. Fetch the verification record linked to this organization, 
  // ensuring we pull in the user relation to check their digitalId
  const verificationRecord = await db.query.organizerVerifications.findFirst({
    where: eq(organizerVerifications.orgId, orgId),
    with: {
      user: true, // This brings in the user details including their digitalId
    },
  });

  // 2. Check if the verification record exists, is approved, and has a valid user digitalId
  if (!verificationRecord || verificationRecord.status !== "approved" || !verificationRecord.user?.digitalId) {
    return { 
      success: false, 
      message: "Event creation denied ❌. The event organizer's digital ID is either unverified or pending approval." 
    };
  }

  // Optional: You can explicitly log or verify the digitalId here if needed
  const organizerDigitalId = verificationRecord.user.digitalId;
  console.log(`Verified organizer digital ID: ${organizerDigitalId} posting event...`);

  // 3. If everything checks out, proceed with creating the event
  const [newEvent] = await db.insert(events).values(eventData).returning();
  
  return { 
    success: true, 
    message: "Event created successfully ✅", 
    data: newEvent 
  };
};

// 9. 🔄 Update event details
export const updateEventService = async (
  eventId: number,
  eventData: Partial<TInsertEvent>
): Promise<string> => {
  await db
    .update(events)
    .set({ ...eventData, updatedAt: new Date() })
    .where(eq(events.eventId, eventId));
  return "Event updated successfully 🔄";
};

// 10. 🚦 Update event status
export const updateEventStatusService = async (
  eventId: number,
  status: "upcoming" | "in_progress" | "ended" | "cancelled"
): Promise<string> => {
  await db
    .update(events)
    .set({ status, updatedAt: new Date() })
    .where(eq(events.eventId, eventId));
  return `Event status updated to ${status} successfully 🚦`;
};

// 11. 🗑️ Delete event
export const deleteEventService = async (
  eventId: number
): Promise<string> => {
  await db.delete(events).where(eq(events.eventId, eventId));
  return "Event deleted successfully ❌";
};

export const getEventBySlug = async (slug: string) => {
  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return { success: false, message: "Event not found", data: null };
    }

    return { success: true, message: "Event retrieved successfully", data: event };
  } catch (error) {
    console.error("Error fetching event by slug:", error);
    throw new Error("Failed to fetch event");
  }
};


// ==========================================
// PART 2: BOOKINGS SERVICES (12 - 20)
// ==========================================


// How long an UNPAID booking reserves tickets (without deducting them)
const HOLD_MINUTES = 15;

// 12. 📋 Get all bookings
export const getAllBookingsService = async (): Promise<TSelectBooking[]> => {
  return await db.query.bookings.findMany({
    orderBy: [desc(bookings.createdAt)],
    with: {
      user: true,
      event: true,
      payments: true,
      tickets: true,
    },
  });
};

// 13. 🔍 Get booking by ID
export const getBookingByIdService = async (
  bookingId: number
): Promise<TSelectBooking | undefined> => {
  return await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
    with: {
      user: true,
      event: true,
      payments: true,
      tickets: true,
    },
  });
};

// 14. 👤 Get bookings by User (digitalId)
export const getBookingsByUserIdService = async (
  digitalId: number
): Promise<TSelectBooking[]> => {
  return await db.query.bookings.findMany({
    where: eq(bookings.digitalId, digitalId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      event: {
        with: {
          venue: true,
        },
      },
      payments: true,
    },
  });
};

// 15. 🎟️ Get bookings by Event ID
export const getBookingsByEventIdService = async (
  eventId: number
): Promise<TSelectBooking[]> => {
  return await db.query.bookings.findMany({
    where: eq(bookings.eventId, eventId),
    orderBy: [desc(bookings.createdAt)],
    with: {
      user: true,
      payments: true,
    },
  });
};

// 16. ⚡ Get recent bookings
export const getRecentBookingsService = async (limitNum: number = 10): Promise<TSelectBooking[]> => {
  return await db.query.bookings.findMany({
    limit: limitNum,
    orderBy: [desc(bookings.createdAt)],
    with: {
      user: true,
      event: true,
    },
  });
};

// 17. ➕ Create a new booking
export interface BookingAttendee {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CreateBookingPayload {
  eventId: number;
  ticketTypeId: number;
  ticketTypeName?: string;
  quantity: number;

  // Logged-in user / payer
  digitalId?: number;

  // Payer / primary attendee
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;

  // Individual attendee details for each ticket
  attendees?: BookingAttendee[];

  // Prevent duplicate bookings
  idempotencyKey?: string;
}

// 🔒 Tickets held by unpaid bookings that are still inside the hold window
const getReservedCount = async (ticketTypeId: number): Promise<number> => {
  const since = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
  const [row] = await db
    .select({ reserved: sql<number>`COALESCE(SUM(${bookings.quantity}), 0)` })
    .from(bookings)
    .where(
      and(
        eq(bookings.ticketTypeId, ticketTypeId),
        eq(bookings.bookingStatus, "Pending"),
        gte(bookings.createdAt, since)
      )
    );
  return Number(row?.reserved ?? 0);
};

export const createBookingService = async (payload: CreateBookingPayload) => {
  if (!Number.isInteger(payload.quantity) || payload.quantity < 1) {
    return {
      success: false,
      message: "Quantity must be a whole number of at least 1",
    };
  }

  // 1. Fetch ticket type and make sure it belongs to the event
  const [ticketTier] = await db
    .select()
    .from(ticketTypes)
    .where(
      and(
        eq(ticketTypes.ticketTypeId, payload.ticketTypeId),
        eq(ticketTypes.eventId, payload.eventId)
      )
    );

  if (!ticketTier) {
    return {
      success: false,
      message: `Ticket type ID '${payload.ticketTypeId}' was not found for this event 🚫`,
    };
  }

  // 2. Remaining = total - already PAID (sold) - held by other unpaid bookings
  const reserved = await getReservedCount(ticketTier.ticketTypeId);

  const remainingStock =
    ticketTier.quantity - (ticketTier.sold ?? 0) - reserved;

  if (remainingStock < payload.quantity) {
    return {
      success: false,
      message: `Insufficient tickets available. Remaining stock: ${Math.max(
        remainingStock,
        0
      )}`,
    };
  }

  // 3. Total is always calculated on the server
  const calculatedTotal = (
    Number(ticketTier.price) * payload.quantity
  ).toFixed(2);

  // 4. Save attendee details with the booking
  //
  // Example:
  // [
  //   {
  //     name: "Gakenye Ndiritu",
  //     email: "gakenye@gmail.com",
  //     phone: "0712345678"
  //   },
  //   {
  //     name: "Brian Kimurgor",
  //     email: "brian@gmail.com",
  //     phone: "0723456789"
  //   }
  // ]
  //
  // If no attendee details are provided, attendees will be null
  // and ticket generation will fall back to the payer details.

  const attendees =
    payload.attendees && payload.attendees.length > 0
      ? payload.attendees
      : null;

  // 5. Insert the booking as Pending
  const [newBooking] = await db
    .insert(bookings)
    .values({
      eventId: payload.eventId,
      ticketTypeId: ticketTier.ticketTypeId,
      ticketTypeName: ticketTier.name,
      quantity: payload.quantity,
      totalAmount: calculatedTotal,

      // Payer / primary customer
      digitalId: payload.digitalId ?? null,
      guestName: payload.guestName ?? null,
      guestEmail: payload.guestEmail ?? null,
      guestPhone: payload.guestPhone ?? null,

      // Individual attendees
      attendees,

      bookingStatus: "Pending",
      idempotencyKey: payload.idempotencyKey ?? null,
    })
    .returning();

  // ❌ REMOVED: the "sold" update.
  // Stock is only deducted once payment completes.

  return {
    success: true,
    data: newBooking,
  };
};

// ✅ Called when a payment completes. Safe to call more than once.
// Deducts stock, marks the booking Confirmed, generates ALL tickets, emails them to the payer.
export const confirmBookingAfterPayment = async (bookingId: number) => {
  const { alreadyConfirmed } = await db.transaction(async (tx) => {
    // Lock the row so two callbacks can't both deduct stock
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.bookingId, bookingId))
      .for("update");

    if (!booking) throw new Error(`Booking ${bookingId} not found 🔍`);
    if (booking.bookingStatus === "Confirmed") return { alreadyConfirmed: true };

    const [tier] = await tx
      .update(ticketTypes)
      .set({ sold: sql`COALESCE(${ticketTypes.sold}, 0) + ${booking.quantity}` })
      .where(eq(ticketTypes.ticketTypeId, booking.ticketTypeId!))
      .returning();

    // The customer already paid, so we honour it, but flag it for you
    if (tier && (tier.sold ?? 0) > tier.quantity) {
      console.warn(`⚠️ Ticket type ${tier.ticketTypeId} oversold after booking ${bookingId}`);
    }

    await tx
      .update(bookings)
      .set({ bookingStatus: "Confirmed", updatedAt: new Date() })
      .where(eq(bookings.bookingId, bookingId));

    return { alreadyConfirmed: false };
  });

  // Generates the tickets and emails them (outside the transaction)
  if (!alreadyConfirmed) await generateTicketsForBooking(bookingId);
  return { alreadyConfirmed };
};

// 🔙 Gives tickets back if a PAID booking is cancelled or refunded
const releaseStockIfConfirmed = async (bookingId: number, previousStatus: string) => {
  if (previousStatus !== "Confirmed") return;
  const [booking] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
  if (!booking?.ticketTypeId) return;
  await db
    .update(ticketTypes)
    .set({ sold: sql`GREATEST(COALESCE(${ticketTypes.sold}, 0) - ${booking.quantity}, 0)` })
    .where(eq(ticketTypes.ticketTypeId, booking.ticketTypeId));
};

// 18. 🔄 Update booking status
export const updateBookingStatusService = async (
  bookingId: number,
  bookingStatus: "Pending" | "Confirmed" | "Cancelled" | "Refunded"
): Promise<string> => {
  const [existing] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
  if (!existing) throw new Error(`Booking with ID ${bookingId} not found 🔍`);

  if (bookingStatus === "Confirmed") {
    await confirmBookingAfterPayment(bookingId); // deducts stock + makes tickets + emails
  } else {
    await db
      .update(bookings)
      .set({ bookingStatus, updatedAt: new Date() })
      .where(eq(bookings.bookingId, bookingId));

    if (bookingStatus === "Cancelled" || bookingStatus === "Refunded") {
      await releaseStockIfConfirmed(bookingId, existing.bookingStatus);
    }
  }

  return `Booking status updated to ${bookingStatus} successfully 🔄`;
};

// 19. ❌ Cancel booking
export const cancelBookingService = async (bookingId: number): Promise<string> => {
  const [existing] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
  if (!existing) throw new Error(`Booking with ID ${bookingId} not found 🔍`);

  await db
    .update(bookings)
    .set({ bookingStatus: "Cancelled", updatedAt: new Date() })
    .where(eq(bookings.bookingId, bookingId));

  await releaseStockIfConfirmed(bookingId, existing.bookingStatus);
  return "Booking cancelled successfully ❌";
};

// 20. 📊 Get Event Booking Statistics
export const getEventBookingStatsService = async (eventId: number) => {
  const eventBookings = await db.query.bookings.findMany({
    where: eq(bookings.eventId, eventId),
  });

  const totalBookingsCount = eventBookings.length;
  const confirmedBookings = eventBookings.filter((b) => b.bookingStatus === "Confirmed");
  const totalTicketsSold = confirmedBookings.reduce((acc, b) => acc + b.quantity, 0);
  const totalRevenue = confirmedBookings.reduce((acc, b) => acc + Number(b.totalAmount), 0);

  return {
    eventId,
    totalBookingsCount,
    totalTicketsSold,
    totalRevenue: totalRevenue.toFixed(2),
  };
};