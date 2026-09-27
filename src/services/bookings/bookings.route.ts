import { Router } from "express";
import {
  getAllBookings,
  getBookingById,
  getBookingsByUserNationalId, // 🔄 Updated to use national ID
  getBookingsByEventId,
  createBooking,
  updateBooking,
  deleteBooking,
  updateBookingStatus,
  cancelBooking
} from "./bookings.controller";

import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

export const bookingRouter = Router();

// 📦 Booking Routes

// 📋 Get all bookings (Admin only)
bookingRouter.get("/bookings", getAllBookings);

// 🔍 Get booking by ID (Admin only)
bookingRouter.get("/bookings/:id", adminAuth, getBookingById);

// 👤 Get bookings by user national ID (Authenticated user)
bookingRouter.get("/bookings/user/national-id/:nationalId", getBookingsByUserNationalId);

// 🎟️ Get bookings by event ID (Admin only)
bookingRouter.get("/bookings/event/:eventId", adminAuth, getBookingsByEventId);

// ➕ Create a new booking (Authenticated user)
bookingRouter.post("/bookings", createBooking);

// 📝 Update an existing booking (Authenticated user)
bookingRouter.put("/bookings/:id", anyAuthenticatedUser, updateBooking);

// 🗑️ Delete a booking (Authenticated user)
bookingRouter.delete("/bookings/:id", anyAuthenticatedUser, deleteBooking);

// 🔄 Update booking status (Admin only)
bookingRouter.patch("/bookings/:id/status", adminAuth, updateBookingStatus);

// ❌ Cancel a booking (Authenticated user)
bookingRouter.patch("/bookings/:id/cancel", anyAuthenticatedUser, cancelBooking);
