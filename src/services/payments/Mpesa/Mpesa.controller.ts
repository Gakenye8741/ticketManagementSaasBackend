import { Request, Response } from "express";
import Stripe from "stripe";
import { initiateStkPush, queryStkPush } from "./Mpesa.service";
import { bookings, events, mpesaLogs, payments } from "../../../drizzle/schema";
import db from "../../../drizzle/db";
import { eq } from "drizzle-orm";
import { createPaymentService } from "../payment.service";
import { processAndEmailTicketService } from "../../EmailTicket/emailTicket.Service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------
// Shared helpers
// ------------------------------------------------------

const fetchBookingWithRelations = (bookingId: number) =>
  db.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
    with: { payments: true, event: true },
  });

/** The callback can beat the DB write of checkoutRequestId, so retry briefly. */
const findBookingByCheckoutId = async (checkoutRequestId: string, attempts = 5) => {
  for (let i = 0; i < attempts; i++) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.checkoutRequestId, checkoutRequestId));
    if (booking) return booking;
    console.warn(`⏳ Booking not found for ${checkoutRequestId} (attempt ${i + 1}/${attempts})`);
    await sleep(1000);
  }
  return null;
};

/**
 * Single place where an STK result becomes a payment record.
 * Used by both the Safaricom callback and the STK Query fallback.
 * Safe to call more than once for the same checkoutRequestId.
 */
const settleStkResult = async (opts: {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount?: string;
  receipt?: string;
}) => {
  const { checkoutRequestId, resultCode, resultDesc, amount, receipt } = opts;

  // Idempotency: callback retries or callback + query fallback
  const existing = await db.query.payments.findFirst({
    where: eq(payments.checkoutRequestId, checkoutRequestId),
  });
  if (existing) {
    console.log(`ℹ️ Payment already recorded for ${checkoutRequestId}, skipping.`);
    return;
  }

  const booking = await findBookingByCheckoutId(checkoutRequestId);
  if (!booking) throw new Error(`No booking found for CheckoutRequestID ${checkoutRequestId}`);

  const success = resultCode === 0;

  let orgId: number | null = null;
  if (booking.eventId !== null) {
    const [eventRecord] = await db.select().from(events).where(eq(events.eventId, booking.eventId));
    orgId = eventRecord ? eventRecord.orgId : null;
  }

  await createPaymentService({
    bookingId: booking.bookingId,
    orgId,
    digitalId: booking.digitalId ?? null,
    amount: amount ?? (success ? String(booking.totalAmount) : "0"),
    paymentStatus: success ? "Completed" : "Failed",
    paymentMethod: "M-Pesa",
    transactionId: receipt ?? checkoutRequestId,
    checkoutRequestId,
    resultCode: String(resultCode),
    resultDesc,
  });

  if (!success) {
    console.warn(`⚠️ M-Pesa payment failed [${checkoutRequestId}]: ${resultDesc}`);
    return;
  }

  await db
    .update(bookings)
    .set({ bookingStatus: "Confirmed" })
    .where(eq(bookings.bookingId, booking.bookingId));

  console.log(`✅ Payment committed & booking ${booking.bookingId} confirmed`);

  try {
    await processAndEmailTicketService(booking.bookingId);
    console.log(`📨 Ticket emailed for booking ${booking.bookingId}`);
  } catch (err: any) {
    // Payment is already safe; don't undo it because email failed
    console.error("❌ Ticket pipeline failed:", err);
  }
};

// Throttle STK queries so frontend polling doesn't hammer Daraja
const lastQueryAt = new Map<string, number>();
const QUERY_INTERVAL_MS = 10_000;

// ------------------------------------------------------
// Health + status
// ------------------------------------------------------

export const healthCheckHandler = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: "online", timestamp: new Date().toISOString() });
};

