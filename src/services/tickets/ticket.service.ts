import { bookings, tickets, bookingItems, TSelectTicket, users } from "../../drizzle/schema";
import { eq, and, count } from "drizzle-orm";
import crypto from "node:crypto";
import db from "../../drizzle/db";
import { processAndEmailTicketService } from "../EmailTicket/emailTicket.Service";
import { emailSingleTicketService, SingleTicketEmailReason } from "../EmailTicket/Emailsingleticket.service";


// ==========================================
// NEW: SMALL HELPERS
// ==========================================

/** A fresh, unguessable ticket token (the value the QR code and view link use) */
const generateTicketToken = () =>
  `TKT-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;

/** "Jane Wanjiru" for a digitalId, or undefined (used in "X assigned/sent you a ticket") */
const getDisplayName = async (
  digitalId?: number | null
): Promise<string | undefined> => {
  if (!digitalId) return undefined;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.digitalId, digitalId));

  if (!user) return undefined;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
};

/**
 * Emails the ticket to its current attendee.
 * A failed email must NEVER undo an assignment/claim that already succeeded,
 * so errors are logged and swallowed.
 * UPDATED: a refunded (non-Valid) ticket is never emailed.
 */
const notifyTicketAttendee = async (
  ticketId: number,
  reason: SingleTicketEmailReason,
  fromName?: string
) => {
  try {
    const [t] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.ticketId, ticketId));

    if (!t || t.lifecycleStatus !== "Valid") return; // never email a refunded ticket

    await emailSingleTicketService(ticketId, reason, { fromName });
  } catch (error: any) {
    console.error(
      `❌ Could not email ${reason} ticket ${ticketId}:`,
      error?.message || error
    );
  }
};

/**
 * Only the CURRENT holder may change a ticket
 * (or the purchaser, for tickets that never had a holder account).
 * `actorDigitalId` should always come from the verified login token.
 */
const assertCanManage = (ticket: TSelectTicket, actorDigitalId?: number) => {
  if (actorDigitalId === undefined) return;

  const owner = ticket.digitalId ?? ticket.purchaserDigitalId;

  if (owner !== actorDigitalId) {
    throw new Error("Unauthorized: You do not own this ticket 🛡️");
  }
};

/**
 * NEW: Refunded (or otherwise non-Valid) tickets can't be used,
 * assigned, transferred or emailed.
 */
const assertTicketValid = (ticket: TSelectTicket) => {
  if (ticket.lifecycleStatus === "Valid") return;
  throw new Error(
    ticket.lifecycleStatus === "Refunded"
      ? "This ticket has been refunded and is no longer valid 🚫"
      : `This ticket is ${ticket.lifecycleStatus} and can't be changed 🚫`
  );
};

// ==========================================
// GENERATE TICKETS FOR A BOOKING
// ------------------------------------------
// - Multi-ticket aware: each ticket is stamped with
//   bookingItemId + ticketTypeId + ticketTypeName so the
//   ticket type survives renames/deletions.
// - Booking quantity 5 = exactly 5 tickets (or the sum
//   of bookingItems quantities if items exist).
// - Every ticket initially belongs to the payer
// - Tickets can later be assigned/transferred
// - Idempotent: calling this multiple times will
//   never intentionally create more than the total needed
// - If ticket creation was interrupted, missing
//   tickets are created on the next call
// - Each ticket uses its corresponding attendee
//   from booking.attendees when available
// ==========================================

