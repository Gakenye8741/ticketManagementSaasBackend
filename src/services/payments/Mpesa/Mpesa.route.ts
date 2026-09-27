import { Router, raw } from "express";
import { 
  handleStkPush, 
  mpesaCallbackHandler, 
  getBookingPaymentStatus, 
  healthCheckHandler, 
  createStripeCheckoutSession
} from "./Mpesa.controller";
import { stripeWebhookHandler } from "../payment.webhook";

// Import Stripe controllers from their correct source file to prevent undefined handler errors
 // Update this path if your Stripe controller is located elsewhere

const router = Router();

/**
 * UTILITY & HEALTH ROUTES (UptimeRobot & Frontend Polling)
 */
// Keep Render awake
router.get("/health", healthCheckHandler);

// Fixes frontend 404 error when polling booking status
router.get("/booking/:bookingId", getBookingPaymentStatus);

/**
 * STRIPE ROUTES
 */
// CRITICAL: Stripe requires the raw body buffer to verify signatures securely.
// Using raw({ type: "application/json" }) ensures express doesn't parse it prematurely.
router.post(
  "/stripe-webhook", 
  raw({ type: "application/json" }), 
  stripeWebhookHandler
);

// Create Stripe Checkout Session route
router.post("/stripe/create-checkout-session", createStripeCheckoutSession);

/**
 * M-PESA ROUTES
 */

// 1. Initiate the STK Push prompt on the user's phone
router.post("/mpesa/stk-push", handleStkPush);

// 2. The Callback URL that Safaricom hits after user enters PIN
router.post("/mpesa-callback", mpesaCallbackHandler);

export default router;