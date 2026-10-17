import { Router, raw } from "express";
import {
  initializePaystackPayment,
  handlePaystackMpesa,
  verifyPaystackPayment,
  paystackWebhookHandler,
} from "./Paystack.controller";

const paystackRouter = Router();

paystackRouter.post("/paystack/initialize", initializePaystackPayment); // hosted checkout
paystackRouter.post("/paystack/mpesa", handlePaystackMpesa);             // direct M-Pesa prompt
paystackRouter.get("/paystack/verify/:reference", verifyPaystackPayment);

// Raw body is required for signature verification.
// IMPORTANT: if app.use(express.json()) runs BEFORE this router, the raw body is
// already consumed. Fix it in app.ts with:
//   app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
// (the handler reads req.rawBody automatically).
// paystackRouter.post(
//   "/paystack/webhook",
//   raw({ type: "application/json" }),
//   paystackWebhookHandler
// );

export default paystackRouter;

// In payment.routes.ts add:
//   import paystackRouter from "./Paystack/Paystack.routes";
//   paymentRouter.use("/", paystackRouter);
// Webhook URL to set in the Paystack dashboard:
//   https://YOUR_SERVER/api/payments/paystack/webhook   (match your real mount path)