import { RequestHandler } from "express";
import {
  getAllEventsService,
  getEventByIdService,
  getEventsByTitleService,
  getEventsByCategoryService,
  getEventsByOrganizationService,
  getUpcomingEventsService,
  getEventsByUserIdService,
  createEventService,
  updateEventService,
  updateEventStatusService,
  deleteEventService,
  getAllBookingsService,
  getBookingByIdService,
  getBookingsByUserIdService,
  getBookingsByEventIdService,
  getRecentBookingsService,
  createBookingService,
  updateBookingStatusService,
  cancelBookingService,
  getEventBookingStatsService,
  CreateBookingPayload,
} from "./eventBooking.service";
import {
  createEventValidator,
  updateEventValidator,
  updateEventStatusValidator,
  createBookingValidator,
  updateBookingStatusValidator,
} from "../../validators/eventBooking.validator";

// ==========================================================
// 📅 EVENT CONTROLLERS (1 - 11)
// ==========================================================

// 1. Get all events
export const getAllEvents: RequestHandler = async (req, res) => {
  try {
    const events = await getAllEventsService();
    res.status(200).json({
      success: true,
      message: "Events retrieved successfully 🎉",
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_ALL_EVENTS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch events catalog" });
  }
};

// 2. Get event by ID
export const getEventById: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const event = await getEventByIdService(eventId);
    if (!event) {
      res.status(404).json({ success: false, error: "Event not found in TicketStream registry 🔍" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Event details retrieved successfully ✨",
      data: event,
    });
  } catch (error: any) {
    console.error("[GET_EVENT_BY_ID_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch event details" });
  }
};

// 3. Get events by title query
export const getEventsByTitle: RequestHandler = async (req, res) => {
  try {
    const title = req.query.title as string;
    if (!title) {
      res.status(400).json({ success: false, error: "Search query parameter 'title' is required 🏷️" });
      return;
    }

    const events = await getEventsByTitleService(title);
    res.status(200).json({
      success: true,
      message: `Found ${events.length} event(s) matching your search query 🔍`,
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_EVENTS_BY_TITLE_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to search events by title" });
  }
};

// 4. Get events by category
export const getEventsByCategory: RequestHandler = async (req, res) => {
  try {
    const category = String(req.params.category);
    const events = await getEventsByCategoryService(category);
    res.status(200).json({
      success: true,
      message: `Retrieved events under category: '${category}' 🎪`,
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_EVENTS_BY_CATEGORY_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch events by category" });
  }
};

// 5. Get events by Organization ID
export const getEventsByOrganization: RequestHandler = async (req, res) => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ success: false, error: "Invalid organization ID format provided 🏢" });
      return;
    }

    const events = await getEventsByOrganizationService(orgId);
    res.status(200).json({
      success: true,
      message: "Organization events fetched successfully 🏛️",
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_EVENTS_BY_ORG_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch organization events" });
  }
};

// 6. Get upcoming events
export const getUpcomingEvents: RequestHandler = async (req, res) => {
  try {
    const events = await getUpcomingEventsService();
    res.status(200).json({
      success: true,
      message: "Upcoming events lined up successfully 🚀",
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_UPCOMING_EVENTS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch upcoming events" });
  }
};

// 7. Get events by user's digitalId
export const getEventsByUserId: RequestHandler = async (req, res) => {
  try {
    const digitalId = Number(req.params.digitalId || req.user?.userId);
    if (isNaN(digitalId)) {
      res.status(400).json({ success: false, error: "User Digital ID is required to fetch user events 🆔" });
      return;
    }

    const events = await getEventsByUserIdService(digitalId);
    res.status(200).json({
      success: true,
      message: "User events retrieved successfully 👤",
      count: events.length,
      data: events,
    });
  } catch (error: any) {
    console.error("[GET_EVENTS_BY_USER_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch user events" });
  }
};

// 8. Create a new event
export const createEvent: RequestHandler = async (req, res) => {
  try {
    const parseResult = createEventValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    // Helper function to generate a URL-friendly slug from the title
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    const baseSlug = generateSlug(parseResult.data.title);
    const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    // Attach slug and fallback values if your service still requires ticketPrice and ticketsTotal
    const eventPayload = {
      ...parseResult.data,
      slug: uniqueSlug,
      ticketPrice: "0.00", // Default fallback if required by service/DB
      ticketsTotal: 0,     // Default fallback if required by service/DB
    };

    const result = await createEventService(eventPayload);
    res.status(201).json({
      success: true,
      message: "Event created successfully on TicketStream! 🎟️✨",
      data: result,
    });
  } catch (error: any) {
    console.error("[CREATE_EVENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create event" });
  }
};
// 9. Update event details
export const updateEvent: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const parseResult = updateEventValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const message = await updateEventService(eventId, parseResult.data);
    res.status(200).json({ success: true, message: `${message} 📝` });
  } catch (error: any) {
    console.error("[UPDATE_EVENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update event details" });
  }
};

// 10. Update event status
export const updateEventStatus: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const parseResult = updateEventStatusValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const message = await updateEventStatusService(eventId, parseResult.data.status);
    res.status(200).json({ success: true, message: `${message} 🚦` });
  } catch (error: any) {
    console.error("[UPDATE_EVENT_STATUS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update event status" });
  }
};

// 11. Delete event
export const deleteEvent: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const message = await deleteEventService(eventId);
    res.status(200).json({ success: true, message: `${message} 🗑️` });
  } catch (error: any) {
    console.error("[DELETE_EVENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete event" });
  }
};

