import { Request, Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import db from "../../../drizzle/db";
import { bookings, events, payments, mpesaLogs } from "../../../drizzle/schema";
import { createPaymentService } from "../payment.service";
import {
  initializeTransaction,
  chargeMpesa,
  verifyTransaction,
  makeReference,
  toPaystackPhone,
  fromSubunit,
} from "./Paystack.service";
import { handleRefundWebhook } from "../Refunds/Refund.service";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// We store the Paystack reference in bookings.checkoutRequestId and
// payments.checkoutRequestId, so no database migration is needed.

const findBookingByReference = async (reference: string, attempts = 5) => {
  for (let i = 0; i < attempts; i++) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.checkoutRequestId, reference));
    if (booking) return booking;
    await sleep(1000);
  }
  return null;
};

/**
 * Single place where a Paystack result becomes a payment record.
 * Used by the webhook AND the verify fallback. Safe to call repeatedly.
 */
const settlePaystackResult = async (opts: {
  reference: string;
  success: boolean;
  paidAmount: number; // KES
  transactionId: string;
  resultDesc?: string;
}) => {
  const { reference, success, paidAmount, transactionId, resultDesc } = opts;

  // Idempotency (webhook retries, webhook + verify)
  const existing = await db.query.payments.findFirst({
    where: eq(payments.checkoutRequestId, reference),
  });
  if (existing) {
    console.log(`ℹ️ Payment already recorded for ${reference}, skipping.`);
    return existing;
  }

  const booking = await findBookingByReference(reference);
  if (!booking) throw new Error(`No booking found for reference ${reference}`);

  // Never trust the amount blindly: must cover the booking total
  if (success && paidAmount + 0.01 < Number(booking.totalAmount)) {
    console.error(
      `🚨 Amount mismatch for ${reference}: paid ${paidAmount}, expected ${booking.totalAmount}`
    );
    throw new Error("Paid amount is less than booking total");
  }

  let orgId: number | null = null;
  if (booking.eventId !== null) {
    const [ev] = await db.select().from(events).where(eq(events.eventId, booking.eventId));
    orgId = ev ? ev.orgId : null;
  }

  // createPaymentService already: splits fees, credits wallet, makes + emails tickets
  const payment = await createPaymentService({
    bookingId: booking.bookingId,
    orgId,
    digitalId: booking.digitalId ?? null,
    amount: success ? String(booking.totalAmount) : "0",
    paymentStatus: success ? "Completed" : "Failed",
    paymentMethod: "Paystack",
    transactionId,
    checkoutRequestId: reference,
    resultCode: success ? "0" : "1",
    resultDesc: resultDesc ?? (success ? "Success" : "Failed"),
  });

  if (success) {
    await db
      .update(bookings)
      .set({ bookingStatus: "Confirmed" })
      .where(eq(bookings.bookingId, booking.bookingId));
    console.log(`✅ Paystack payment committed & booking ${booking.bookingId} confirmed`);
  }
  return payment;
};

// ------------------------------------------------------
// Shared: load booking + resolve email
// ------------------------------------------------------
const loadBooking = async (bookingId: number) =>
  db.query.bookings.findFirst({ where: eq(bookings.bookingId, bookingId) });

// 👇 Adjust to your real column names. Paystack REQUIRES an email.
const resolveEmail = (booking: any, bodyEmail?: string) =>
  bodyEmail || booking.guestEmail || booking.email || undefined;

