import { z } from "zod";

// ==========================================
// 📅 EVENT VALIDATORS
// ==========================================

export const eventCategories = [
  "music",
  "conference",
  "workshop",
  "festival",
  "sports",
  "arts_theatre",
  "networking",
  "nightlife",
  "charity",
  "exhibition",
  "religious",
  "food_drink",
  "technology",
  "comedy",
  "other"
] as const;

export const createEventValidator = z.object({
    orgId: z
        .number({ required_error: "Organization ID is required" })
        .int("Organization ID must be an integer"),

    venueId: z
        .number()
        .int("Venue ID must be an integer")
        .optional()
        .nullable(),

    title: z
        .string({ required_error: "Event title is required" })
        .trim()
        .min(3, "Event title must be at least 3 characters long")
        .max(255, "Event title cannot exceed 255 characters"),

    description: z
        .string()
        .trim()
        .optional()
        .nullable(),

    category: z
        .enum(eventCategories, {
            required_error: "Event category is required",
            invalid_type_error: "Invalid event category selected",
        })
        .default("other"),

    date: z
        .string({ required_error: "Event date is required" })
        .trim(),

    time: z
        .string({ required_error: "Event time is required" })
        .trim(),

    imageUrl: z
        .string()
        .url("Invalid image URL format")
        .optional()
        .nullable(),

    status: z
        .enum(["upcoming", "in_progress", "ended", "cancelled"])
        .default("upcoming"),
});

export const updateEventValidator = createEventValidator.partial();

export const updateEventStatusValidator = z.object({
    status: z.enum(["upcoming", "in_progress", "ended", "cancelled"], {
        required_error: "Event status is required",
    }),
});


// ==========================================
// 🎫 BOOKING VALIDATORS
// ==========================================




export const createBookingValidator = z.object({
  eventId: z
    .number({ required_error: "Event ID is required" })
    .int("Event ID must be an integer"),

  ticketTypeId: z
    .number({ required_error: "Ticket Type ID is required" })
    .int("Ticket Type ID must be an integer"),

  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),

  digitalId: z
    .number()
    .int()
    .optional()
    .nullable(),

  guestName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),

  guestEmail: z
    .string()
    .trim()
    .email("Invalid guest email format")
    .optional()
    .nullable(),

  guestPhone: z
    .string()
    .trim()
    .optional()
    .nullable(),

  idempotencyKey: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),
}).refine((data) => {
  const hasDigitalId = data.digitalId !== undefined && data.digitalId !== null;
  
  if (!hasDigitalId) {
    return !!data.guestName && !!data.guestEmail && !!data.guestPhone;
  }
  return true;
}, {
  message: "Guest name, email, and phone number are required for guest checkouts when not logged in 📝",
  path: ["guestEmail"],
});

export const updateBookingStatusValidator = z.object({
    bookingStatus: z.enum(["Pending", "Confirmed", "Cancelled", "Refunded"], {
        required_error: "Booking status is required",
    }),
});


// ==========================================
// 🔤 TYPE EXPORTS FOR CONTROLLERS & SERVICES
// ==========================================

export type TCreateEvent = z.infer<typeof createEventValidator>;
export type TUpdateEvent = z.infer<typeof updateEventValidator>;
export type TUpdateEventStatus = z.infer<typeof updateEventStatusValidator>;

export type TCreateBooking = z.infer<typeof createBookingValidator>;
export type TUpdateBookingStatus = z.infer<typeof updateBookingStatusValidator>;