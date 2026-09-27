import { sendNotificationEmail } from "./googleMailer";

// 🚀 Structuring the incoming QR asset item
export interface QrCodeAsset {
  ticketId: number;
  ticketToken: string;
  qrDataUrl: string; 
}

export interface TicketInfo {
  email: string;
  firstName: string;
  lastName: string;
  nationalId: number;
  eventName: string;
  ticketType: string;
  quantity: number;
  price: number;
  total: number;
  paymentStatus: "Completed" | "Pending" | "Failed" | "Confirmed";
  bookingDate: Date;
  qrCodes?: QrCodeAsset[]; // 🎯 Updated to 'qrCodes' to match test runner
}

export const sendTicket = async (ticket: TicketInfo): Promise<boolean> => {
  try {
    const subject = `🎟 Your Ticket for ${ticket.eventName} is Confirmed`;
    
    // Use 'qrCodes' as the source of truth
    const activeQrCodes = ticket.qrCodes || [];

    const plainQrTicketsText = activeQrCodes
      .map((t, idx) => `[Gate Pass ${idx + 1} of ${ticket.quantity}] - Ticket ID: #${t.ticketId}\nToken String: ${t.ticketToken}`)
      .join("\n\n");

    const plainMessage = `
${ticket.eventName}
Name: ${ticket.firstName} ${ticket.lastName}
National ID: ${ticket.nationalId}
Ticket Type: ${ticket.ticketType}
Quantity: ${ticket.quantity}
Price per ticket: KSH ${ticket.price.toFixed(2)}
Total: KSH ${ticket.total.toFixed(2)}
Payment Status: ${ticket.paymentStatus}
Booking Date: ${new Date(ticket.bookingDate).toLocaleString()}

--- GATE PASSES ---
${activeQrCodes.length > 0 ? plainQrTicketsText : "No QR passes generated."}
`.trim();

    const htmlQrPassesMarkup = activeQrCodes
      .map((t, idx) => `
        <div style="border: 2px dashed #2c3e50; background-color: #ffffff; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
          <h3 style="margin-top: 0; color: #2c3e50; font-size: 16px;">Gate Pass ${idx + 1} of ${ticket.quantity}</h3>
          <p style="font-size: 13px; color: #555555; margin: 4px 0;"><strong>Ticket ID:</strong> #${t.ticketId}</p>
          <img src="${t.qrDataUrl}" alt="Gate Pass QR Scan" style="width: 220px; height: 220px; margin: 15px auto; display: block;" />
          <p style="font-size: 11px; color: #777777; font-family: monospace; word-break: break-all;">${t.ticketToken}</p>
        </div>
      `).join("");

    const htmlMessage = `
<div style="max-width:600px; margin:auto; font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
  <h2 style="color: #2c3e50;">🎟 ${ticket.eventName}</h2>
  <p><strong>Name:</strong> ${ticket.firstName} ${ticket.lastName}</p>
  <p><strong>Payment Status:</strong> ${ticket.paymentStatus}</p>
  <hr />
  ${activeQrCodes.length > 0 ? htmlQrPassesMarkup : `<p>Digital gate pass codes are pending.</p>`}
</div>
`;

    return await sendNotificationEmail(ticket.email, subject, ticket.firstName, plainMessage, htmlMessage);
  } catch (error) {
    console.error("❌ sendTicket error:", error);
    return false;
  }
};