export const generateTicketsForBooking = async (
  bookingId: number
): Promise<TSelectTicket[]> => {
  // ------------------------------------------
  // 1. Get booking WITH its cart items (multi-ticket)
  // ------------------------------------------
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
    with: { items: true },
  });

  if (!booking) {
    throw new Error("Booking not found 🚫");
  }

  if (!booking.eventId) {
    throw new Error("Event ID is missing for this booking 🚫");
  }

  // ------------------------------------------
  // 1a. Build the ticket plan from bookingItems (or fall back to the legacy header)
  // ------------------------------------------
  type TicketPlan = {
    bookingItemId: number | null;
    ticketTypeId: number | null;
    ticketTypeName: string | null;
    quantity: number;
  };

  const plan: TicketPlan[] = booking.items?.length
    ? booking.items.map((i) => ({
        bookingItemId: i.bookingItemId,
        ticketTypeId: i.ticketTypeId,
        ticketTypeName: i.ticketTypeName,
        quantity: Number(i.quantity),
      }))
    : booking.ticketTypeId != null
      ? [{
          bookingItemId: null,
          ticketTypeId: booking.ticketTypeId,
          ticketTypeName: booking.ticketTypeName ?? null,
          quantity: Number(booking.quantity),
        }]
      : [];

  if (plan.length === 0) {
    throw new Error(`Booking ${bookingId} has no ticket lines 🚫`);
  }

  // Total tickets we need to generate
  const totalNeeded = plan.reduce((sum, p) => sum + p.quantity, 0);

  if (!Number.isInteger(totalNeeded) || totalNeeded <= 0) {
    throw new Error(
      `Invalid booking quantity for booking ${bookingId}: ${booking.quantity}`
    );
  }

  // ------------------------------------------
  // 2. Check tickets that already exist
  // ------------------------------------------
  const existingTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.bookingId, bookingId));

  // If the correct number already exists,
  // simply return them.
  if (existingTickets.length >= totalNeeded) {
    console.log(
      `🎟️ Booking ${bookingId} already has ${existingTickets.length}/${totalNeeded} tickets.`
    );

    return existingTickets;
  }

  // ------------------------------------------
  // 3. Determine the payer / initial owner
  // ------------------------------------------
  let ownerName = booking.guestName;
  let ownerEmail = booking.guestEmail;
  let ownerPhone = booking.guestPhone;

  // Registered user gets priority over guest information
  if (booking.digitalId) {
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.digitalId, booking.digitalId));

    if (userRecord) {
      ownerName =
        userRecord.firstName && userRecord.lastName
          ? `${userRecord.firstName} ${userRecord.lastName}`
          : userRecord.firstName || ownerName;

      ownerEmail = userRecord.email || ownerEmail;
      ownerPhone = userRecord.contactPhone || ownerPhone;
    }
  }

  // ------------------------------------------
  // 4. Get individual attendee details
  // ------------------------------------------
  const attendees = Array.isArray(booking.attendees)
    ? booking.attendees
    : [];

  console.log(
    `👥 Booking ${bookingId}: ${attendees.length}/${totalNeeded} attendee detail(s) found.`
  );

  // ------------------------------------------
  // 5. Calculate how many tickets are missing
  // ------------------------------------------
  const missingTickets = totalNeeded - existingTickets.length;

  console.log(
    `🎟️ Booking ${bookingId}: ${existingTickets.length}/${totalNeeded} tickets exist.`
  );

  console.log(
    `🎟️ Creating ${missingTickets} missing ticket(s) for booking ${bookingId}.`
  );

  // ------------------------------------------
  // 6. Reuse existing bundle ID if one exists
  // ------------------------------------------
  let groupBundleId: string | null = null;

  if (totalNeeded > 1) {
    groupBundleId =
      existingTickets.find((ticket) => ticket.groupBundleId)
        ?.groupBundleId ?? `BUNDLE-${crypto.randomUUID()}`;
  }

  // ------------------------------------------
  // 6a. Expand the plan into a flat list of "slots" — one entry per ticket.
  //     Each slot carries its bookingItemId + ticket type, so we can stamp
  //     the ticket type onto the correct individual ticket.
  // ------------------------------------------
  const slots: Array<{
    bookingItemId: number | null;
    ticketTypeId: number | null;
    ticketTypeName: string | null;
  }> = [];

  for (const p of plan) {
    for (let k = 0; k < p.quantity; k++) {
      slots.push({
        bookingItemId: p.bookingItemId,
        ticketTypeId: p.ticketTypeId,
        ticketTypeName: p.ticketTypeName,
      });
    }
  }

  // ------------------------------------------
  // 7. Create ONLY the missing tickets
  // ------------------------------------------
  //
  // IMPORTANT:
  // The attendee index is based on the ticket's original position
  // in the whole order (existingTickets.length + index). This keeps
  // attendee ↔ ticket mapping stable even when we resume after a
  // partial failure.
  //
  const ticketsToInsert = Array.from(
    { length: missingTickets },
    (_, index) => {
      const slotIndex = existingTickets.length + index;
      const slot = slots[slotIndex];

      const attendee = attendees[slotIndex];

      // Fall back to the payer if no attendee info
      const attendeeName =
        typeof attendee?.name === "string" && attendee.name.trim()
          ? attendee.name.trim()
          : ownerName;

      const attendeeEmail =
        typeof attendee?.email === "string" && attendee.email.trim()
          ? attendee.email.trim()
          : ownerEmail;

      const attendeePhone =
        typeof attendee?.phone === "string" && attendee.phone.trim()
          ? attendee.phone.trim()
          : ownerPhone;

      console.log(
        `🎟️ Preparing ticket ${slotIndex + 1}/${totalNeeded} for booking ${bookingId}` +
          (slot?.ticketTypeName ? ` [${slot.ticketTypeName}]` : "") +
          ` → ${attendeeEmail}`
      );

      return {
        bookingId: booking.bookingId,
        eventId: booking.eventId!,

        // 🆕 the cart line and its ticket type travel with the ticket
        bookingItemId: slot?.bookingItemId ?? null,
        ticketTypeId: slot?.ticketTypeId ?? null,
        ticketTypeName: slot?.ticketTypeName ?? null,

        // Original purchaser
        purchaserDigitalId: booking.digitalId ?? null,

        // Current holder — initially the payer
        digitalId: booking.digitalId ?? null,

        // Every ticket gets its own unique token and number
        ticketToken: `TKT-${crypto
          .randomBytes(16)
          .toString("hex")
          .toUpperCase()}`,

        ticketNumber: `TNUM-${crypto
          .randomBytes(6)
          .toString("hex")
          .toUpperCase()}`,

        // All tickets purchased together share the same bundle ID
        groupBundleId,

        // Initially the payer owns all tickets
        isAssigned: true,

        // Individual attendee details
        attendeeName,
        attendeeEmail,
        attendeePhone,

        // Nobody has been assigned/transferred yet
        transferStatus: "unassigned",
      };
    }
  );

  // ------------------------------------------
  // 8. Insert the missing tickets
  // ------------------------------------------
  let createdTickets: TSelectTicket[] = [];

  if (ticketsToInsert.length > 0) {
    createdTickets = await db
      .insert(tickets)
      .values(ticketsToInsert as any)
      .returning();

    console.log(
      `✅ Created ${createdTickets.length} ticket(s) for booking ${bookingId}.`
    );
  }

  // ------------------------------------------
  // 9. Get the COMPLETE ticket set
  // ------------------------------------------
  const allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.bookingId, bookingId));

  console.log(
    `🎟️ Booking ${bookingId} now has ${allTickets.length}/${totalNeeded} ticket(s).`
  );

  // ------------------------------------------
  // 10. Safety check
  // ------------------------------------------
  if (allTickets.length < totalNeeded) {
    console.error(
      `⚠️ Ticket generation incomplete for booking ${bookingId}. ` +
        `Expected ${totalNeeded}, found ${allTickets.length}.`
    );

    throw new Error(
      `Ticket generation incomplete. Expected ${totalNeeded} tickets but found ${allTickets.length}.`
    );
  }

  // ------------------------------------------
  // 11. Email ALL tickets
  // ------------------------------------------
  try {
    console.log(
      `📨 Triggering ticket email for booking ID: ${bookingId}`
    );

    await processAndEmailTicketService(bookingId);

    console.log(
      `✅ Ticket email dispatched for booking ID: ${bookingId}`
    );
  } catch (emailError: any) {
    console.error(
      `❌ Failed to send ticket email for booking ID ${bookingId}:`,
      emailError?.message || emailError
    );
  }

  return allTickets;
};

