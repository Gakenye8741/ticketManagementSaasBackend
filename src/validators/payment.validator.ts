import { z } from "zod";

export const paymentStatusEnumValues = ["Pending", "Completed", "Failed", "Refunded"] as const;

// ==========================================
// 💳 PAYMENT VALIDATORS
// ==========================================

export const createPaymentSchema = z.object({
  orgId: z
    .number({ required_error: "Organization ID is required" })
    .int("Organization ID must be an integer")
    .positive("Organization ID must be positive")
    .optional()
    .nullable(),

 bookingId: z
    .number({ required_error: "Booking ID is required" })
    .int()
    .positive(),

  // Amount is now optional because the server fetches it from the booking!
  amount: z.number().min(0).optional(),

  // Optional digitalId to support frictionless guest checkouts
  digitalId: z
    .number()
    .int("Digital ID must be an integer")
    .positive("Digital ID must be positive")
    .optional()
    .nullable(),


  platformFee: z
    .number()
    .min(0, "Platform fee cannot be negative")
    .default(0),

  netAmount: z
    .number()
    .min(0, "Net amount cannot be negative")
    .default(0),

  paymentStatus: z
    .enum(paymentStatusEnumValues)
    .default("Pending"),

  paymentMethod: z
    .string()
    .trim()
    .max(100, "Payment method name is too long")
    .optional()
    .nullable(),

  transactionId: z
    .string()
    .trim()
    .max(255, "Transaction ID is too long")
    .optional()
    .nullable(),

  // M-Pesa Daraja fields
  checkoutRequestId: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),

  merchantRequestId: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),

  resultCode: z
    .string()
    .trim()
    .max(10)
    .optional()
    .nullable(),

  resultDesc: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),

  // Stripe fields
  stripePaymentIntentId: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),

  stripeClientSecret: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(paymentStatusEnumValues, {
    required_error: "Payment status is required",
  }),
  transactionId: z.string().trim().max(255).optional(),
  resultCode: z.string().trim().max(10).optional(),
  resultDesc: z.string().trim().max(255).optional(),
});