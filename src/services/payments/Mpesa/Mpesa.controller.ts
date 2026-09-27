import { Request, Response } from "express";
import Stripe from "stripe";
import { initiateStkPush } from "./Mpesa.service";
import { bookings, events, mpesaLogs, users, payments } from "../../../drizzle/schema";
import db from "../../../drizzle/db";
import { eq } from "drizzle-orm"; 
import { createPaymentService } from "../payment.service";
import { processAndEmailTicketService } from "../../EmailTicket/emailTicket.Service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

type InternalPaymentStatus = "Pending" | "Completed" | "Failed";

// 🚀 0.1 UptimeRobot Health Check
export const healthCheckHandler = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: "online", timestamp: new Date().toISOString() });
};

// 🔍 0.2 Check Booking & Payment Status
export const getBookingPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  const { bookingId } = req.params;

  try {
    const parsedId = Number(bookingId);
    if (isNaN(parsedId)) {
      res.status(400).json({ error: "Invalid booking ID format" });
      return;
    }

    const bookingRecord = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, parsedId),
      with: {
        payments: true,
        event: true,
      },
    });

    if (!bookingRecord) {
      res.status(404).json({ error: "Booking not found" });
      return;
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

// 0.3 Create Stripe Checkout Session (Supports Guests & Users)
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
      metadata: {
        bookingId: String(bookingId),
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Session Error:", error.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// 1. Initiate M-Pesa STK Push (Secured: Fetches amount dynamically via bookingId)tk
export const handleStkPush = async (req: Request, res: Response) => {
  // 1. Grab phoneNumber directly from what the client entered in the frontend request
  let { phoneNumber, bookingId } = req.body;
  
  try {
    if (!bookingId) {
      res.status(400).json({ error: "Booking ID is required 🚫" });
      return;
    }

    // 2. Fetch the booking to securely get the totalAmount from the DB
    const bookingRecord = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, Number(bookingId)),
    });

    if (!bookingRecord) {
      res.status(404).json({ error: "Booking not found 🔍" });
      return;
    }

    // 3. Use the client-entered phone number, fallback to DB guestPhone only if req.body.phoneNumber is empty
    const rawPhone = phoneNumber || bookingRecord.guestPhone;

    if (!rawPhone) {
      res.status(400).json({ error: "Phone number is required from client input 🚫" });
      return;
    }

    // 4. Format phone number to strictly match Daraja requirements (254XXXXXXXXX, no spaces, no +)
    let formattedPhone = rawPhone.toString().trim().replace("+", "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    }

    const amountToCharge = Number(bookingRecord.totalAmount);

    // 5. Trigger the STK push using the client's phone number and server-secured amount
    const result = await initiateStkPush(amountToCharge, formattedPhone, bookingRecord.bookingId);
    
    // 6. Save the CheckoutRequestID to the booking record
    await db.update(bookings)
      .set({ checkoutRequestId: result.CheckoutRequestID })
      .where(eq(bookings.bookingId, bookingRecord.bookingId));
      
    res.status(200).json({ 
      success: true,
      message: "STK Push Sent Successfully 📱💳", 
      checkoutRequestId: result.CheckoutRequestID 
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

// 2. M-Pesa Callback Webhook (Guest-friendly & No Joins)
export const mpesaCallbackHandler = async (req: Request, res: Response): Promise<void> => {
  const { Body } = req.body;
  const checkoutRequestId = Body?.stkCallback?.CheckoutRequestID;

  console.log("🔍 [LOG 1/5] Incoming M-Pesa Webhook Callback received...");

  if (!checkoutRequestId) {
    console.error("❌ Callback Error: Missing CheckoutRequestID in payload body.");
    res.status(400).json({ error: "Invalid callback payload" });
    return;
  }

  try {
    await db.insert(mpesaLogs).values({
      checkoutRequestId,
      rawResponse: Body,
    });
    console.log(`📝 [LOG 2/5] Raw callback payload inserted into mpesaLogs for ID: ${checkoutRequestId}`);

    if (Body.stkCallback.ResultCode !== 0) {
      console.warn(`⚠️ M-Pesa Payment Failed [${checkoutRequestId}]: ${Body.stkCallback.ResultDesc}`);
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted", internalStatus: "Payment failed or cancelled" }); 
      return;
    }

    const meta = Body.stkCallback.CallbackMetadata?.Item || [];
    const amount = meta.find((i: any) => i.Name === "Amount")?.Value.toString();
    const receipt = meta.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;

    console.log(`💵 [LOG 3/5] Payment Success Metadata detected. Receipt: ${receipt}, Amount: KES ${amount}`);

    // Fetch booking without using joins
    const [booking] = await db.select()
      .from(bookings)
      .where(eq(bookings.checkoutRequestId, checkoutRequestId));
    
    if (!booking || booking.eventId === null) {
      console.error("❌ Booking validation failed: Entry not found or missing eventId");
      res.status(404).json({ error: "Booking data incomplete" });
      return;
    }

    // Fetch event separately to retrieve orgId without joins
    const [eventRecord] = await db.select()
      .from(events)
      .where(eq(events.eventId, booking.eventId));

    await createPaymentService({
      bookingId: booking.bookingId,
      orgId: eventRecord ? eventRecord.orgId : null,
      digitalId: booking.digitalId ?? null, // Safely handles guests (null) or users
      amount: amount || "0",
      paymentStatus: "Completed",
      paymentMethod: "M-Pesa",
      transactionId: receipt,
      checkoutRequestId,
      resultCode: String(Body.stkCallback.ResultCode),
      resultDesc: Body.stkCallback.ResultDesc,
    });

    await db.update(bookings)
      .set({ bookingStatus: "Confirmed" })
      .where(eq(bookings.bookingId, booking.bookingId));

    console.log(`✅ [LOG 4/5] Payment committed & booking confirmed. Starting ticket pipeline...`);

    let emailDispatched = false;
    let emailLogSummary = "Email loop skipped.";

    try {
      console.log("🎟️ [LOG 5/5] Invoking processAndEmailTicketService...");
      await processAndEmailTicketService(booking.bookingId);
      
      emailDispatched = true;
      emailLogSummary = `Ticket processed and email/QR dispatched for booking ID: ${booking.bookingId}`;
      console.log(`📨 [AUTO-DISPATCH SUCCESS] ${emailLogSummary}`);
    } catch (bgError: any) {
      emailLogSummary = `Error inside ticketing engine: ${bgError.message}`;
      console.error("❌ Failure inside Ticket Automation Pipeline:", bgError);
    }

    res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Success",
      testingDiagnostics: {
        paymentStatus: "Completed",
        mpesaReceipt: receipt,
        emailSentSuccessfully: emailDispatched,
        statusLog: emailLogSummary
      }
    });

  } catch (error) {
    console.error("❌ M-Pesa Callback Critical Error:", error);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Internal Server Error" });
  }
};