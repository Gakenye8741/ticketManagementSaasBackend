import { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  getPaymentsByBookingId,
  getPaymentsByEventId,
  getPaymentsByOrgId,
  getPaymentsByDigitalId,
  getPaymentsByStatus,
  getPaymentsByMethod,
  createPayment,
  updatePayment,
  updatePaymentStatus,
  deletePayment,
  getEventTotalRevenue,
  getPlatformTotalEarnings,
  getSuccessfulPaymentsCount,
} from "./payment.controller";
import {
  getBookingPaymentStatus,
  handlePaystackMpesa,
  initializePaystackPayment,
  verifyPaystackPayment,
  paystackWebhookHandler,
} from "./Mpesa/Paystack.controller";

const paymentRouter = Router();

// ==========================================
// 🚀 PAYSTACK GATEWAY & STATUS ROUTES
// ==========================================
paymentRouter.get("/booking-status/:bookingId", getBookingPaymentStatus);

paymentRouter.post("/paystack/mpesa", handlePaystackMpesa);          // direct M-Pesa prompt
paymentRouter.post("/paystack/initialize", initializePaystackPayment); // hosted checkout
paymentRouter.get("/paystack/verify/:reference", verifyPaystackPayment);

// Webhook: needs the raw body. Make sure server.ts uses:
// app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
paymentRouter.post("/paystack/webhook", paystackWebhookHandler);

// ==========================================
// 📊 ANALYTICS & STATS ROUTES
// ==========================================
paymentRouter.get("/analytics/platform-earnings", getPlatformTotalEarnings);
paymentRouter.get("/analytics/event-revenue/:eventId", getEventTotalRevenue);
paymentRouter.get("/analytics/successful-count", getSuccessfulPaymentsCount);

// ==========================================
// 📋 CORE PAYMENT CRUD & FILTER ROUTES
// ==========================================
paymentRouter.get("/", getAllPayments);
paymentRouter.post("/", createPayment);

paymentRouter.get("/:id", getPaymentById);
paymentRouter.put("/:id", updatePayment);
paymentRouter.delete("/:id", deletePayment);

paymentRouter.patch("/:id/status", updatePaymentStatus);

// Specialized Filter Routes
paymentRouter.get("/booking/:bookingId", getPaymentsByBookingId);
paymentRouter.get("/event/:eventId", getPaymentsByEventId);
paymentRouter.get("/org/:orgId", getPaymentsByOrgId);
paymentRouter.get("/user/:digitalId", getPaymentsByDigitalId);
paymentRouter.get("/status/:status", getPaymentsByStatus);
paymentRouter.get("/method/:method", getPaymentsByMethod);

export default paymentRouter;