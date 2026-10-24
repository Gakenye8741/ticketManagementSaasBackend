import dbConn from "../../drizzle/db";
import { bookings as bkTable, tickets as tktTable } from "../../drizzle/schema";
import { eq as dEq } from "drizzle-orm";
import { sendNotificationEmail as sendEmail } from "../../middleware/googleMailer";

// ==========================================
// EMAIL ONE TICKET TO ITS CURRENT ATTENDEE
// ------------------------------------------
// Used when a ticket is:
//   - "assigned"    -> the owner entered this person as the attendee
//   - "transferred" -> this person claimed the ticket with a claim code
//
// The attendee receives a personal link to view the
// ticket and its QR code:  {FRONTEND_URL}/tickets/view/{ticketToken}
// ==========================================

export type SingleTicketEmailReason = "assigned" | "transferred";

/** Names and other user-supplied text must never be inserted into HTML raw */
const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const emailSingleTicketService = async (
  ticketId: number,
  reason: SingleTicketEmailReason,
  options: { fromName?: string } = {}
) => {
  // 1. The ticket (always read fresh, so we email the CURRENT token and attendee)
  const [ticket] = await dbConn
    .select()
    .from(tktTable)
    .where(dEq(tktTable.ticketId, ticketId));

  if (!ticket) throw new Error(`Ticket ${ticketId} not found.`);
  if (!ticket.attendeeEmail) {
    throw new Error(`Ticket ${ticketId} has no attendee email to send to.`);
  }
  if (!ticket.ticketToken) {
    throw new Error(`Ticket ${ticketId} is missing a ticket token.`);
  }

  // 2. Event details, loaded the same way processAndEmailTicketService does.
  //    We also load `items` so a multi-ticket booking can resolve the
  //    correct ticket type for THIS ticket, not the whole booking.
  const booking = await dbConn.query.bookings.findFirst({
    where: dEq(bkTable.bookingId, ticket.bookingId),
    with: {
      event: { with: { venue: true } },
      ticketType: true,
      items: true, // 🆕
    },
  });

  const event = booking?.event;
  if (!booking || !event) {
    throw new Error(`Event details for ticket ${ticketId} could not be loaded.`);
  }

  // 🆕 Resolve the ticket type that belongs to THIS ticket.
  //    Priority:
  //      1. ticket.ticketTypeName       (snapshot written when the ticket was generated)
  //      2. match ticket.bookingItemId  → booking.items[].ticketTypeName
  //      3. match ticket.ticketTypeId   → booking.items[].ticketTypeName
  //      4. legacy booking.ticketType.name (single-type / older bookings)
  //      5. "General"
  const resolveTicketTypeName = (): string => {
    if (ticket.ticketTypeName) return ticket.ticketTypeName;

    const items = Array.isArray(booking.items) ? booking.items : [];

    if (ticket.bookingItemId != null) {
      const match = items.find(
        (i) => Number(i.bookingItemId) === Number(ticket.bookingItemId)
      );
      if (match?.ticketTypeName) return match.ticketTypeName;
    }

    if (ticket.ticketTypeId != null) {
      const match = items.find(
        (i) => Number(i.ticketTypeId) === Number(ticket.ticketTypeId)
      );
      if (match?.ticketTypeName) return match.ticketTypeName;
    }

    return booking.ticketType?.name ?? "General";
  };

  const venue = event.venue;
  const venueName = venue
    ? `${venue.name}, ${venue.address}`
    : event.category || "Laikipia University Grounds";
  const eventDateTime = `${event.date} @ ${event.time}`;
  const tierName = resolveTicketTypeName(); // 🆕 per-ticket type

  // 3. The link the attendee clicks
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const ticketViewUrl = `${frontendUrl}/tickets/view/${ticket.ticketToken}`;

  // 4. Wording
  const attendeeName = ticket.attendeeName || "there";
  const firstName = attendeeName.split(" ")[0] || "there";
  const from = options.fromName ? esc(options.fromName) : "Someone";

  const subject =
    reason === "assigned"
      ? `A ticket for ${event.title} has been assigned to you`
      : `You received a ticket for ${event.title}`;

  const intro =
    reason === "assigned"
      ? `${from} has assigned a ticket for <strong>${esc(event.title)}</strong> to you.`
      : `${from} has transferred a ticket for <strong>${esc(event.title)}</strong> to you. The ticket is now yours.`;

  const plainText =
    reason === "assigned"
      ? `A ticket for ${event.title} has been assigned to you. View it here: ${ticketViewUrl}`
      : `A ticket for ${event.title} has been transferred to you. View it here: ${ticketViewUrl}`;

  // 5. Email body
  const htmlContent = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#f4f4f5;padding:30px;color:#18181b;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">

        <div style="background:#4f46e5;color:#ffffff;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:20px;text-transform:uppercase;letter-spacing:1px;">TicketStream Verified Pass</h1>
          <p style="margin:4px 0 0;font-size:12px;opacity:0.8;">
            ${reason === "assigned" ? "A ticket was assigned to you" : "A ticket was transferred to you"}
          </p>
        </div>

        <div style="padding:24px;">
          <p style="font-size:14px;margin-top:0;">Hello <strong>${esc(firstName)}</strong>,</p>
          <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${intro} Your secure gate pass is ready.</p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:20px 0;">
            <h2 style="margin:0 0 10px;font-size:16px;color:#1e293b;text-transform:uppercase;">${esc(event.title)}</h2>
            <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>📅 Date &amp; Time:</strong> ${esc(eventDateTime)}</p>
            <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>📍 Venue:</strong> ${esc(venueName)}</p>
            <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>🎟️ Ticket Tier:</strong> ${esc(tierName)}</p>
            <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>🎫 Ticket Number:</strong> ${esc(ticket.ticketNumber || `#${ticket.ticketId}`)}</p>
            <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>👤 Attendee:</strong> ${esc(attendeeName)}</p>
          </div>

          <div style="text-align:center;margin:26px 0 12px;">
            <a href="${ticketViewUrl}" target="_blank"
               style="background-color:#4f46e5;color:#ffffff;padding:12px 22px;font-size:13px;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">
              🎟️ View My Ticket &amp; QR
            </a>
          </div>

          <p style="font-size:10px;color:#94a3b8;font-family:monospace;margin:8px 0 0;word-break:break-all;text-align:center;">${ticketViewUrl}</p>

          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-top:20px;">
            <p style="margin:0;font-size:11px;color:#713f12;line-height:1.5;">
              🔐 Keep this link private. The QR code on it is your admission ticket and can only be used once.
            </p>
          </div>

          <p style="font-size:12px;color:#71717a;text-align:center;margin-top:30px;border-top:1px solid #e4e4e7;padding-top:16px;">
            Thank you for using TicketStream Systems.
          </p>
        </div>
      </div>
    </div>
  `;

  // 6. Send
  console.log(`📧 Sending ${reason} ticket ${ticketId} (${tierName}) to ${ticket.attendeeEmail}...`);

  const sent = await sendEmail(ticket.attendeeEmail, subject, firstName, plainText, htmlContent);

  if (!sent) {
    throw new Error(`Failed to dispatch ${reason} ticket email to ${ticket.attendeeEmail}.`);
  }

  console.log(`✅ ${reason} ticket ${ticketId} (${tierName}) emailed to ${ticket.attendeeEmail}.`);

  return { ticketId, email: ticket.attendeeEmail, ticketViewUrl };
};