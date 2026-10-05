import { z } from "zod";

// Shared enums mirroring your Drizzle PG enums
export const verificationStatusEnum = z.enum([
  "pending",
  "in_progress",
  "resubmission_requested",
  "approved",
  "rejected",
  "suspended",
]);

export const entityTypeEnum = z.enum(["individual", "corporate"]);

export const itemizedFieldEnum = z.enum([
  "idFront",
  "idBack",
  "selfies",
  "businessDoc",
  "taxCert",
]);

/**
 * 1. Schema for submitting new organizer verification (KYC)
 */
export const createVerificationSchema = z.object({
  userId: z.number().int().positive("Invalid user digital ID"),
  orgId: z.number().int().positive("Invalid organization ID").optional().nullable(),
  
  entityType: entityTypeEnum.default("individual"),
  legalFullName: z.string().min(2, "Legal full name is required and must match your ID"),

  // Identity Verification URLs (Cloudinary)
  idFrontUrl: z.string().url("Invalid front ID image URL"),
  idBackUrl: z.string().url("Invalid back ID image URL"),
  selfiePhotos: z.array(z.string().url("Invalid selfie URL")).min(1, "At least one live selfie photo is required"),

  // Corporate Details (Conditional based on entityType, but optional in base validation)
  businessRegistrationDocUrl: z.string().url("Invalid business registration document URL").optional().nullable(),
  taxComplianceCertUrl: z.string().url("Invalid tax compliance certificate URL").optional().nullable(),
});

/**
 * 2. Schema for updating general verification information
 */
export const updateVerificationSchema = createVerificationSchema.partial();

/**
 * 3. Schema for updating global verification status (Admin review)
 */
export const adminReviewSchema = z.object({
  status: verificationStatusEnum,
  adminComment: z.string().max(1000, "Comment cannot exceed 1000 characters").optional(),
});

/**
 * 4. Schema for flagging a specific field for itemized rejection
 */
export const itemizedRejectionSchema = z.object({
  field: itemizedFieldEnum,
  comment: z.string().min(1, "Rejection comment/reason is required for targeted resubmission"),
});

/**
 * 5. Schema for clearing an itemized rejection when re-uploading a specific asset
 */
export const clearItemizedRejectionSchema = z.object({
  field: itemizedFieldEnum,
  newUrlValue: z.string().url("Invalid replacement asset URL"),
});

// Export inferred TypeScript types for your controllers and middleware
export type TCreateVerificationInput = z.infer<typeof createVerificationSchema>;
export type TUpdateVerificationInput = z.infer<typeof updateVerificationSchema>;
export type TAdminReviewInput = z.infer<typeof adminReviewSchema>;
export type TItemizedRejectionInput = z.infer<typeof itemizedRejectionSchema>;
export type TClearItemizedRejectionInput = z.infer<typeof clearItemizedRejectionSchema>;