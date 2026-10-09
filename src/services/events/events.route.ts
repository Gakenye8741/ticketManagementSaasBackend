
import { Router } from "express";
import {
  // Event Controllers — unchanged
  getAllEvents,
  getEventById,
  getEventsByTitle,
  getEventsByCategory,
  getEventsByOrganization,
  getUpcomingEvents,
  getEventsByUserId,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,

  // Booking Controllers
  getAllBookings,
  getBookingById,
  getBookingsByUserId,
  getBookingsByEventId,
  getRecentBookings,
  createBooking,
  updateBookingStatus,
  cancelBooking,
  getEventBookingStats,
  getMyBookings,
  getEventBySlugController,
} from "./eventBooking.controller";

import {
  adminOrOrganizerAuth,
  anyAuthenticatedUser,
  adminAuth,
  optionalAuth,
} from "../../middleware/bearAuth";

import { getBookingPaymentStatus } from "../payments/Mpesa/Mpesa.controller";

export const eventRouter = Router();

// ==========================================
// 📅 PUBLIC EVENT ROUTES
// ==========================================

// 1. Get all events catalog
eventRouter.get("/events", getAllEvents);

// 2. Get upcoming events feed
eventRouter.get("/events/upcoming", getUpcomingEvents);

// 3. Search events by title query (?title=...)
eventRouter.get("/events/search/title", getEventsByTitle);

// 4. Get events by category (:category)
eventRouter.get("/events/category/:category", getEventsByCategory);

// 5. Get events by Organization ID (:orgId)
eventRouter.get(
  "/events/organization/:orgId",
  getEventsByOrganization
);

// 6. Get events created by specific user digitalId
eventRouter.get(
  "/events/user/:digitalId",
  anyAuthenticatedUser,
  getEventsByUserId
);

// 7. Get single event by slug
eventRouter.get("/events/:slug", getEventBySlugController);

// 8. Get single event by ID (:id)
eventRouter.get("/events/:id", getEventById);

// ==========================================
// 🔐 PROTECTED EVENT MANAGEMENT ROUTES
// (Admin / Organizer) — unchanged
// ==========================================

// 9. Create a new event
eventRouter.post("/events", adminOrOrganizerAuth, createEvent);

// 10. Update event details
eventRouter.put("/events/:id", adminOrOrganizerAuth, updateEvent);

// 11. Update event lifecycle status
eventRouter.patch(
  "/events/:id/status",
  adminOrOrganizerAuth,
  updateEventStatus
);

// 12. Delete an event
eventRouter.delete("/events/:id", adminAuth, deleteEvent);

// ==========================================
// 🎫 BOOKING & TICKET ROUTES
// ==========================================

// 0. Public Booking & Payment Status Check
// Used for M-Pesa / Stripe polling UI
eventRouter.get(
  "/bookings/:bookingId/status",
  getBookingPaymentStatus
);

// 13. Get all bookings (Admin or Organizer only)
eventRouter.get(
  "/bookings",
  adminOrOrganizerAuth,
  getAllBookings
);

// 14. Get recent bookings feed (Admin or Organizer only)
eventRouter.get(
  "/bookings/recent",
  adminOrOrganizerAuth,
  getRecentBookings
);

// 15. Get bookings belonging to the authenticated user
// Keep this before /bookings/:id
eventRouter.get(
  "/bookings/me",
  anyAuthenticatedUser,
  getMyBookings
);

// 16. Get bookings belonging to a specific user (:digitalId)
eventRouter.get(
  "/bookings/user/:digitalId",
  anyAuthenticatedUser,
  getBookingsByUserId
);

// 17. Get bookings for a specific event (Admin or Organizer)
eventRouter.get(
  "/bookings/event/:eventId",
  adminOrOrganizerAuth,
  getBookingsByEventId
);

// 18. Get event booking statistics and revenue overview
eventRouter.get(
  "/bookings/event/:eventId/stats",
  adminOrOrganizerAuth,
  getEventBookingStats
);

// 19. Get single booking by ID
eventRouter.get(
  "/bookings/:id",
  anyAuthenticatedUser,
  getBookingById
);

// 20. Create a new ticket booking / checkout
// Supports logged-in users and guests
eventRouter.post(
  "/bookings",
  optionalAuth,
  createBooking
);

// 21. Update booking status (Admin or Organizer)
eventRouter.patch(
  "/bookings/:id/status",
  adminOrOrganizerAuth,
  updateBookingStatus
);

// 22. Cancel a booking
eventRouter.patch(
  "/bookings/:id/cancel",
  anyAuthenticatedUser,
  cancelBooking
);