// ------------------------------------------------------
// POST /paystack/initialize  -> hosted checkout URL
// ------------------------------------------------------
export const initializePaystackPayment = async (req: Request, res: Response) => {
  try {
    const { bookingId, email } = req.body;
    if (!bookingId) return void res.status(400).json({ error: "Booking ID is required 🚫" });

    const booking = await loadBooking(Number(bookingId));
    if (!booking) return void res.status(404).json({ error: "Booking not found 🔍" });

    const payerEmail = resolveEmail(booking, email);
    if (!payerEmail) return void res.status(400).json({ error: "Email is required 🚫" });

    const reference = makeReference(booking.bookingId);
    const amount = Number(booking.totalAmount); // always from DB, never the client

    const init = await initializeTransaction({
      email: payerEmail,
      amount,
      reference,
      bookingId: booking.bookingId,
      callbackUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/verify`,
    });

    await db
      .update(bookings)
      .set({ checkoutRequestId: reference })
      .where(eq(bookings.bookingId, booking.bookingId));

    res.status(200).json({
      success: true,
      authorizationUrl: init.authorization_url,
      reference,
    });
  } catch (error: any) {
    console.error("❌ Paystack initialize error:", error.message);
    res.status(500).json({ error: error.message || "Failed to start payment" });
  }
};

// ------------------------------------------------------
// POST /paystack/mpesa  -> direct M-Pesa prompt (like STK push)
// ------------------------------------------------------
export const handlePaystackMpesa = async (req: Request, res: Response) => {
  try {
    const { bookingId, phoneNumber, email } = req.body;
    if (!bookingId) return void res.status(400).json({ error: "Booking ID is required 🚫" });

    const booking = await loadBooking(Number(bookingId));
    if (!booking) return void res.status(404).json({ error: "Booking not found 🔍" });

    const rawPhone = phoneNumber || booking.guestPhone;
    if (!rawPhone) return void res.status(400).json({ error: "Phone number is required 🚫" });

    const phone = toPaystackPhone(rawPhone);
    if (!/^\+254\d{9}$/.test(phone)) {
      return void res
        .status(400)
        .json({ error: "Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX" });
    }

    const payerEmail = resolveEmail(booking, email);
    if (!payerEmail) return void res.status(400).json({ error: "Email is required 🚫" });

    const reference = makeReference(booking.bookingId);

    // Save the reference BEFORE charging so the webhook can always find it
    await db
      .update(bookings)
      .set({ checkoutRequestId: reference })
      .where(eq(bookings.bookingId, booking.bookingId));

    const charge = await chargeMpesa({
      email: payerEmail,
      amount: Number(booking.totalAmount),
      phone,
      reference,
      bookingId: booking.bookingId,
    });

    res.status(200).json({
      success: true,
      message: charge.display_text || "M-Pesa prompt sent. Enter your PIN 📱💳",
      reference,
      status: charge.status,
    });
  } catch (error: any) {
    console.error("❌ Paystack M-Pesa error:", error.message);
    res.status(500).json({ error: error.message || "Failed to start M-Pesa payment" });
  }
};

// ------------------------------------------------------
// GET /paystack/verify/:reference  -> fallback if webhook is late/missed
// ------------------------------------------------------
export const verifyPaystackPayment = async (req: Request, res: Response) => {
  try {
    const reference = String(req.params.reference);
    const tx = await verifyTransaction(reference);

    if (tx.status === "success") {
      await settlePaystackResult({
        reference,
        success: true,
        paidAmount: fromSubunit(tx.amount),
        transactionId: String(tx.id),
        resultDesc: tx.gateway_response,
      });
    } else if (tx.status === "failed") {
      await settlePaystackResult({
        reference,
        success: false,
        paidAmount: 0,
        transactionId: String(tx.id ?? reference),
        resultDesc: tx.gateway_response || tx.status,
      });
    }
    // pending / ongoing / pay_offline -> still waiting, nothing to record

    res.status(200).json({ reference, status: tx.status });
  } catch (error: any) {
    console.error("❌ Paystack verify handler error:", error.message);
    res.status(500).json({ error: error.message || "Failed to verify payment" });
  }
};

// ------------------------------------------------------
// POST /paystack/webhook  -> replaces mpesa-callback
// ------------------------------------------------------

export const paystackWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawBody: Buffer | undefined = Buffer.isBuffer(req.body)
      ? req.body
      : (req as any).rawBody;

    if (!rawBody) {
      res.status(400).json({ error: "Bad request - no raw body" });
      return;
    }

    const signature = req.headers["x-paystack-signature"] as string | undefined;
    if (!signature) {
      res.status(401).json({ error: "Missing signature" });
      return;
    }

    const expected = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn("🚫 [PAYSTACK] Invalid signature, ignoring request");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    res.sendStatus(200); // acknowledge fast, process after

    const event = JSON.parse(rawBody.toString("utf8"));

    // 🆕 Refund events have no data.reference, so handle them BEFORE the reference check below
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      console.log(`🔍 [PAYSTACK] Verified refund event: ${event.event}`, JSON.stringify(event.data));
      await handleRefundWebhook(event.event, event.data);
      return;
    }

    const reference: string | undefined = event.data?.reference;
    if (!reference) return;

    console.log(`🔍 [PAYSTACK] Verified event: ${event.event} -> ${reference}`);

    if (event.event === "charge.success") {
      const tx = await verifyTransaction(reference); // confirm with Paystack
      if (tx.status === "success") {
        await settlePaystackResult({
          reference,
          success: true,
          paidAmount: fromSubunit(tx.amount),
          transactionId: String(tx.id),
          resultDesc: tx.gateway_response,
        });
      }
    }
  } catch (error) {
    console.error("❌ [PAYSTACK] Webhook processing error:", error);
  }
};

// ------------------------------------------------------
// GET /bookings/:bookingId/status  -> polling endpoint for the UI
// (Paystack version of the old getBookingPaymentStatus; same response shape)
// ------------------------------------------------------
const fetchBookingWithRelations = (bookingId: number) =>
  db.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
    with: { payments: true, event: true },
  });

// Throttle verify calls so frontend polling doesn't hammer Paystack
const lastVerifyAt = new Map<string, number>();
const VERIFY_INTERVAL_MS = 5_000;

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

    // Fallback: no webhook yet -> ask Paystack directly
    const reference = bookingRecord.checkoutRequestId;
    if (
      reference &&
      (bookingRecord.payments?.length ?? 0) === 0 &&
      Date.now() - (lastVerifyAt.get(reference) ?? 0) > VERIFY_INTERVAL_MS
    ) {
      lastVerifyAt.set(reference, Date.now());
      try {
        const tx = await verifyTransaction(reference);
        if (tx.status === "success") {
          await settlePaystackResult({
            reference,
            success: true,
            paidAmount: fromSubunit(tx.amount),
            transactionId: String(tx.id),
            resultDesc: tx.gateway_response,
          });
        } else if (tx.status === "failed" || tx.status === "abandoned") {
          await settlePaystackResult({
            reference,
            success: false,
            paidAmount: 0,
            transactionId: String(tx.id ?? reference),
            resultDesc: tx.gateway_response || tx.status,
          });
        }
        bookingRecord = (await fetchBookingWithRelations(parsedId)) ?? bookingRecord;
      } catch (err: any) {
        console.error("⚠️ Paystack verify fallback failed:", err.message);
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