export const getBookingPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedId = Number(req.params.bookingId);
    if (isNaN(parsedId)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    let bookingRecord = await fetchBookingWithRelations(parsedId);
    if (!bookingRecord) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Fallback: no callback received yet -> ask Safaricom directly
    const checkoutId = bookingRecord.checkoutRequestId;
    if (
      checkoutId &&
      (bookingRecord.payments?.length ?? 0) === 0 &&
      Date.now() - (lastQueryAt.get(checkoutId) ?? 0) > QUERY_INTERVAL_MS
    ) {
      lastQueryAt.set(checkoutId, Date.now());
      try {
        const result = await queryStkPush(checkoutId);
        if (result) {
          console.log(`🔎 STK Query result for ${checkoutId}: ${result.resultCode} - ${result.resultDesc}`);
          await settleStkResult({ checkoutRequestId: checkoutId, ...result });
          bookingRecord = (await fetchBookingWithRelations(parsedId)) ?? bookingRecord;
        }
      } catch (err: any) {
        console.error("⚠️ STK Query fallback failed:", err.response?.data || err.message);
      }
    }

    const latestPayment = bookingRecord.payments?.[bookingRecord.payments.length - 1];

    res.status(200).json({
      bookingId: bookingRecord.bookingId,
      bookingStatus: bookingRecord.bookingStatus,
      paymentStatus: latestPayment ? latestPayment.paymentStatus : "Pending",
      transactionId: latestPayment?.transactionId || null,
      event: bookingRecord.event?.title || null,
    });
  } catch (error: any) {
    console.error("❌ Error fetching booking status:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ------------------------------------------------------
// Stripe
// ------------------------------------------------------

export const createStripeCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  const { bookingId, amount, eventName, ticketTypeName, quantity } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "kes",
            product_data: {
              name: eventName || "Event Ticket",
              description: `Ticket Type: ${ticketTypeName || "Standard"} (Qty: ${quantity || 1})`,
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: quantity || 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/MyBookings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/MyBookings`,
      metadata: { bookingId: String(bookingId) },
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Session Error:", error.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// ------------------------------------------------------
// M-Pesa: initiate STK push
// ------------------------------------------------------

const normalizePhone = (raw: string): string => {
  let phone = raw.toString().trim().replace(/[\s+-]/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  else if (/^[71]\d{8}$/.test(phone)) phone = "254" + phone;
  return phone;
};

export const handleStkPush = async (req: Request, res: Response) => {
  const { phoneNumber, bookingId } = req.body;

  try {
    if (!bookingId) {
      res.status(400).json({ error: "Booking ID is required 🚫" });
      return;
    }

    const bookingRecord = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, Number(bookingId)),
    });

    if (!bookingRecord) {
      res.status(404).json({ error: "Booking not found 🔍" });
      return;
    }

    const rawPhone = phoneNumber || bookingRecord.guestPhone;
    if (!rawPhone) {
      res.status(400).json({ error: "Phone number is required 🚫" });
      return;
    }

    const formattedPhone = normalizePhone(rawPhone);
    if (!/^254\d{9}$/.test(formattedPhone)) {
      res.status(400).json({ error: "Invalid phone number. Use format 07XXXXXXXX or 2547XXXXXXXX" });
      return;
    }

    // Amount always comes from the DB, never from the client
    const amountToCharge = Number(bookingRecord.totalAmount);

    const result = await initiateStkPush(amountToCharge, formattedPhone, bookingRecord.bookingId);

    await db
      .update(bookings)
      .set({ checkoutRequestId: result.CheckoutRequestID })
      .where(eq(bookings.bookingId, bookingRecord.bookingId));

    res.status(200).json({
      success: true,
      message: "STK Push Sent Successfully 📱💳",
      checkoutRequestId: result.CheckoutRequestID,
    });
  } catch (error: any) {
    if (error.response) {
      console.error("❌ Safaricom Rejection Details:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("❌ STK Push Error:", error.message);
    }
    res.status(500).json({ error: error.message || "Failed to initiate M-Pesa push" });
  }
};

// ------------------------------------------------------
// M-Pesa: callback webhook
// ------------------------------------------------------

export const mpesaCallbackHandler = async (req: Request, res: Response): Promise<void> => {
  console.log("📥 [CALLBACK] Safaricom hit /mpesa-callback");

  // Reject requests that don't carry our secret
  const expectedSecret = process.env.MPESA_CALLBACK_SECRET;
  if (expectedSecret && req.query.secret !== expectedSecret) {
    console.warn("🚫 [CALLBACK] Invalid or missing secret, ignoring request");
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const stkCallback = req.body?.Body?.stkCallback;
  const checkoutRequestId: string | undefined = stkCallback?.CheckoutRequestID;

  if (!checkoutRequestId) {
    console.error("❌ [CALLBACK] Missing CheckoutRequestID. Body:", JSON.stringify(req.body));
    res.status(400).json({ error: "Invalid callback payload" });
    return;
  }

  // Acknowledge immediately so Safaricom never times out or retries.
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  // Everything below runs after the response has been sent.
  try {
    try {
      await db.insert(mpesaLogs).values({ checkoutRequestId, rawResponse: req.body.Body });
    } catch (logErr: any) {
      console.warn("⚠️ Could not write mpesaLogs (continuing):", logErr.message);
    }

    const items: any[] = stkCallback.CallbackMetadata?.Item || [];
    const amount = items.find((i) => i.Name === "Amount")?.Value?.toString();
    const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

    console.log(
      `🔍 [CALLBACK] ${checkoutRequestId} -> ResultCode ${stkCallback.ResultCode} (${stkCallback.ResultDesc})`
    );

    await settleStkResult({
      checkoutRequestId,
      resultCode: Number(stkCallback.ResultCode),
      resultDesc: stkCallback.ResultDesc,
      amount,
      receipt,
    });
  } catch (error) {
    console.error("❌ [CALLBACK] Processing error:", error);
  }
};