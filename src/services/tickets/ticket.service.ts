import { bookings, tickets, TInsertTicket, TSelectTicket, users, events } from "../../drizzle/schema";
import { eq, and, count } from "drizzle-orm";
import crypto from "node:crypto";
import db from "../../drizzle/db";
import { processAndEmailTicketService } from "../EmailTicket/emailTicket.Service";

// ==========================================
// 1. GENERATE TICKETS FOR A BOOKING (With Auto-Email Trigger)
// ==========================================
export const generateTicketsForBooking = async (bookingId: number): Promise<TSelectTicket[]> => {
  const [booking] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));
  if (!booking) throw new Error("Booking not found 🚫");
  if (!booking.eventId) throw new Error("Event ID is missing for this booking 🚫");

  // 1. Determine owner/holder details based on whether they logged in or used guest checkout
  let ownerName = booking.guestName;
  let ownerEmail = booking.guestEmail;
  let ownerPhone = booking.guestPhone;
  let ownerDigitalId = booking.digitalId;

  // If a digitalId exists, fetch the registered user's profile info to override/ensure accuracy
  if (booking.digitalId) {
    const [userRecord] = await db.select().from(users).where(eq(users.digitalId, booking.digitalId));
    if (userRecord) {
      ownerName = userRecord.firstName && userRecord.lastName 
        ? `${userRecord.firstName} ${userRecord.lastName}` 
        : userRecord.firstName || ownerName;
      ownerEmail = userRecord.email || ownerEmail;
      ownerPhone = userRecord.contactPhone || ownerPhone;
    }
  }

  const ticketsToInsert = [];
  const groupBundleId = booking.quantity > 1 ? `BUNDLE-${crypto.randomUUID()}` : null;

  for (let i = 0; i < booking.quantity; i++) {
    ticketsToInsert.push({
      bookingId: booking.bookingId,
      eventId: booking.eventId,
      purchaserDigitalId: ownerDigitalId ?? null,
      holderDigitalId: ownerDigitalId ?? null,
      
      ticketToken: `TKT-${crypto.randomBytes(16).toString("hex").toUpperCase()}`,
      ticketNumber: `TNUM-${Math.floor(100000 + Math.random() * 900000)}`,
      groupBundleId,
      
      isAssigned: booking.quantity === 1 ? true : false,
      attendeeName: booking.quantity === 1 ? ownerName : null,
      attendeeEmail: booking.quantity === 1 ? ownerEmail : null,
      attendeePhone: booking.quantity === 1 ? ownerPhone : null,
      
      transferStatus: "unassigned",
    });
  }

  const createdTickets = await db.insert(tickets).values(ticketsToInsert as any).returning();
  
  // 🚀 Automatically trigger email dispatch and QR generation once tickets are generated
  try {
    console.log(`📨 Triggering automated email ticket dispatch for booking ID: ${bookingId}`);
    await processAndEmailTicketService(bookingId);
    console.log(`✅ Automated email dispatched successfully for booking ID: ${bookingId}`);
  } catch (emailError: any) {
    console.error(`❌ Failed to send automated ticket email for booking ID ${bookingId}:`, emailError.message);
  }

  return createdTickets;
};

// ==========================================
// 2. GET TICKET BY ID
// ==========================================
export const getTicketById = async (ticketId: number): Promise<TSelectTicket | undefined> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
  return ticket;
};

// ==========================================
// 3. GET TICKET BY TOKEN
// ==========================================
export const getTicketByToken = async (ticketToken: string): Promise<TSelectTicket | undefined> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketToken, ticketToken));
  return ticket;
};

// ==========================================
// 4. GET TICKETS BY BOOKING ID
// ==========================================
export const getTicketsByBookingId = async (bookingId: number): Promise<TSelectTicket[]> => {
  return await db.select().from(tickets).where(eq(tickets.bookingId, bookingId));
};

// ==========================================
// 5. GET TICKETS BY EVENT ID
// ==========================================
export const getTicketsByEventId = async (eventId: number): Promise<TSelectTicket[]> => {
  return await db.select().from(tickets).where(eq(tickets.eventId, eventId));
};

// ==========================================
// 6. GET TICKETS BY HOLDER ID
// ==========================================
export const getTicketsByHolderId = async (digitalId: number): Promise<TSelectTicket[]> => {
  return await db.select().from(tickets).where(eq(tickets.digitalId, digitalId));
};

// ==========================================
// 7. GET TICKETS BY PURCHASER ID
// ==========================================
export const getTicketsByPurchaserId = async (purchaserDigitalId: number): Promise<TSelectTicket[]> => {
  return await db.select().from(tickets).where(eq(tickets.purchaserDigitalId, purchaserDigitalId));
};