// ==========================================
// 2. GET TICKET BY ID
// ==========================================
export const getTicketById = async (
  ticketId: number
): Promise<TSelectTicket | undefined> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  return ticket;
};

// ==========================================
// 3. GET TICKET BY TOKEN
// ==========================================
export const getTicketByToken = async (
  ticketToken: string
): Promise<TSelectTicket | undefined> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketToken, ticketToken));

  return ticket;
};

// ==========================================
// 4. GET TICKETS BY BOOKING ID
// ==========================================
export const getTicketsByBookingId = async (
  bookingId: number
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.bookingId, bookingId));
};

// ==========================================
// 5. GET TICKETS BY EVENT ID
// ==========================================
export const getTicketsByEventId = async (
  eventId: number
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.eventId, eventId));
};

// ==========================================
// 6. GET TICKETS BY HOLDER ID
// (refunded tickets are still returned so the app can show a "Refunded" badge)
// ==========================================
export const getTicketsByHolderId = async (
  digitalId: number
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.digitalId, digitalId));
};

// ==========================================
// 7. GET TICKETS BY PURCHASER ID
// ==========================================
export const getTicketsByPurchaserId = async (
  purchaserDigitalId: number
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.purchaserDigitalId, purchaserDigitalId));
};

// ==========================================
// 8. ASSIGN TICKET TO AN ATTENDEE
// ==========================================

