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
  // 🆕 service fee
  getCheckoutTotals,
  getServiceFeeSettings,
  updateServiceFeeSettings,
  getPlatformServiceFeeEarnings,
  getPlatformTotalRevenue,
  getServiceFeePreview,
} from "./payment.controller";
import {
  getBookingPaymentStatus,
  handlePaystackMpesa,
  initializePaystackPayment,
  verifyPaystackPayment,
  paystackWebhookHandler,
} from "./Mpesa/Paystack.controller";
import { adminAuth } from "../../middleware/bearAuth";


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
// 🆕 BUYER CHECKOUT TOTALS (ticket + service fee)
//    Must stay ABOVE "/:id" or Express will read "checkout-totals" as an ID.
//    GET /payments/checkout-totals?bookingId=12&method=mpesa
// ==========================================
paymentRouter.get("/checkout-totals", getCheckoutTotals);

// 🆕 Public fee preview for the event page (before a booking exists). Also keep ABOVE "/:id".
// GET /payments/service-fee-preview?amount=1000&method=mpesa
paymentRouter.get("/service-fee-preview", getServiceFeePreview);

// ==========================================
// 🆕 ADMIN: SERVICE FEE SETTINGS (change the fee without touching code)
// ==========================================
paymentRouter.get("/settings/service-fee", adminAuth, getServiceFeeSettings);
paymentRouter.put("/settings/service-fee", adminAuth, updateServiceFeeSettings);

// ==========================================
// 📊 ANALYTICS & STATS ROUTES
// ==========================================
paymentRouter.get("/analytics/platform-earnings", getPlatformTotalEarnings);        // commission only
paymentRouter.get("/analytics/service-fee-earnings", adminAuth, getPlatformServiceFeeEarnings); // 🆕 buyer fees only
paymentRouter.get("/analytics/total-revenue", adminAuth, getPlatformTotalRevenue);              // 🆕 commission + service fees
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