import { z } from "zod";

// ===================== CREATE ORGANIZATION VALIDATOR =====================
export const createOrganizationValidator = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  supportEmail: z.string().trim().email("Invalid support email address").optional().nullable(),
  supportPhone: z.string().trim().min(10, "Support phone must be at least 10 characters").max(20).optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  // Paybill / bank numbers can be shorter than a phone number, so the minimum is relaxed
  payoutPhone: z.string().trim().min(5, "Payout phone / account is too short").max(30).optional().nullable(),
  payoutType: z.enum(["mpesa_phone", "paybill", "bank"]).default("mpesa_phone"),
  commissionPercentage: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Commission percentage must be a valid decimal number string")
    .default("5.00")
    .optional(),
});

// ===================== UPDATE ORGANIZATION VALIDATOR =====================
export const updateOrganizationValidator = createOrganizationValidator.partial();

// ===================== ADMIN: UPDATE COMMISSION VALIDATOR =====================
export const updateCommissionValidator = z.object({
  commissionPercentage: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Commission percentage must be a valid decimal number string (e.g., '5.00')"),
});

// ===================== ADMIN: VERIFY ORGANIZATION VALIDATOR =====================
export const verifyOrganizationValidator = z.object({
  isVerified: z.boolean({ required_error: "Verification status is required" }),
});

// ===================== ADMIN: TOGGLE STATUS VALIDATOR =====================
export const toggleOrganizationStatusValidator = z.object({
  isActive: z.boolean({ required_error: "Active status is required" }),
});

// ===================== SEARCH ORGANIZATION VALIDATOR =====================
export const searchOrganizationValidator = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
});

// ===================== ORGANIZATION MEMBERS & PAYOUT VALIDATORS =====================
export const addOrganizationMemberValidator = z.object({
  orgId: z.number().int().positive("Organization ID must be a positive integer"),
  digitalId: z.number().int().positive("Digital ID must be a positive integer"),
  orgRole: z.enum(["owner", "admin", "manager", "scanner"]).default("scanner"),
});

export const updateMemberRoleValidator = z.object({
  orgRole: z.enum(["owner", "admin", "manager", "scanner"]),
});

export const updatePayoutConfigValidator = z.object({
  payoutPhone: z.string().trim().min(5, "Payout phone / account is required").max(30),
  payoutType: z.enum(["mpesa_phone", "paybill", "bank"]),
});