type AttendeeInput = { name: string; email: string; phone?: string };

/** Writes one assignment and says whether the attendee should be emailed */
const applyAssignment = async (
  ticket: TSelectTicket,
  attendee: AttendeeInput
): Promise<{ updated: TSelectTicket; shouldEmail: boolean }> => {
  const name = attendee.name?.trim();
  const email = attendee.email?.trim();
  const phone = attendee.phone?.trim() || null;

  if (!name || !email) {
    throw new Error(`Name and email are required to assign ticket ${ticket.ticketId} 📝`);
  }

  const emailChanged =
    (ticket.attendeeEmail ?? "").toLowerCase() !== email.toLowerCase();

  const [updated] = await db
    .update(tickets)
    .set({
      attendeeName: name,
      attendeeEmail: email,
      attendeePhone: phone,
      isAssigned: true,
      ...(emailChanged ? { ticketToken: generateTicketToken() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticket.ticketId))
    .returning();

  return { updated, shouldEmail: emailChanged };
};

export const assignTicket = async (
  ticketId: number,
  attendeeData: { name: string; email: string; phone?: string },
  actorDigitalId?: number
): Promise<TSelectTicket> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  if (!ticket) throw new Error("Ticket not found 🚫");

  assertCanManage(ticket, actorDigitalId);
  assertTicketValid(ticket);

  if (ticket.isScanned) {
    throw new Error("This ticket has already been scanned and can't be changed 🚫");
  }

  const { updated, shouldEmail } = await applyAssignment(ticket, attendeeData);

  if (shouldEmail) {
    const fromName = await getDisplayName(actorDigitalId ?? ticket.digitalId);
    await notifyTicketAttendee(updated.ticketId, "assigned", fromName);
  }

  return updated;
};

// ==========================================
// 9. BULK ASSIGN BUNDLE TICKETS
// ==========================================
export const bulkAssignBundleTickets = async (
  groupBundleId: string,
  assignments: Array<{
    ticketId: number;
    name?: string;
    email?: string;
    phone?: string;
    attendeeName?: string;
    attendeeEmail?: string;
    attendeePhone?: string;
  }>,
  actorDigitalId?: number
): Promise<TSelectTicket[]> => {
  const updatedTickets: TSelectTicket[] = [];
  const toEmail: number[] = [];

  for (const item of assignments) {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.ticketId, item.ticketId),
          eq(tickets.groupBundleId, groupBundleId)
        )
      );

    if (!ticket) continue;

    assertCanManage(ticket, actorDigitalId);
    assertTicketValid(ticket);

    if (ticket.isScanned) {
      throw new Error(`Ticket ${ticket.ticketId} has already been scanned and can't be changed 🚫`);
    }

    const { updated, shouldEmail } = await applyAssignment(ticket, {
      name: (item.name ?? item.attendeeName) as string,
      email: (item.email ?? item.attendeeEmail) as string,
      phone: item.phone ?? item.attendeePhone,
    });

    updatedTickets.push(updated);
    if (shouldEmail) toEmail.push(updated.ticketId);
  }

  if (toEmail.length > 0) {
    const fromName = await getDisplayName(actorDigitalId);
    for (const id of toEmail) {
      await notifyTicketAttendee(id, "assigned", fromName);
    }
  }

  return updatedTickets;
};

