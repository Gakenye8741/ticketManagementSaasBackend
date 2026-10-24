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

/* ==========================================
 * 🎫 BOOKING VALIDATORS
 * ========================================== */

// NEW — one row of the cart
export const bookingLineValidator = z.object({
  ticketTypeId: z
    .number({ required_error: "Ticket Type ID is required" })
    .int("Ticket Type ID must be an integer")
    .positive("Ticket Type ID must be greater than zero"),

  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
});

export const createBookingValidator = z
  .object({
    eventId: z
      .number({ required_error: "Event ID is required" })
      .int("Event ID must be an integer")
      .positive("Event ID must be greater than zero"),

    // NEW — multi-ticket-type cart
    lines: z
      .array(bookingLineValidator)
      .min(1, "At least one ticket line is required")
      .optional()
      .nullable(),

    // Legacy single-type fields (still accepted when `lines` is missing)
    ticketTypeId: z
      .number()
      .int("Ticket Type ID must be an integer")
      .positive("Ticket Type ID must be greater than zero")
      .optional()
      .nullable(),

    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .optional()
      .nullable(),

    digitalId: z
      .number()
      .int()
      .positive()
      .optional()
      .nullable(),

    // Payer / primary customer
    guestName: z
      .string()
      .trim()
      .min(1, "Guest name cannot be empty")
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
      .min(1, "Guest phone cannot be empty")
      .max(20)
      .optional()
      .nullable(),

    // Individual attendee details for each ticket
    attendees: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, "Attendee name cannot be empty")
            .max(255)
            .optional()
            .nullable(),

          email: z
            .string()
            .trim()
            .email("Invalid attendee email format")
            .optional()
            .nullable(),

          phone: z
            .string()
            .trim()
            .min(1, "Attendee phone cannot be empty")
            .max(20)
            .optional()
            .nullable(),
        })
      )
      .optional()
      .nullable(),

    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .optional()
      .nullable(),
  })
  // Must supply either `lines` OR (`ticketTypeId` + `quantity`)
  .refine(
    (data) => {
      const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
      const hasLegacy =
        data.ticketTypeId !== undefined &&
        data.ticketTypeId !== null &&
        data.quantity !== undefined &&
        data.quantity !== null;

      return hasLines || hasLegacy;
    },
    {
      message:
        "Provide either a `lines` array (multi-ticket) or both `ticketTypeId` and `quantity` (single ticket) 🎟️",
      path: ["lines"],
    }
  )
  // Guest details are only required when not logged in
  .refine(
    (data) => {
      const hasDigitalId =
        data.digitalId !== undefined &&
        data.digitalId !== null;

      if (hasDigitalId) {
        return true;
      }

      return Boolean(
        data.guestName?.trim() &&
        data.guestEmail?.trim() &&
        data.guestPhone?.trim()
      );
    },
    {
      message:
        "Guest name, email, and phone number are required for guest checkouts when not logged in 📝",
      path: ["guestEmail"],
    }
  );

export const updateBookingStatusValidator = z.object({
  bookingStatus: z.enum(
    ["Pending", "Confirmed", "Cancelled", "Refunded"],
    {
      required_error: "Booking status is required",
    }
  ),
});

/* ==========================================
 * 🔤 TYPE EXPORTS FOR CONTROLLERS & SERVICES
 * ========================================== */

export type TCreateEvent = z.infer<typeof createEventValidator>;
export type TUpdateEvent = z.infer<typeof updateEventValidator>;
export type TUpdateEventStatus = z.infer<
  typeof updateEventStatusValidator
>;

export type TCreateBooking = z.infer<
  typeof createBookingValidator
>;

export type TBookingLine = z.infer<typeof bookingLineValidator>;

export type TUpdateBookingStatus = z.infer<
  typeof updateBookingStatusValidator
>;