import { Request, Response } from "express";
import Stripe from "stripe";
import { bookings, events } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createPaymentService } from "./payment.service";
import { processAndEmailTicketService } from "../EmailTicket/emailTicket.Service";
import db from "../../drizzle/db";

type InternalPaymentStatus = "Pending" | "Completed" | "Failed";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

// Stripe Webhook Handler (Guest & User compatible & No Joins)
export const stripeWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  } catch (err: any) {
    console.error("⚠️ Stripe webhook verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const bookingId = Number(session.metadata?.bookingId);
    const amount = session.amount_total ? (session.amount_total / 100).toString() : "0";
    const transactionId = session.payment_intent as string;
    const paymentMethod = session.payment_method_types?.[0] ?? "card";

    if (!bookingId || !transactionId) {
      console.error("❌ Missing required metadata in Stripe session");
      res.status(400).json({ error: "Missing metadata" });
      return;
    }

    let paymentStatus: InternalPaymentStatus = "Pending";
    if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      paymentStatus = "Completed";
    } else {
      paymentStatus = "Failed";
    }

    try {
      // 1. Fetch booking separately without joins
      const [booking] = await db.select().from(bookings).where(eq(bookings.bookingId, bookingId));

      if (!booking || !booking.eventId) {
        console.error("❌ Booking or eventId missing for Stripe session");
        res.status(400).json({ error: "Booking missing or invalid" });
        return;
      }

      // 2. Fetch event separately to retrieve orgId without joins
      const [eventRecord] = await db.select().from(events).where(eq(events.eventId, booking.eventId));

      await createPaymentService({
        bookingId,
        orgId: eventRecord ? eventRecord.orgId : null, // 👈 Dynamically passes the organization ID cleanly
        digitalId: booking.digitalId ?? null, // Supports guest checkout or linked user accounts seamlessly
        amount,
        paymentStatus,
        paymentMethod,
        transactionId,
        stripePaymentIntentId: transactionId,
      });

      console.log("✅ Stripe Payment recorded in DB:", { bookingId, transactionId });

      if (paymentStatus === "Completed") {
        await db.update(bookings)
          .set({ bookingStatus: "Confirmed" })
          .where(eq(bookings.bookingId, bookingId));

        // Use your centralized ticket and email processing service
        await processAndEmailTicketService(bookingId);
        console.log(`📨 Stripe Ticket & Email workflow executed successfully for booking ID: ${bookingId}`);
      }
    } catch (err) {
      console.error("❌ Stripe Webhook processing failed:", err);
      res.status(500).json({ error: "Webhook processing failed" });
      return;
    }
  }

  res.status(200).json({ received: true });
};

// Export alias to prevent naming collisions across routes
export const webhookHandler = stripeWebhookHandler;