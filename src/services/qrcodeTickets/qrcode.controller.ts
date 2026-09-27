import { Request, Response } from "express";
import { 
  findTicketByTokenService, 
  markTicketAsScannedService, 
  fetchUserActiveTicketsService,
  issueTicketsAndQrsService,
  generateQrCodeDataUrl,
  getTicketStatsService,
  getScanProgressService
} from "./qrcode.service"; // 👈 Maps smoothly to your unified service file

/**
 * 🎟️ 1. Gate Validation Scanner Controller
 * POST /api/v1/tickets/verify
 * 
 * Invoked by gate screening cameras. Checks authenticity, enforces strict single-entry guards, 
 * and writes the scan timestamp transaction straight back to Postgres.
 */
export const verifyTicketGatePass = async (req: Request, res: Response): Promise<void> => {
  const { ticketToken } = req.body;

  console.log("🔍 [GATE PASS] Processing validation token via scanning terminal...");

  if (!ticketToken || typeof ticketToken !== "string") {
    res.status(400).json({ 
      valid: false, 
      message: "Access Denied: Missing or corrupted barcode payload format." 
    });
    return;
  }

  try {
    // A. Query database with active relational bridges
    const ticket = await findTicketByTokenService(ticketToken);

    // B. Check signature authenticity
    if (!ticket) {
      console.warn(`❌ [VALIDATION FAILURE] Unissued token signature presented: ${ticketToken}`);
      res.status(404).json({ 
        valid: false, 
        message: "Invalid Pass: Ticket code does not match any records in the master database." 
      });
      return;
    }

    // C. Check for past reuse (Double Entry Prevention)
    if (ticket.isScanned || (ticket as any).scannedAt) {
      const scanTime = (ticket as any).scannedAt ? new Date((ticket as any).scannedAt).toLocaleTimeString() : "N/A";
      console.warn(`⚠️ [DOUBLE-ENTRY ALERt] Ticket ID #${ticket.ticketId} rejected. Already used at ${scanTime}`);
      
      res.status(400).json({
        valid: false,
        message: "Access Denied: This ticket has already been scanned at the gate.",
        ticketDetails: {
          id: ticket.ticketId,
          holder: `${ticket.user?.firstName || "Guest"} ${ticket.user?.lastName || ""}`.trim(),
          eventName: (ticket as any).event?.title || "Event",
          scannedAtTime: scanTime
        }
      });
      return;
    }

    // D. Mark as used instantly
    const [updatedTicket] = await markTicketAsScannedService(ticket.ticketId);

    console.log(`✅ [GATE ACCESS GRANTED] Ticket #${ticket.ticketId} authorized for ${ticket.user?.firstName || "Attendee"}`);

    res.status(200).json({
      valid: true,
      message: "Welcome! Access Granted.",
      ticketDetails: {
        id: updatedTicket.ticketId,
        holderName: `${ticket.user?.firstName || "Guest"} ${ticket.user?.lastName || ""}`.trim(),
        eventName: (ticket as any).event?.title || "Event",
        validatedAt: updatedTicket.scannedAt
      }
    });

  } catch (error: any) {
    console.error("❌ Gate verification operational fault:", error);
    res.status(500).json({ 
      valid: false, 
      message: "Internal Server Error: Failed to resolve validation transaction.",
      error: error.message 
    });
  }
};

/**
 * 📱 2. In-App Mobile Wallet Sync Controller
 * GET /api/v1/tickets/my-passes/:nationalId
 * 
 * Compiles and ships active ticket tokens directly to your React Native application layout.
 */
export const getUserActiveWalletPasses = async (req: Request, res: Response): Promise<void> => {
  const nationalId = Array.isArray(req.params.nationalId) ? req.params.nationalId[0] : req.params.nationalId;
  const targetId = parseInt(nationalId, 10);

  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid identity parameter format parsed." });
    return;
  }

  try {
    console.log(`📱 [WALLET SYNC] Syncing active items for holder ID: ${targetId}`);
    
    const userPasses = await fetchUserActiveTicketsService(targetId);

    // Dynamic enhancement: inject a live Base64 QR image layer into each pass 
    // so the phone UI doesn't have to calculate images locally!
    const enhancedPasses = await Promise.all(
      userPasses.map(async (ticket) => {
        const qrDataUrl = await generateQrCodeDataUrl(ticket.ticketToken);
        return {
          ...ticket,
          qrDataUrl // Ready for image source binding on mobile clients
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enhancedPasses.length,
      passes: enhancedPasses
    });

  } catch (error: any) {
    console.error("❌ Mobile Wallet compilation fault:", error);
    res.status(500).json({ error: "Failed to compile active digital ticket passes." });
  }
};

/**
 * 🛠️ 3. Direct Ticket Issuance Controller (Ad-hoc manual creation / testing tool)
 * POST /api/v1/tickets/issue
 */
export const manualIssueTickets = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, eventId, nationalId, quantity } = req.body;

  if (!bookingId || !eventId || !nationalId || !quantity) {
    res.status(400).json({ error: "Missing parameters required for generation payload execution." });
    return;
  }

  try {
    console.log(`🛠️ [MANUAL ISSUE] Compiling ${quantity} dynamic voucher(s) for user #${nationalId}`);
    
    const assetPayload = await issueTicketsAndQrsService(bookingId, eventId, nationalId, quantity);
    
    res.status(201).json({
      success: true,
      message: "Successfully provisioned tickets and corresponding scannable media assets.",
      data: assetPayload
    });
  } catch (error: any) {
    console.error("❌ Ticket manual processing failure:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📊 4. Event Statistics Controller
 * GET /api/v1/tickets/stats/:eventId
 * * Provides real-time attendance data: Total issued, current check-ins, 
 * and percentage of completion for the event.
 */

export const getEventTicketStatistics = async (req: Request, res: Response): Promise<void> => {
  // Normalize the parameter to a single string
  const rawEventId = req.params.eventId;
  const eventId = Array.isArray(rawEventId) ? rawEventId[0] : rawEventId;
  
  const targetEventId = parseInt(eventId, 10);

  if (isNaN(targetEventId)) {
    res.status(400).json({ error: "Invalid event ID format provided." });
    return;
  }

  try {
    // A. Fetch both stats and progress concurrently for speed
    const [stats, percentage] = await Promise.all([
      getTicketStatsService(targetEventId),
      getScanProgressService(targetEventId)
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        percentageCompleted: parseFloat(percentage.toFixed(2)) // Clean 2-decimal format
      }
    });
  } catch (error: any) {
    console.error("❌ Stats compilation fault:", error);
    res.status(500).json({ error: "Failed to retrieve event attendance statistics." });
  }
};