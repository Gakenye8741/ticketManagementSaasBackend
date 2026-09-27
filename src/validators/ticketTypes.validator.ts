import { z } from "zod";

// ==========================================
// 1. CREATE TICKET TYPE SCHEMA
// ==========================================
export const createTicketTypeSchema = z.object({
  eventId: z.number().int().positive("Event ID must be a valid positive integer"),
  name: z.string().min(1, "Ticket tier name is required").max(100, "Ticket name cannot exceed 100 characters"),
  price: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  sold: z.number().int().nonnegative("Sold count cannot be negative").optional().default(0),
});

// ==========================================
// 2. UPDATE TICKET TYPE SCHEMA
// ==========================================
export const updateTicketTypeSchema = createTicketTypeSchema.partial();

// ==========================================
// 3. BULK CREATE TICKET TYPES SCHEMA
// ==========================================
export const bulkCreateTicketTypesSchema = z.object({
  eventId: z.number().int().positive("Event ID must be a valid positive integer"),
  ticketTypes: z.array(
    z.object({
      name: z.string().min(1, "Ticket tier name is required").max(100),
      price: z.union([z.string(), z.number()]).transform((val) => val.toString()),
      quantity: z.number().int().positive("Quantity must be a positive integer"),
      sold: z.number().int().nonnegative().optional().default(0),
    })
  ).min(1, "At least one ticket type must be provided"),
});

// ==========================================
// 4. UPDATE CAPACITY SCHEMA
// ==========================================
export const updateTicketTypeCapacitySchema = z.object({
  quantity: z.number().int().positive("New quantity must be greater than zero"),
});

// ==========================================
// 5. UPDATE PRICE SCHEMA
// ==========================================
export const updateTicketTypePriceSchema = z.object({
  price: z.union([z.string(), z.number()]).transform((val) => val.toString()),
});

// ==========================================
// REUSABLE VALIDATION MIDDLEWARE FACTORY
// ==========================================
export const validateBody = (schema: z.ZodSchema) => (req: any, res: any, next: any) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: "Validation failed ❌",
      errors: error.errors?.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })) || error.message,
    });
  }
};

// Export inferred types for controller use
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
export type BulkCreateTicketTypesInput = z.infer<typeof bulkCreateTicketTypesSchema>;