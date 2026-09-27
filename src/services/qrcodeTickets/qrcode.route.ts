import { Router } from "express";
import { 
  verifyTicketGatePass, 
  getUserActiveWalletPasses, 
  manualIssueTickets,
  getEventTicketStatistics // 👈 Imported the new controller
} from "./qrcode.controller";
import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

const qrTicketRoutes = Router();

/**
 * 🎟️ 1. Gate Validation Scanner Route
 */
qrTicketRoutes.post(
  "/verify", 
  adminAuth, 
  verifyTicketGatePass
);

/**
 * 📱 2. In-App Mobile Wallet Sync Route
 */
qrTicketRoutes.get(
  "/my-passes/:nationalId", 
  anyAuthenticatedUser, 
  getUserActiveWalletPasses
);

/**
 * 🛠️ 3. Direct Manual Ticket Issuance Route
 */
qrTicketRoutes.post(
  "/issue", 
  adminAuth, 
  manualIssueTickets
);

/**
 * 📊 4. Event Statistics Route
 * GET /api/v1/tickets/stats/:eventId
 * Access: Restricted to Admins to monitor real-time gate progress.
 */
qrTicketRoutes.get(
  "/stats/:eventId",
  adminAuth,
  getEventTicketStatistics
);

export default qrTicketRoutes;