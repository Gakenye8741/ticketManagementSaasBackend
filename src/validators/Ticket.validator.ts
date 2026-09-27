import { z } from "zod";

// ==========================================
// TICKET ZOD VALIDATION SCHEMAS
// ==========================================

export const assignTicketSchema = z.object({
  name: z.string().min(2, "Attendee name is required"),
  email: z.string().email("Valid attendee email is required"),
  phone: z.string().optional(),
});

export const bulkAssignBundleTicketsSchema = z.object({
  groupBundleId: z.string().min(1, "Group bundle ID is required"),
  assignments: z.array(
    z.object({
      ticketId: z.number().int().positive(),
      name: z.string().min(2, "Attendee name is required"),
      email: z.string().email("Valid attendee email is required"),
      phone: z.string().optional(),
    })
  ).min(1, "At least one ticket assignment is required"),
});

export const initiateTicketTransferSchema = z.object({
  ticketId: z.number().int().positive(),
  holderId: z.number().int().positive(),
});

export const claimTransferredTicketSchema = z.object({
  claimToken: z.string().min(1, "Claim token is required"),
  newHolderDigitalId: z.number().int().positive(),
  attendeeInfo: z.object({
    name: z.string().min(2, "Attendee name is required"),
    email: z.string().email("Valid attendee email is required"),
    phone: z.string().optional(),
  }),
});

export const scanTicketSchema = z.object({
  ticketToken: z.string().min(1, "Ticket token is required"),
});

export const unassignTicketSchema = z.object({
  ticketId: z.number().int().positive(),
  ownerId: z.number().int().positive(),
});

export const updateTicketHolderSchema = z.object({
  ticketId: z.number().int().positive(),
  newDigitalId: z.number().int().positive(),
});