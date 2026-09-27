import { z } from "zod";

// ===================== USER ZOD SCHEMAS =====================

export const insertUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(255),
  lastName: z.string().min(1, "Last name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  emailVerified: z.boolean().default(false),
  confirmationCode: z.string().max(255).optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters").max(255).optional().nullable(),
  contactPhone: z.string().min(10, "Contact phone is required").max(20),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().default("Kenya"),
  profileImageUrl: z.string().url("Invalid URL").optional().nullable(),
  role: z.enum(["user", "admin", "organizer"]).default("user"),
  isActive: z.boolean().default(true),
  passwordResetToken: z.string().max(255).optional().nullable(),
  passwordResetExpiresAt: z.date().optional().nullable(),
  failedLoginAttempts: z.number().int().default(0),
  lockedUntil: z.date().optional().nullable(),
  lastLoginAt: z.date().optional().nullable(),
});

export const updateUserSchema = insertUserSchema.partial();

export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  confirmationCode: z.string().length(6, "Confirmation code must be 6 digits"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const updatePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});