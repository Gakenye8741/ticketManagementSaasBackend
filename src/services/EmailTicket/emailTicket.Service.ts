import dbConn from "../../drizzle/db";
import {
  bookings as bkTable,
  events as evTable,
  venues as vnTable,
  ticketTypes as ttTable,
  users as usrTable,
  payments as payTable,
  tickets as tktTable,
} from "../../drizzle/schema";
import { eq as dEq } from "drizzle-orm";
import { sendNotificationEmail as sendEmail } from "../../middleware/googleMailer";

export const processAndEmailTicketService = async (bookingId: number) => {
  // ==========================================
  // 1. Fetch the booking with ALL related data
  // ==========================================
  const bookingRecord = await dbConn.query.bookings.findFirst({
    where: dEq(bkTable.bookingId, bookingId),

    with: {
      event: {
        with: {
          venue: true,
        },
      },

      ticketType: true,
      user: true,
      payments: true,

      // Get ALL tickets belonging to this booking.
      tickets: true,
    },
  });

  if (!bookingRecord) {
    throw new Error(`Booking with ID ${bookingId} not found.`);
  }

  const event = bookingRecord.event;
  const venue = event?.venue;
  const ticketType = bookingRecord.ticketType;
  const user = bookingRecord.user;

  // Get the latest payment record.
  const payment =
    bookingRecord.payments && bookingRecord.payments.length > 0
      ? bookingRecord.payments[bookingRecord.payments.length - 1]
      : undefined;

  // ==========================================
  // 2. Resolve primary booking recipient
  // ==========================================
  const bookingEmail = user?.email || bookingRecord.guestEmail;

  const bookingFirstName =
    user?.firstName ||
    (bookingRecord.guestName
      ? bookingRecord.guestName.split(" ")[0]
      : "Valued");

  const bookingLastName =
    user?.lastName ||
    (bookingRecord.guestName
      ? bookingRecord.guestName.split(" ").slice(1).join(" ")
      : "Guest");

  // ==========================================
  // 3. Validate required booking information
  // ==========================================
  if (!event || !ticketType || !bookingEmail) {
    throw new Error(
      "Incomplete booking relations (Event, TicketType, or Guest/User Contact missing)."
    );
  }

  // ==========================================
  // 4. Get ALL tickets for this booking
  // ==========================================
  const bookingTickets = bookingRecord.tickets || [];

  const expectedQuantity = Number(bookingRecord.quantity);
  const actualTicketCount = bookingTickets.length;

  console.log(
    `🎟️ Preparing emails for booking ${bookingId}: ` +
      `${actualTicketCount}/${expectedQuantity} ticket(s) found.`
  );

  // Do not send incomplete ticket emails.
  if (actualTicketCount < expectedQuantity) {
    throw new Error(
      `Cannot send ticket emails for booking ${bookingId}. ` +
        `Expected ${expectedQuantity} ticket(s), but only ${actualTicketCount} exist.`
    );
  }

  if (actualTicketCount === 0) {
    throw new Error(
      `No tickets found for confirmed booking ${bookingId}.`
    );
  }

  // ==========================================
  // 5. Frontend URL
  // ==========================================
  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");

  // ==========================================
  // 6. Event/payment information
  // ==========================================
  const venueName = venue
    ? `${venue.name}, ${venue.address}`
    : event.category || "Laikipia University Grounds";

  const eventDateTime = `${event.date} @ ${event.time}`;

  const totalAmountFormatted = Number(
    bookingRecord.totalAmount
  ).toLocaleString("en-KE");

  // ==========================================
  // 7. Build ticket information
  // ==========================================
  //
  // Every ticket now has its own:
  //
  // attendeeName
  // attendeeEmail
  // ticketToken
  // ticketNumber
  //
  // Each attendee will receive ONLY their own ticket.
  //
  const ticketLinks = bookingTickets.map((ticket, index) => {
    if (!ticket.ticketToken) {
      throw new Error(
        `Ticket ${ticket.ticketId} for booking ${bookingId} is missing a ticket token.`
      );
    }

    const ticketViewUrl = `${frontendUrl}/tickets/view/${ticket.ticketToken}`;

    return {
      ticket,
      index: index + 1,
      ticketViewUrl,
    };
  });

  // ==========================================
  // 8. Send individual email to EACH attendee
  // ==========================================
  const emailResults: Array<{
    ticketId: number;
    email: string;
    success: boolean;
    ticketViewUrl: string;
  }> = [];

  for (const { ticket, index, ticketViewUrl } of ticketLinks) {
    // ------------------------------------------
    // Resolve attendee email
    // ------------------------------------------
    //
    // Prefer the email stored on the individual
    // ticket.
    //
    // If it does not exist, fall back to the
    // primary booking email.
    //
    const attendeeEmail =
      (ticket as any).attendeeEmail ||
      bookingEmail;

    const attendeeName =
      (ticket as any).attendeeName ||
      bookingRecord.guestName ||
      `${bookingFirstName} ${bookingLastName}`;

    const attendeeFirstName =
      attendeeName.split(" ")[0] || bookingFirstName;

    // ------------------------------------------
    // Build individual attendee email
    // ------------------------------------------
    const individualTicketHtml = `
      <div
        style="
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 18px;
          margin: 16px 0;
        "
      >
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          "
        >
          <div>
            <h3
              style="
                margin: 0;
                font-size: 15px;
                color: #1e293b;
              "
            >
              🎟️ Your Ticket
            </h3>

            <p
              style="
                margin: 4px 0 0;
                font-size: 11px;
                color: #64748b;
              "
            >
              ${(ticket as any).ticketNumber || `Ticket ${index}`}
            </p>
          </div>

          <span
            style="
              background: #eef2ff;
              color: #4f46e5;
              padding: 5px 9px;
              border-radius: 999px;
              font-size: 10px;
              font-weight: bold;
            "
          >
            VALID PASS
          </span>
        </div>

        <p
          style="
            font-size: 12px;
            color: #475569;
            margin: 8px 0;
          "
        >
          <strong>Holder:</strong>
          ${attendeeName}
        </p>

        <p
          style="
            font-size: 12px;
            color: #475569;
            margin: 8px 0;
          "
        >
          <strong>Ticket:</strong>
          ${index} of ${expectedQuantity}
        </p>

        <div style="text-align: center; margin: 22px 0 12px;">
          <a
            href="${ticketViewUrl}"
            target="_blank"
            style="
              background-color: #4f46e5;
              color: #ffffff;
              padding: 12px 22px;
              font-size: 13px;
              font-weight: bold;
              text-decoration: none;
              border-radius: 8px;
              display: inline-block;
            "
          >
            🎟️ View My Ticket & QR
          </a>
        </div>

        <p
          style="
            font-size: 10px;
            color: #94a3b8;
            font-family: monospace;
            margin: 8px 0 0;
            word-break: break-all;
            text-align: center;
          "
        >
          ${ticketViewUrl}
        </p>
      </div>
    `;

    // ==========================================
    // Complete individual email HTML
    // ==========================================
    const htmlContent = `
      <div
        style="
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #f4f4f5;
          padding: 30px;
          color: #18181b;
        "
      >
        <div
          style="
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          "
        >

          <!-- Header -->
          <div
            style="
              background: #4f46e5;
              color: #ffffff;
              padding: 24px;
              text-align: center;
            "
          >
            <h1
              style="
                margin: 0;
                font-size: 20px;
                text-transform: uppercase;
                letter-spacing: 1px;
              "
            >
              TicketStream Verified Pass
            </h1>

            <p
              style="
                margin: 4px 0 0;
                font-size: 12px;
                opacity: 0.8;
              "
            >
              Official Payment & Booking Confirmation
            </p>
          </div>

          <!-- Body -->
          <div style="padding: 24px;">

            <p
              style="
                font-size: 14px;
                margin-top: 0;
              "
            >
              Hello
              <strong>${attendeeFirstName}</strong>,
            </p>

            <p
              style="
                font-size: 14px;
                color: #3f3f46;
                line-height: 1.6;
              "
            >
              Your ticket for
              <strong>${event.title}</strong>
              has been successfully confirmed.
              Your secure gate pass is ready.
            </p>

            <!-- Event Details -->
            <div
              style="
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 16px;
                margin: 20px 0;
              "
            >
              <h2
                style="
                  margin: 0 0 10px;
                  font-size: 16px;
                  color: #1e293b;
                  text-transform: uppercase;
                "
              >
                ${event.title}
              </h2>

              <p
                style="
                  margin: 4px 0;
                  font-size: 13px;
                  color: #475569;
                "
              >
                <strong>📅 Date & Time:</strong>
                ${eventDateTime}
              </p>

              <p
                style="
                  margin: 4px 0;
                  font-size: 13px;
                  color: #475569;
                "
              >
                <strong>📍 Venue:</strong>
                ${venueName}
              </p>

              <p
                style="
                  margin: 4px 0;
                  font-size: 13px;
                  color: #475569;
                "
              >
                <strong>🎟️ Ticket Tier:</strong>
                ${ticketType.name}
              </p>

              <p
                style="
                  margin: 4px 0;
                  font-size: 13px;
                  color: #475569;
                "
              >
                <strong>🎫 Ticket Number:</strong>
                ${(ticket as any).ticketNumber || `Ticket ${index}`}
              </p>

              <p
                style="
                  margin: 4px 0;
                  font-size: 13px;
                  color: #475569;
                  word-break: break-all;
                "
              >
                <strong>🆔 Transaction ID:</strong>
                #${payment?.transactionId || "N/A"}
              </p>
            </div>

            <!-- Individual Ticket -->
            <div style="margin-top: 24px;">

              <h2
                style="
                  font-size: 17px;
                  color: #1e293b;
                  margin-bottom: 8px;
                "
              >
                🎟️ Your Ticket
              </h2>

              <p
                style="
                  font-size: 12px;
                  color: #64748b;
                  margin-top: 0;
                  line-height: 1.5;
                "
              >
                This ticket belongs to you.
                Keep your ticket link secure and present
                the QR code at the gate.
              </p>

              ${individualTicketHtml}

            </div>

            <!-- Security Notice -->
            <div
              style="
                background: #fefce8;
                border: 1px solid #fde68a;
                border-radius: 10px;
                padding: 12px;
                margin-top: 20px;
              "
            >
              <p
                style="
                  margin: 0;
                  font-size: 11px;
                  color: #713f12;
                  line-height: 1.5;
                "
              >
                🔐 Keep your ticket link secure.
                This QR code represents your individual
                admission ticket and can only be used once.
              </p>
            </div>

            <!-- Footer -->
            <p
              style="
                font-size: 12px;
                color: #71717a;
                text-align: center;
                margin-top: 30px;
                border-top: 1px solid #e4e4e7;
                padding-top: 16px;
              "
            >
              Thank you for using TicketStream Systems.
              Keep your ticket secure for gate admission.
            </p>

          </div>
        </div>
      </div>
    `;

    // ==========================================
    // Send email to this attendee
    // ==========================================
    console.log(
      `📧 Sending ticket ${index}/${expectedQuantity} ` +
        `to ${attendeeEmail} for booking ${bookingId}...`
    );

    const emailSent = await sendEmail(
      attendeeEmail,
      `Your Ticket: ${event.title}`,
      attendeeFirstName,
      `Your ticket for ${event.title} has been confirmed. Your secure gate-pass link is ready.`,
      htmlContent
    );

    if (!emailSent) {
      console.error(
        `❌ Failed to send ticket ${index} email to ${attendeeEmail}`
      );

      emailResults.push({
        ticketId: ticket.ticketId,
        email: attendeeEmail,
        success: false,
        ticketViewUrl,
      });

      throw new Error(
        `Failed to dispatch ticket email to ${attendeeEmail} for ticket ${ticket.ticketId}.`
      );
    }

    emailResults.push({
      ticketId: ticket.ticketId,
      email: attendeeEmail,
      success: true,
      ticketViewUrl,
    });

    console.log(
      `✅ Ticket ${index}/${expectedQuantity} email sent to ${attendeeEmail}.`
    );
  }

  // ==========================================
  // 9. Final result
  // ==========================================
  console.log(
    `✅ All ${bookingTickets.length} ticket email(s) sent successfully ` +
      `for booking ${bookingId}.`
  );

  return {
    message: "All attendee ticket emails dispatched successfully!",
    bookingId,
    ticketCount: bookingTickets.length,
    emailsSent: emailResults.length,
    emailResults,
    ticketLinks: ticketLinks.map((item) => item.ticketViewUrl),
  };
};