// ==========================================
// 8. ASSIGN TICKET TO AN ATTENDEE
// ==========================================
export const assignTicket = async (
  ticketId: number, 
  attendeeData: { name: string; email: string; phone?: string }
): Promise<TSelectTicket> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!ticket) throw new Error("Ticket not found 🚫");

  const [updated] = await db
    .update(tickets)
    .set({
      attendeeName: attendeeData.name,
      attendeeEmail: attendeeData.email,
      attendeePhone: attendeeData.phone ?? null,
      isAssigned: true,
      transferStatus: "pending_claim",
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return updated;
};

// ==========================================
// 9. BULK ASSIGN BUNDLE TICKETS
// ==========================================
export const bulkAssignBundleTickets = async (
  groupBundleId: string, 
  assignments: Array<{ ticketId: number; name: string; email: string; phone?: string }>
): Promise<TSelectTicket[]> => {
  const updatedTickets: TSelectTicket[] = [];

  for (const item of assignments) {
    const [updated] = await db
      .update(tickets)
      .set({
        attendeeName: item.name,
        attendeeEmail: item.email,
        attendeePhone: item.phone ?? null,
        isAssigned: true,
        transferStatus: "pending_claim",
        updatedAt: new Date(),
      })
      .where(and(eq(tickets.ticketId, item.ticketId), eq(tickets.groupBundleId, groupBundleId)))
      .returning();

    if (updated) updatedTickets.push(updated);
  }

  return updatedTickets;
};

// ==========================================
// 10. INITIATE TICKET TRANSFER
// ==========================================
export const initiateTicketTransfer = async (ticketId: number, holderId: number): Promise<{ ticket: TSelectTicket; claimToken: string }> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!ticket) throw new Error("Ticket not found 🚫");
  if (ticket.digitalId !== holderId) throw new Error("Unauthorized: You do not own this ticket 🛡️");

  const claimToken = `CLAIM-${crypto.randomBytes(20).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(tickets)
    .set({
      transferStatus: "pending_claim",
      claimToken,
      claimTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return { ticket: updated, claimToken };
};

// ==========================================
// 11. CLAIM TRANSFERRED TICKET
// ==========================================
export const claimTransferredTicket = async (
  claimToken: string, 
  newHolderDigitalId: number, 
  attendeeInfo: { name: string; email: string; phone?: string }
): Promise<TSelectTicket> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.claimToken, claimToken));
  if (!ticket) throw new Error("Invalid or expired claim token 🚫");

  if (ticket.claimTokenExpiresAt && new Date() > new Date(ticket.claimTokenExpiresAt)) {
    throw new Error("This transfer claim link has expired ⌛");
  }

  const [claimedTicket] = await db
    .update(tickets)
    .set({
      digitalId: newHolderDigitalId,
      attendeeName: attendeeInfo.name,
      attendeeEmail: attendeeInfo.email,
      attendeePhone: attendeeInfo.phone ?? null,
      isAssigned: true,
      transferStatus: "transferred",
      claimToken: null,
      claimTokenExpiresAt: null,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticket.ticketId))
    .returning();

  return claimedTicket;
};

// ==========================================
// 12. SCAN TICKET AT GATE
// ==========================================
export const scanTicket = async (ticketToken: string): Promise<{ success: boolean; message: string; ticket?: TSelectTicket }> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketToken, ticketToken));
  if (!ticket) {
    return { success: false, message: "Ticket token not found or invalid ❌" };
  }

  if (ticket.isScanned) {
    return { 
      success: false, 
      message: `Ticket already scanned at gate on ${ticket.scannedAt?.toLocaleString() || 'previous check-in'} ⚠️`,
      ticket 
    };
  }

  const [scannedTicket] = await db
    .update(tickets)
    .set({
      isScanned: true,
      scannedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticket.ticketId))
    .returning();

  return { success: true, message: "Ticket verified and checked in successfully ✅🎫", ticket: scannedTicket };
};

// ==========================================
// 13. UNASSIGN TICKET
// ==========================================
export const unassignTicket = async (ticketId: number, ownerId: number): Promise<TSelectTicket> => {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!ticket) throw new Error("Ticket not found 🚫");
  if (ticket.purchaserDigitalId !== ownerId && ticket.digitalId !== ownerId) {
    throw new Error("Unauthorized to modify this ticket 🛡️");
  }

  const [updated] = await db
    .update(tickets)
    .set({
      attendeeName: null,
      attendeeEmail: null,
      attendeePhone: null,
      isAssigned: false,
      transferStatus: "unassigned",
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return updated;
};

// ==========================================
// 14. GET TICKETS BY BUNDLE ID
// ==========================================
export const getTicketsByBundleId = async (groupBundleId: string): Promise<TSelectTicket[]> => {
  return await db.select().from(tickets).where(eq(tickets.groupBundleId, groupBundleId));
};

// ==========================================
// 15. COUNT TOTAL TICKETS FOR EVENT
// ==========================================
export const countEventTickets = async (eventId: number): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));
  return result?.count ?? 0;
};

// ==========================================
// 16. COUNT SCANNED ATTENDEES
// ==========================================
export const countScannedAttendees = async (eventId: number): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventId), eq(tickets.isScanned, true)));
  return result?.count ?? 0;
};

// ==========================================
// 17. UPDATE TICKET HOLDER
// ==========================================
export const updateTicketHolder = async (ticketId: number, newDigitalId: number): Promise<TSelectTicket> => {
  const [updated] = await db
    .update(tickets)
    .set({ digitalId: newDigitalId, updatedAt: new Date() })
    .where(eq(tickets.ticketId, ticketId))
    .returning();
  return updated;
};

// ==========================================
// 18. RESET TICKET SCAN
// ==========================================
export const resetTicketScan = async (ticketId: number): Promise<TSelectTicket> => {
  const [updated] = await db
    .update(tickets)
    .set({ isScanned: false, scannedAt: null, updatedAt: new Date() })
    .where(eq(tickets.ticketId, ticketId))
    .returning();
  return updated;
};

// ==========================================
// 19. DELETE TICKET RECORD
// ==========================================
export const deleteTicket = async (ticketId: number): Promise<boolean> => {
  const result = await db.delete(tickets).where(eq(tickets.ticketId, ticketId)).returning();
  return result.length > 0;
};

// ==========================================
// 20. GET UNASSIGNED USER TICKETS
// ==========================================
export const getUnassignedUserTickets = async (digitalId: number): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.digitalId, digitalId), eq(tickets.isAssigned, false)));
};