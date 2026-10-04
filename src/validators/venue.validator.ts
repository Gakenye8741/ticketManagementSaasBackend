import { z } from "zod";

// Schema for creating a new venue
export const createVenueSchema = z.object({
  name: z.string().min(1, "Venue name is required").max(255, "Name is too long"),
  address: z.string().min(1, "Address is required"),
  capacity: z.number().int().positive("Capacity must be a positive integer").optional(),
  status: z.enum(["available", "booked"]).default("available").optional(),
  orgId: z.number().int().positive("Organization ID is required").optional(), // Optional if injected via auth middleware
});

// Schema for updating an existing venue (all fields optional)
export const updateVenueSchema = createVenueSchema.partial();

// TypeScript types inferred from the Zod schemas
export type TCreateVenueInput = z.infer<typeof createVenueSchema>;
export type TUpdateVenueInput = z.infer<typeof updateVenueSchema>;