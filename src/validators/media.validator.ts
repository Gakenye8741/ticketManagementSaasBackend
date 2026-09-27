import { z } from "zod";

/**
 * Zod validation schemas for the Media service
 */

// Schema for creating a single media record
export const createMediaSchema = z.object({
  eventId: z.number().int().positive("Event ID must be a positive integer"),
  url: z.string().url("A valid media URL is required"),
  type: z.enum(["image", "video"], {
    errorMap: () => ({ message: "Type must be one of: image, video" }),
  }),
  altText: z.string().max(255, "Alt text cannot exceed 255 characters").optional(),
  isPrimary: z.boolean().optional(),
});

// Schema for bulk creating media items
export const bulkCreateMediaSchema = z.object({
  items: z.array(createMediaSchema).min(1, "At least one media item is required in the bulk payload"),
});

// Schema for updating a media record (all fields optional)
export const updateMediaSchema = z.object({
  url: z.string().url("A valid media URL is required").optional(),
  type: z.enum(["image", "video"]).optional(),
  altText: z.string().max(255, "Alt text cannot exceed 255 characters").optional(),
  isPrimary: z.boolean().optional(),
});

// Schema for validating media ID parameters (e.g., in request params or body)
export const mediaIdParamSchema = z.object({
  mediaId: z.coerce.number().int().positive("Media ID must be a positive integer"),
});

// Schema for validating event ID parameters
export const eventIdParamSchema = z.object({
  eventId: z.coerce.number().int().positive("Event ID must be a positive integer"),
});

// Schema for validating event ID pairs (e.g., cloning media between events)
export const cloneMediaSchema = z.object({
  sourceEventId: z.coerce.number().int().positive("Source Event ID must be a positive integer"),
  targetEventId: z.coerce.number().int().positive("Target Event ID must be a positive integer"),
});

// Schema for bulk deleting media by an array of IDs
export const bulkDeleteMediaSchema = z.object({
  mediaIds: z.array(z.number().int().positive()).min(1, "At least one media ID is required for bulk deletion"),
});

// Schema for batch updating alt text
export const batchUpdateAltTextSchema = z.object({
  updates: z.array(
    z.object({
      mediaId: z.number().int().positive("Media ID must be a positive integer"),
      altText: z.string().max(255, "Alt text cannot exceed 255 characters"),
    })
  ).min(1, "At least one update item is required"),
});

// TypeScript types inferred from the Zod schemas
export type CreateMediaInput = z.infer<typeof createMediaSchema>;
export type BulkCreateMediaInput = z.infer<typeof bulkCreateMediaSchema>;
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;
export type CloneMediaInput = z.infer<typeof cloneMediaSchema>;
export type BulkDeleteMediaInput = z.infer<typeof bulkDeleteMediaSchema>;
export type BatchUpdateAltTextInput = z.infer<typeof batchUpdateAltTextSchema>;