// ==========================================
// 10. INITIATE TICKET TRANSFER
// ==========================================
export const initiateTicketTransfer = async (
  ticketId: number,
  holderId: number
): Promise<{ ticket: TSelectTicket; claimToken: string }> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  if (!ticket) throw new Error("Ticket not found 🚫");

  if (ticket.digitalId !== holderId) {
    throw new Error("Unauthorized: You do not own this ticket 🛡️");
  }

  assertTicketValid(ticket);

  if (ticket.isScanned) {
    throw new Error("This ticket has already been scanned and can't be transferred 🚫");
  }

  const claimToken = `CLAIM-${crypto
    .randomBytes(20)
    .toString("hex")
    .toUpperCase()}`;

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
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.claimToken, claimToken));

  if (!ticket) throw new Error("Invalid or expired claim token 🚫");

  assertTicketValid(ticket);

  if (
    ticket.claimTokenExpiresAt &&
    new Date() > new Date(ticket.claimTokenExpiresAt)
  ) {
    throw new Error("This transfer claim link has expired ⌛");
  }

  if (ticket.isScanned) {
    throw new Error("This ticket has already been scanned and can't be claimed 🚫");
  }

  if (ticket.digitalId === newHolderDigitalId) {
    throw new Error("This ticket is already in your account 🎟️");
  }

  const previousHolderId = ticket.digitalId;

  const [claimedTicket] = await db
    .update(tickets)
    .set({
      digitalId: newHolderDigitalId,
      attendeeName: attendeeInfo.name,
      attendeeEmail: attendeeInfo.email,
      attendeePhone: attendeeInfo.phone ?? null,
      isAssigned: true,
      transferStatus: "transferred",
      ticketToken: generateTicketToken(),
      claimToken: null,
      claimTokenExpiresAt: null,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tickets.ticketId, ticket.ticketId),
        eq(tickets.claimToken, claimToken),
        eq(tickets.lifecycleStatus, "Valid")
      )
    )
    .returning();

  if (!claimedTicket) {
    throw new Error("This claim code has already been used or the ticket is no longer valid 🚫");
  }

  const fromName = await getDisplayName(previousHolderId);
  await notifyTicketAttendee(claimedTicket.ticketId, "transferred", fromName);

  return claimedTicket;
};

