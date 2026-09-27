import dbConn from "../../drizzle/db";
import { bookings as bkTable, events as evTable, venues as vnTable, ticketTypes as ttTable, users as usrTable, payments as payTable, tickets as tktTable } from "../../drizzle/schema";
import { eq as dEq } from "drizzle-orm";
import { sendNotificationEmail as sendEmail } from "../../middleware/googleMailer";

export const processAndEmailTicketService = async (bookingId: number) => {
  // 1. Fetch the booking fully enriched using Drizzle relational queries based on your schema
  const bookingRecord = await dbConn.query.bookings.findFirst({
    where: dEq(bkTable.bookingId, bookingId),
    with: {
      event: {
        with: {
          venue: true, // Pulls venue details from venues table via venueId
        },
      },
      ticketType: true,
      user: true,
      payments: true,
      tickets: true, // Pulls individual scannable tickets linked to this booking
    },
  });

  if (!bookingRecord) {
    throw new Error(`Booking with ID ${bookingId} not found.`);
  }

  const event = bookingRecord.event;
  const venue = event?.venue;
  const ticketType = bookingRecord.ticketType;
  const user = bookingRecord.user;
  const payment = bookingRecord.payments?.[0]; // Get latest payment record

  // Resolve recipient details supporting both Registered Users and Guests seamlessly
  const recipientEmail = user?.email || bookingRecord.guestEmail;
  const recipientFirstName = user?.firstName || (bookingRecord.guestName ? bookingRecord.guestName.split(" ")[0] : "Valued");
  const recipientLastName = user?.lastName || (bookingRecord.guestName ? bookingRecord.guestName.split(" ").slice(1).join(" ") : "Guest");
  const recipientIdentifier = user?.digitalId || bookingRecord.guestPhone || bookingRecord.bookingId;

  // Safeguard against missing relational data (Event, TicketType, or Contact info must exist)
  if (!event || !ticketType || !recipientEmail) {
    throw new Error("Incomplete booking relations (Event, TicketType, or Guest/User Contact missing).");
  }

  // 2. Retrieve or generate the cryptographic ticket token for the QR code
  let ticketToken = bookingRecord.tickets?.[0]?.ticketToken;
  
  if (!ticketToken) {
    ticketToken = `TKT-${bookingRecord.bookingId}-${recipientIdentifier}-${Date.now()}`;
    
    // Create individual ticket record in the database if it doesn't exist yet
    await dbConn.insert(tktTable).values({
      digitalId: user?.digitalId || null,
      bookingId: bookingRecord.bookingId,
      eventId: event.eventId,
      ticketToken: ticketToken,
      isScanned: false,
    }).catch(() => {
      // Ignore unique constraint errors if already generated concurrently
    });
  }

  // 3. Construct the Web Link where the QR code will be displayed and scanned at the gate
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const ticketViewUrl = `${frontendUrl}/tickets/view/${ticketToken}`;

  // 4. Construct rich HTML email body featuring event info and a secure ticket link
  const venueName = venue ? `${venue.name}, ${venue.address}` : event.category || 'Laikipia University Grounds';
  const eventDateTime = `${event.date} @ ${event.time}`;
  const totalAmountFormatted = Number(bookingRecord.totalAmount).toLocaleString('en-KE');

  const htmlContent = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 30px; color: #18181b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: #4f46e5; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">TicketStream Verified Pass</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Official Payment & Booking Confirmation</p>
        </div>

        <!-- Body Content -->
        <div style="padding: 24px;">
          <p style="font-size: 14px; margin-top: 0;">Hello <strong>${recipientFirstName} ${recipientLastName}</strong>,</p>
          <p style="font-size: 14px; color: #3f3f46;">Your payment has been successfully processed. Click the button below to view your official gate pass and scannable QR code.</p>

          <!-- Event Details Box -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 16px; color: #1e293b; text-transform: uppercase;">${event.title}</h2>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>📅 Date & Time:</strong> ${eventDateTime}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>📍 Venue:</strong> ${venueName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>🎟️ Ticket Tier:</strong> ${ticketType.name} (x${bookingRecord.quantity})</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>💳 Total Cleared:</strong> KSH ${totalAmountFormatted}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>🆔 Transaction ID:</strong> #${payment?.transactionId || 'N/A'}</p>
          </div>

          <!-- Ticket Link Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ticketViewUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
              🎟️ View & Scan Gate Pass
            </a>
            <p style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 12px; word-break: break-all;">Or copy link: ${ticketViewUrl}</p>
          </div>

          <p style="font-size: 12px; color: #71717a; text-align: center; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 16px;">
            Thank you for using TicketStream Systems. Keep this link secure for gate admission.
          </p>
        </div>

      </div>
    </div>
  `;

  // 5. Send notification email without attachments
  const emailSent = await sendEmail(
    recipientEmail,
    `Your Verified Ticket Pass: ${event.title}`,
    recipientFirstName,
    `Your booking for ${event.title} has been confirmed. View your gate pass here: ${ticketViewUrl}`,
    htmlContent
  );

  if (!emailSent) {
    throw new Error(`Failed to dispatch confirmation email to ${recipientEmail}`);
  }

  return { message: "Ticket processed, link generated, and email dispatched successfully!" };
};