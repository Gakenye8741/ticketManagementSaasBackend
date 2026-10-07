import { Router, raw } from "express";
import {
  handleStkPush,
  mpesaCallbackHandler,
  getBookingPaymentStatus,
  healthCheckHandler,
  createStripeCheckoutSession,
} from "./Mpesa.controller";
import { stripeWebhookHandler } from "../payment.webhook";

const router = Router();

router.get("/health", healthCheckHandler);
router.get("/booking/:bookingId", getBookingPaymentStatus);

// Stripe needs the raw body for signature verification
router.post("/stripe-webhook", raw({ type: "application/json" }), stripeWebhookHandler);
router.post("/stripe/create-checkout-session", createStripeCheckoutSession);

router.post("/mpesa/stk-push", handleStkPush);

router.post(
  "/mpesa-callback",
  (req, _res, next) => {
    console.log(`➡️ ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  },
  mpesaCallbackHandler
);

export default router;