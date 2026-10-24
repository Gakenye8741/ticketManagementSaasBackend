import { eq, inArray, desc, ilike, and, sql, gte } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  events,
  bookings,
  bookingItems,
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

  const verificationRecord = await db.query.organizerVerifications.findFirst({
    where: eq(organizerVerifications.orgId, orgId),
    with: {
      user: true,
    },
  });

  if (!verificationRecord || verificationRecord.status !== "approved" || !verificationRecord.user?.digitalId) {
    return { 
      success: false, 
      message: "Event creation denied ❌. The event organizer's digital ID is either unverified or pending approval." 
    };
  }

  const organizerDigitalId = verificationRecord.user.digitalId;
  console.log(`Verified organizer digital ID: ${organizerDigitalId} posting event...`);

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
      items: true,
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
      items: true,
    },
  });
};

/* ==========================================
 * 14. 👤 Get bookings by User (digitalId)
 * ========================================== */

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
      tickets: true,
      items: true,
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
      items: true,
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
      items: true,
    },
  });
};

// 17. ➕ Create a new booking
export interface BookingAttendee {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

// NEW — one row of the cart (one ticket type + how many of it)
export interface BookingLine {
  ticketTypeId: number;
  quantity: number;
}

export interface CreateBookingPayload {
  eventId: number;

  // NEW — multi-ticket-type cart. If provided, `ticketTypeId`/`quantity` are ignored.
  lines?: BookingLine[];

  // Legacy single-type fields (still supported if `lines` is not provided)
  ticketTypeId?: number;
  ticketTypeName?: string;
  quantity?: number;

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

// 🔒 Tickets held by unpaid bookings that are still inside the hold window.
// Uses relations (no joins). Sums BOTH legacy `bookings.quantity`
// and new `bookingItems.quantity`.
const getReservedCount = async (ticketTypeId: number): Promise<number> => {
  const since = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);

  // Legacy single-type bookings
  const legacyBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.ticketTypeId, ticketTypeId),
      eq(bookings.bookingStatus, "Pending"),
      gte(bookings.createdAt, since)
    ),
    columns: { quantity: true },
  });

  const legacyReserved = legacyBookings.reduce(
    (sum, b) => sum + Number(b.quantity ?? 0),
    0
  );

  // New multi-type bookings — query items WITH their booking relation
  const pendingItems = await db.query.bookingItems.findMany({
    where: eq(bookingItems.ticketTypeId, ticketTypeId),
    with: {
      booking: {
        columns: {
          bookingId: true,
          bookingStatus: true,
          createdAt: true,
        },
      },
    },
  });

  const itemsReserved = pendingItems.reduce((sum, item) => {
    const b = item.booking;
    if (!b) return sum;
    if (b.bookingStatus !== "Pending") return sum;
    if (new Date(b.createdAt) < since) return sum;
    return sum + Number(item.quantity ?? 0);
  }, 0);

  return legacyReserved + itemsReserved;
};