import { eq } from "drizzle-orm";
import { events } from "../../drizzle/schema";
import db from "../../drizzle/db";
;


export const getEventBySlugController: RequestHandler = async (req, res) => {
  try {
    const rawSlug = req.params.slug;
    
    // Ensure slug is a valid single string
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    if (!slug || typeof slug !== "string") {
      res.status(400).json({ success: false, error: "Event slug is required 🚫" });
      return;
    }

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      res.status(404).json({ success: false, error: "Event not found 🚫" });
      return;
    }

    res.status(200).json({ success: true, message: "Event retrieved successfully ✨", data: event });
  } catch (error: any) {
    console.error("[GET_EVENT_BY_SLUG_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch event" });
  }
};

// ==========================================================
// 🎫 BOOKING CONTROLLERS (12 - 20)
// ==========================================================

// 12. Get all bookings
export const getAllBookings: RequestHandler = async (req, res) => {
  try {
    const bookings = await getAllBookingsService();
    res.status(200).json({
      success: true,
      message: "All bookings records fetched successfully 📑",
      count: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error("[GET_ALL_BOOKINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch bookings list" });
  }
};

// 13. Get booking by ID
export const getBookingById: RequestHandler = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      res.status(400).json({ success: false, error: "Invalid booking ID format provided 🚫" });
      return;
    }

    const booking = await getBookingByIdService(bookingId);
    if (!booking) {
      res.status(404).json({ success: false, error: "Booking record not found 🔍" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully 🎟️",
      data: booking,
    });
  } catch (error: any) {
    console.error("[GET_BOOKING_BY_ID_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch booking record" });
  }
};

// 14. Get bookings by User digitalId
export const getBookingsByUserId: RequestHandler = async (req, res) => {
  try {
    const digitalId = Number(req.params.digitalId || req.user?.userId);
    if (isNaN(digitalId)) {
      res.status(400).json({ success: false, error: "User Digital ID is required to fetch bookings 🆔" });
      return;
    }

    const bookings = await getBookingsByUserIdService(digitalId);
    res.status(200).json({
      success: true,
      message: "User bookings retrieved successfully 🎫",
      count: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error("[GET_BOOKINGS_BY_USER_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch user bookings" });
  }
};

// 15. Get bookings by Event ID
export const getBookingsByEventId: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const bookings = await getBookingsByEventIdService(eventId);
    res.status(200).json({
      success: true,
      message: "Event bookings fetched successfully 🎪",
      count: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error("[GET_BOOKINGS_BY_EVENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch event bookings" });
  }
};

// 16. Get recent bookings
export const getRecentBookings: RequestHandler = async (req, res) => {
  try {
    const limitNum = req.query.limit ? Number(req.query.limit) : 10;
    const bookings = await getRecentBookingsService(limitNum);
    res.status(200).json({
      success: true,
      message: `Fetched ${bookings.length} recent booking(s) successfully ⚡`,
      count: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error("[GET_RECENT_BOOKINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch recent bookings" });
  }
};

// ==========================================
// 17. CREATE BOOKING CONTROLLER
// ==========================================
export const createBooking: RequestHandler = async (req, res) => {
  try {
    const parseResult = createBookingValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const resolvedDigitalId = parseResult.data.digitalId ?? req.user?.userId;

    const payload = {
      eventId: parseResult.data.eventId,
      ticketTypeId: parseResult.data.ticketTypeId,
      quantity: parseResult.data.quantity,
      digitalId: resolvedDigitalId !== null && resolvedDigitalId !== undefined ? resolvedDigitalId : undefined,
      
      guestName: parseResult.data.guestName ?? (req.user as any)?.name ?? undefined,
      guestEmail: parseResult.data.guestEmail ?? req.user?.email ?? undefined,
      guestPhone: parseResult.data.guestPhone ?? (req.user as any)?.phone ?? undefined,
      
      idempotencyKey: parseResult.data.idempotencyKey ?? undefined,
    };

    const result = await createBookingService(payload);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json({
      success: true,
      message: "Booking initialized successfully using Ticket ID! Ready for payment processing 💳🎫",
      data: result.data,
    });
  } catch (error: any) {
    console.error("[CREATE_BOOKING_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create booking" });
  }
};

// 18. Update booking status
export const updateBookingStatus: RequestHandler = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      res.status(400).json({ success: false, error: "Invalid booking ID format provided 🚫" });
      return;
    }

    const parseResult = updateBookingStatusValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const message = await updateBookingStatusService(bookingId, parseResult.data.bookingStatus);
    res.status(200).json({ success: true, message: `${message} ✅` });
  } catch (error: any) {
    console.error("[UPDATE_BOOKING_STATUS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update booking status" });
  }
};

// 19. Cancel booking
export const cancelBooking: RequestHandler = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      res.status(400).json({ success: false, error: "Invalid booking ID format provided 🚫" });
      return;
    }

    const message = await cancelBookingService(bookingId);
    res.status(200).json({ success: true, message: `${message} ❌` });
  } catch (error: any) {
    console.error("[CANCEL_BOOKING_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel booking" });
  }
};

// 20. Get Event Booking Statistics
export const getEventBookingStats: RequestHandler = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (Number.isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Invalid event ID format provided 🚫" });
      return;
    }

    const stats = await getEventBookingStatsService(eventId);
    res.status(200).json({
      success: true,
      message: "Event booking statistics generated successfully 📊",
      data: stats,
    });
  } catch (error: any) {
    console.error("[GET_EVENT_STATS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch event statistics" });
  }
};