// ==========================================
// 12. SCAN TICKET AT GATE
// ==========================================
export const scanTicket = async (
  ticketToken: string
): Promise<{
  success: boolean;
  message: string;
  ticket?: TSelectTicket;
}> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketToken, ticketToken));

  if (!ticket) {
    return {
      success: false,
      message: "Ticket token not found or invalid ❌",
    };
  }

  if (ticket.lifecycleStatus !== "Valid") {
    return {
      success: false,
      message:
        ticket.lifecycleStatus === "Refunded"
          ? "This ticket was refunded and is no longer valid 🚫"
          : `This ticket is ${ticket.lifecycleStatus} and can't be used 🚫`,
      ticket,
    };
  }

  if (ticket.isScanned) {
    return {
      success: false,
      message: `Ticket already scanned at gate on ${
        ticket.scannedAt?.toLocaleString() || "previous check-in"
      } ⚠️`,
      ticket,
    };
  }

  const [scannedTicket] = await db
    .update(tickets)
    .set({
      isScanned: true,
      scannedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tickets.ticketId, ticket.ticketId),
        eq(tickets.isScanned, false),
        eq(tickets.lifecycleStatus, "Valid")
      )
    )
    .returning();

  if (!scannedTicket) {
    return {
      success: false,
      message: "Ticket could not be checked in (just scanned or refunded) ⚠️",
    };
  }

  return {
    success: true,
    message: "Ticket verified and checked in successfully ✅🎫",
    ticket: scannedTicket,
  };
};

// ==========================================
// 13. UNASSIGN TICKET
// ==========================================
export const unassignTicket = async (
  ticketId: number,
  ownerId: number
): Promise<TSelectTicket> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  if (!ticket) throw new Error("Ticket not found 🚫");

  assertCanManage(ticket, ownerId);
  assertTicketValid(ticket);

  const [updated] = await db
    .update(tickets)
    .set({
      attendeeName: null,
      attendeeEmail: null,
      attendeePhone: null,
      isAssigned: false,
      transferStatus: "unassigned",
      claimToken: null,
      claimTokenExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return updated;
};

// ==========================================
// 14. GET TICKETS BY BUNDLE ID
// ==========================================
export const getTicketsByBundleId = async (
  groupBundleId: string
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.groupBundleId, groupBundleId));
};

// ==========================================
// 15. COUNT TOTAL TICKETS FOR EVENT
// ==========================================
export const countEventTickets = async (
  eventId: number
): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));

  return result?.count ?? 0;
};

// ==========================================
// 16. COUNT SCANNED ATTENDEES
// ==========================================
export const countScannedAttendees = async (
  eventId: number
): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(tickets)
    .where(
      and(
        eq(tickets.eventId, eventId),
        eq(tickets.isScanned, true)
      )
    );

  return result?.count ?? 0;
};

// ==========================================
// 17. UPDATE TICKET HOLDER
// ==========================================
export const updateTicketHolder = async (
  ticketId: number,
  newDigitalId: number
): Promise<TSelectTicket> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  if (!ticket) throw new Error("Ticket not found 🚫");
  assertTicketValid(ticket);

  const [updated] = await db
    .update(tickets)
    .set({
      digitalId: newDigitalId,
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return updated;
};

// ==========================================
// 18. RESET TICKET SCAN
// ==========================================
export const resetTicketScan = async (
  ticketId: number
): Promise<TSelectTicket> => {
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.ticketId, ticketId));

  if (!ticket) throw new Error("Ticket not found 🚫");
  assertTicketValid(ticket);

  const [updated] = await db
    .update(tickets)
    .set({
      isScanned: false,
      scannedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return updated;
};

// ==========================================
// 19. DELETE TICKET RECORD
// ==========================================
export const deleteTicket = async (ticketId: number): Promise<boolean> => {
  const result = await db
    .delete(tickets)
    .where(eq(tickets.ticketId, ticketId))
    .returning();

  return result.length > 0;
};

// ==========================================
// 20. GET UNASSIGNED USER TICKETS
// ==========================================
export const getUnassignedUserTickets = async (
  digitalId: number
): Promise<TSelectTicket[]> => {
  return await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.digitalId, digitalId),
        eq(tickets.isAssigned, false),
        eq(tickets.lifecycleStatus, "Valid")
      )
    );
};