export const createBookingService = async (payload: CreateBookingPayload) => {
  // ---- 1. Normalize the cart ----
  // `lines` wins if provided; otherwise fall back to the legacy single-type fields.
  const rawLines: BookingLine[] =
    payload.lines && payload.lines.length > 0
      ? payload.lines
      : payload.ticketTypeId != null && payload.quantity != null
        ? [{ ticketTypeId: payload.ticketTypeId, quantity: payload.quantity }]
        : [];

  if (rawLines.length === 0) {
    return { success: false, message: "No tickets selected for this booking" };
  }

  // Validate quantities
  for (const line of rawLines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return {
        success: false,
        message: "Quantity must be a whole number of at least 1",
      };
    }
  }

  // Merge duplicate ticketTypeIds (e.g. Comrade added twice)
  const merged = new Map<number, number>();
  for (const line of rawLines) {
    merged.set(line.ticketTypeId, (merged.get(line.ticketTypeId) ?? 0) + line.quantity);
  }
  const lines: BookingLine[] = [...merged.entries()].map(
    ([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })
  );

  // ---- 2. Load and validate every ticket type ----
  const ticketTypeIds = lines.map((l) => l.ticketTypeId);
  const tiers = await db
    .select()
    .from(ticketTypes)
    .where(
      and(
        inArray(ticketTypes.ticketTypeId, ticketTypeIds),
        eq(ticketTypes.eventId, payload.eventId)
      )
    );

  const tierById = new Map(tiers.map((t) => [t.ticketTypeId, t]));

  for (const line of lines) {
    if (!tierById.has(line.ticketTypeId)) {
      return {
        success: false,
        message: `Ticket type ID '${line.ticketTypeId}' was not found for this event 🚫`,
      };
    }
  }

  // ---- 3. Stock check for each line ----
  for (const line of lines) {
    const tier = tierById.get(line.ticketTypeId)!;
    const reserved = await getReservedCount(tier.ticketTypeId);
    const remainingStock = tier.quantity - (tier.sold ?? 0) - reserved;

    if (remainingStock < line.quantity) {
      return {
        success: false,
        message: `Insufficient tickets available for "${tier.name}". Remaining stock: ${Math.max(remainingStock, 0)}`,
      };
    }
  }

  // ---- 4. Compute totals ----
  const itemsToInsert = lines.map((line) => {
    const tier = tierById.get(line.ticketTypeId)!;
    const unitPrice = Number(tier.price);
    const lineTotal = Number((unitPrice * line.quantity).toFixed(2));
    return {
      ticketTypeId: tier.ticketTypeId,
      ticketTypeName: tier.name,
      unitPrice: unitPrice.toFixed(2),
      quantity: line.quantity,
      lineTotal: lineTotal.toFixed(2),
    };
  });

  const calculatedTotal = itemsToInsert
    .reduce((sum, item) => sum + Number(item.lineTotal), 0)
    .toFixed(2);

  const totalQuantity = itemsToInsert.reduce((sum, item) => sum + item.quantity, 0);

  // ---- 5. Attendees ----
  const attendees =
    payload.attendees && payload.attendees.length > 0
      ? payload.attendees
      : null;

  // ---- 6. Insert header + items in a single transaction ----
  const newBooking = await db.transaction(async (tx) => {
    const [header] = await tx
      .insert(bookings)
      .values({
        eventId: payload.eventId,
        // Legacy columns point to the first line so old code keeps working
        ticketTypeId: itemsToInsert[0].ticketTypeId,
        ticketTypeName: itemsToInsert[0].ticketTypeName,
        quantity: totalQuantity,
        isBundle: itemsToInsert.length > 1,
        totalAmount: calculatedTotal,

        digitalId: payload.digitalId ?? null,
        guestName: payload.guestName ?? null,
        guestEmail: payload.guestEmail ?? null,
        guestPhone: payload.guestPhone ?? null,

        attendees,

        bookingStatus: "Pending",
        idempotencyKey: payload.idempotencyKey ?? null,
      })
      .returning();

    await tx.insert(bookingItems).values(
      itemsToInsert.map((item) => ({ ...item, bookingId: header.bookingId }))
    );

    return header;
  });

  return {
    success: true,
    data: newBooking,
    items: itemsToInsert,
  };
};

// ✅ Called when a payment completes. Safe to call more than once.
// Deducts stock for EACH ticket line, marks the booking Confirmed,
// generates ALL tickets, and emails them to the payer.
export const confirmBookingAfterPayment = async (bookingId: number) => {
  const { alreadyConfirmed } = await db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.bookingId, bookingId))
      .for("update");

    if (!booking) throw new Error(`Booking ${bookingId} not found 🔍`);
    if (booking.bookingStatus === "Confirmed") return { alreadyConfirmed: true };

    // Prefer items; fall back to legacy single line
    const items = await tx
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const lines =
      items.length > 0
        ? items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity }))
        : booking.ticketTypeId != null
          ? [{ ticketTypeId: booking.ticketTypeId, quantity: booking.quantity }]
          : [];

    if (lines.length === 0) {
      throw new Error(`Booking ${bookingId} has no ticket lines 🔍`);
    }

    // Deduct stock per line
    for (const line of lines) {
      const [tier] = await tx
        .update(ticketTypes)
        .set({ sold: sql`COALESCE(${ticketTypes.sold}, 0) + ${line.quantity}` })
        .where(eq(ticketTypes.ticketTypeId, line.ticketTypeId))
        .returning();

      if (tier && (tier.sold ?? 0) > tier.quantity) {
        console.warn(
          `⚠️ Ticket type ${tier.ticketTypeId} oversold after booking ${bookingId}`
        );
      }
    }

    await tx
      .update(bookings)
      .set({ bookingStatus: "Confirmed", updatedAt: new Date() })
      .where(eq(bookings.bookingId, bookingId));

    return { alreadyConfirmed: false };
  });

  if (!alreadyConfirmed) await generateTicketsForBooking(bookingId);
  return { alreadyConfirmed };
};

// 🔙 Gives tickets back if a PAID booking is cancelled or refunded
const releaseStockIfConfirmed = async (bookingId: number, previousStatus: string) => {
  if (previousStatus !== "Confirmed") return;

  const items = await db
    .select()
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId));

  if (items.length > 0) {
    for (const item of items) {
      await db
        .update(ticketTypes)
        .set({
          sold: sql`GREATEST(COALESCE(${ticketTypes.sold}, 0) - ${item.quantity}, 0)`,
        })
        .where(eq(ticketTypes.ticketTypeId, item.ticketTypeId));
    }
    return;
  }

  // Legacy fallback
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingId, bookingId));

  if (!booking?.ticketTypeId) return;

  await db
    .update(ticketTypes)
    .set({
      sold: sql`GREATEST(COALESCE(${ticketTypes.sold}, 0) - ${booking.quantity}, 0)`,
    })
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
    await confirmBookingAfterPayment(bookingId);
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