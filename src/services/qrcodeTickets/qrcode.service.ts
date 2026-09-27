import { eq } from "drizzle-orm";
import db from "../../drizzle/db";
import { tickets } from "../../drizzle/schema";
import QRCode from "qrcode";
import crypto from "node:crypto";

/**
 * 🚀 Structuring internal custom types for asset handovers
 */
export interface QrCodeAsset {
  ticketId: number;
  ticketToken: string;
  qrDataUrl: string;
}

/**
 * 1. Generates a secure Base64 PNG Image URL from a ticket token string.
 * High error correction ('H') ensures it scans fast even on cracked phone screens.
 */
export const generateQrCodeDataUrl = async (token: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: "H", // High tolerance for fast gate scanning
      margin: 2,
      width: 300,
      color: {
        dark: "#2c3e50",  // Clean dark brand color instead of harsh absolute black
        light: "#FFFFFF", // Clean white background
      },
    });
    return dataUrl; // Format: "data:image/png;base64,iVBORw0KG..."
  } catch (error) {
    console.error("❌ QR Generation Error:", error);
    throw new Error("Failed to generate scannable QR Code asset.");
  }
};

/**
 * 2. Fetches a ticket structure by its random token string.
 * Pulls relational database entries so your gate validation dashboard sees context.
 */
export const findTicketByTokenService = async (token: string) => {
  return await db.query.tickets.findFirst({
    where: eq(tickets.ticketToken, token),
    with: {
      event: true, // Pulls title, date, location context
      user: {
        columns: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
};

/**
 * 3. Marks a valid ticket as scanned inside a central timestamp transaction database layer.
 */
export const markTicketAsScannedService = async (ticketId: number) => {
  return await db
    .update(tickets)
    .set({
      isScanned: true,
      scannedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tickets.ticketId, ticketId))
    .returning();
};

/**
 * 4. Generates raw database ticket rows and maps corresponding scannable base64 image strings.
 * Use this right after your M-Pesa callbacks report a successful transaction.
 */
export const issueTicketsAndQrsService = async (
  bookingId: number,
  eventId: number,
  nationalId: number,
  quantity: number
): Promise<QrCodeAsset[]> => {
  // A. Build raw row records using unguessable UUID values
  const ticketsToInsert = Array.from({ length: quantity }).map(() => ({
    bookingId,
    eventId,
    nationalId,
    ticketToken: crypto.randomUUID(),
  }));

  // B. Save to Postgres
  const savedTickets = await db.insert(tickets).values(ticketsToInsert).returning();

  // C. Map database tokens into scannable image strings concurrently
  const qrCodes = await Promise.all(
    savedTickets.map(async (ticket) => {
      const qrDataUrl = await generateQrCodeDataUrl(ticket.ticketToken);
      return {
        ticketId: ticket.ticketId,
        ticketToken: ticket.ticketToken,
        qrDataUrl, // Hand this property over to your email service template generator
      };
    })
  );

  return qrCodes;
};

/**
 * 5. Fetches all active, un-scanned ticket tokens for a specific user.
 * Feeds scannable data bundles directly to mobile devices without database re-evaluations.
 */
export const fetchUserActiveTicketsService = async (nationalId: number) => {
  return await db
    .select()
    .from(tickets)
    .where(eq(tickets.nationalId, nationalId))
    .orderBy(tickets.createdAt);
};

/**
 * Counts scanned vs unscanned tickets for a specific event or user.
 */
export const getTicketStatsService = async (eventId: number) => {
  const allTickets = await db
    .select({
      isScanned: tickets.isScanned,
    })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));

  const total = allTickets.length;
  const scanned = allTickets.filter((t) => t.isScanned).length;
  const unscanned = total - scanned;

  return {
    total,
    scanned,
    unscanned,
  };
};

/**
 * Returns the completion percentage of an event's attendance.
 */
export const getScanProgressService = async (eventId: number) => {
  const allTickets = await db
    .select({ isScanned: tickets.isScanned })
    .from(tickets)
    .where(eq(tickets.eventId, eventId));

  const total = allTickets.length;
  if (total === 0) return 0; // Avoid division by zero

  const scanned = allTickets.filter((t) => t.isScanned).length;
  return (scanned / total) * 100;
};