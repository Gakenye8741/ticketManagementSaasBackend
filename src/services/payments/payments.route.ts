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
  getSuccessfulPaymentsCount
} from "./payment.controller";
import { createStripeCheckoutSession, getBookingPaymentStatus, handleStkPush, healthCheckHandler, mpesaCallbackHandler } from "./Mpesa/Mpesa.controller";
import { stripeWebhookHandler } from "./payment.webhook";



const paymentRouter = Router();

// ==========================================
// 🚀 GATEWAY, HEALTH & WEBHOOK ROUTES
// ==========================================
paymentRouter.get("/health", healthCheckHandler);

// 👇 Update this line to /booking-status/:bookingId
paymentRouter.get("/booking-status/:bookingId", getBookingPaymentStatus);

// M-Pesa Gateway Routes
paymentRouter.post("/stk-push", handleStkPush);
paymentRouter.post("/mpesa-callback", mpesaCallbackHandler);

// Stripe Gateway Routes
paymentRouter.post("/stripe/create-checkout-session", createStripeCheckoutSession);
paymentRouter.post("/stripe/webhook", stripeWebhookHandler);
// ==========================================
// 📊 ANALYTICS & STATS ROUTES
// ==========================================
paymentRouter.get("/analytics/platform-earnings", getPlatformTotalEarnings);
paymentRouter.get("/analytics/event-revenue/:eventId", getEventTotalRevenue);
paymentRouter.get("/analytics/successful-count", getSuccessfulPaymentsCount);

// ==========================================
// 📋 CORE PAYMENT CRUD & FILTER ROUTES
// ==========================================

// 1. Get All Payments & 9. Create Payment
paymentRouter.get("/", getAllPayments);
paymentRouter.post("/", createPayment);

// 2. Get, 10. Update, & 12. Delete Payment by ID
paymentRouter.get("/:id", getPaymentById);
paymentRouter.put("/:id", updatePayment);
paymentRouter.delete("/:id", deletePayment);

// 11. Update Payment Status (Patch)
paymentRouter.patch("/:id/status", updatePaymentStatus);

// Specialized Filter Routes
paymentRouter.get("/booking/:bookingId", getPaymentsByBookingId);
paymentRouter.get("/event/:eventId", getPaymentsByEventId);
paymentRouter.get("/org/:orgId", getPaymentsByOrgId);
paymentRouter.get("/user/:digitalId", getPaymentsByDigitalId);
paymentRouter.get("/status/:status", getPaymentsByStatus);
paymentRouter.get("/method/:method", getPaymentsByMethod);

export default paymentRouter;