import { eq, inArray, desc, ilike, and } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  events,
  bookings,
  TInsertEvent,
  TSelectEvent,
  TSelectBooking,
  ticketTypes,
} from "../../drizzle/schema";
import { processAndEmailTicketService } from "../EmailTicket/emailTicket.Service";

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

// 8. ➕ Create a new event
export const createEventService = async (
  eventData: TInsertEvent
): Promise<{ success: boolean; message: string; data?: TSelectEvent }> => {
  const [newEvent] = await db.insert(events).values(eventData).returning();
  return { success: true, message: "Event created successfully ✅", data: newEvent };
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
export interface CreateBookingPayload {
  eventId: number;
  ticketTypeId: number;
  ticketTypeName?: string; // Optional since the service fetches it
  quantity: number;
  digitalId?: number;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  idempotencyKey?: string;
}


export const createBookingService = async (payload: CreateBookingPayload) => {
  // 1. Fetch ticket type by ticketTypeId and ensure it matches the eventId
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

  // 2. Calculate remaining stock using schema fields (total quantity - sold count)
  const currentSold = ticketTier.sold ?? 0;
  const remainingStock = ticketTier.quantity - currentSold;

  if (remainingStock < payload.quantity) {
    return {
      success: false,
      message: `Insufficient tickets available. Remaining stock: ${remainingStock}`,
    };
  }

  // 3. Automatically calculate total amount server-side
  const unitPrice = Number(ticketTier.price);
  const calculatedTotal = (unitPrice * payload.quantity).toFixed(2);

  // 4. Insert booking with auto-fetched name and auto-computed details
  const [newBooking] = await db
    .insert(bookings)
    .values({
      eventId: payload.eventId,
      ticketTypeId: ticketTier.ticketTypeId,
      ticketTypeName: ticketTier.name,
      quantity: payload.quantity,
      totalAmount: calculatedTotal,
      digitalId: payload.digitalId ?? null,
      guestName: payload.guestName ?? null,
      guestEmail: payload.guestEmail ?? null,
      guestPhone: payload.guestPhone ?? null,
      bookingStatus: "Pending",
      idempotencyKey: payload.idempotencyKey ?? null,
    })
    .returning();

  // 5. Update the sold count on the ticket type table
  await db
    .update(ticketTypes)
    .set({ sold: currentSold + payload.quantity })
    .where(eq(ticketTypes.ticketTypeId, ticketTier.ticketTypeId));

  return {
    success: true,
    data: newBooking,
  };
};

// 18. 🔄 Update booking status (with safety checks and automation trigger)
export const updateBookingStatusService = async (
  bookingId: number,
  bookingStatus: "Pending" | "Confirmed" | "Cancelled" | "Refunded"
): Promise<string> => {
  // 1. Verify the booking exists
  const [existingBooking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingId, bookingId));

  if (!existingBooking) {
    throw new Error(`Booking with ID ${bookingId} not found 🔍`);
  }

  // 2. Perform the update
  await db
    .update(bookings)
    .set({ bookingStatus, updatedAt: new Date() })
    .where(eq(bookings.bookingId, bookingId));

  // 3. Optional Bonus: If manually confirmed and it wasn't confirmed before, send tickets out!
  if (bookingStatus === "Confirmed" && existingBooking.bookingStatus !== "Confirmed") {
    try {
      await processAndEmailTicketService(bookingId);
      console.log(`📨 Ticket & Email dispatched successfully for manually confirmed booking ID: ${bookingId}`);
    } catch (emailError) {
      console.error("❌ Failed to process ticket email upon manual status confirmation:", emailError);
    }
  }

  return `Booking status updated to ${bookingStatus} successfully 🔄`;
};

// 19. ❌ Cancel booking
export const cancelBookingService = async (bookingId: number): Promise<string> => {
  await db
    .update(bookings)
    .set({ bookingStatus: "Cancelled", updatedAt: new Date() })
    .where(eq(bookings.bookingId, bookingId));
  
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