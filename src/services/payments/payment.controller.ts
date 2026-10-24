import { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import db from "../../drizzle/db";
import { bookings } from "../../drizzle/schema";
import { 
  createPaymentSchema, 
  updatePaymentSchema, 
  updatePaymentStatusSchema 
} from "../../validators/payment.validator";
import {
  getAllPaymentsService,
  getPaymentByIdService,
  getPaymentsByBookingIdService,
  getPaymentsByEventIdService,
  getPaymentsByOrgIdService,
  getPaymentsByDigitalIdService,
  getPaymentsByStatusService,
  getPaymentsByMethodService,
  createPaymentService,
  updatePaymentService,
  updatePaymentStatusService,
  deletePaymentService,
  getEventTotalRevenueService,
  getPlatformTotalEarningsService,
  getSuccessfulPaymentsCountService,
  // 🆕 service fee
  getCheckoutTotalsByBookingService,
  getServiceFeeSettingsService,
  updateServiceFeeSettingsService,
  getPlatformServiceFeeEarningsService,
  getPlatformTotalRevenueService,
  getCheckoutTotalsService,
} from "./payment.service";

// ==========================================
// 1. GET ALL PAYMENTS
// ==========================================
export const getAllPayments: RequestHandler = async (req, res): Promise<void> => {
  try {
    const payments = await getAllPaymentsService();
    res.status(200).json({ 
      success: true, 
      message: "Payment: All payment records have been retrieved successfully 📋💳", 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_ALL_PAYMENTS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch payments" });
  }
};

// ==========================================
// 2. GET PAYMENT BY ID
// ==========================================
export const getPaymentById: RequestHandler = async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid payment ID format provided 🚫" });
      return;
    }

    const payment = await getPaymentByIdService(paymentId);
    if (!payment) {
      res.status(404).json({ success: false, error: "Payment: The requested payment record could not be found 🔍" });
      return;
    }

    res.status(200).json({ 
      success: true, 
      message: "Payment: Payment details retrieved successfully 🔍💳", 
      data: payment 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENT_BY_ID_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch payment" });
  }
};

// ==========================================
// 3. GET PAYMENTS BY BOOKING ID
// ==========================================
export const getPaymentsByBookingId: RequestHandler = async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (Number.isNaN(bookingId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid booking ID format provided 🚫" });
      return;
    }

    const payments = await getPaymentsByBookingIdService(bookingId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: Payments for this booking have been loaded successfully 🎟️💳", 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_BOOKING_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch booking payments" });
  }
};

// ==========================================
// 4. GET PAYMENTS BY EVENT ID
// ==========================================
export const getPaymentsByEventId: RequestHandler = async (req, res): Promise<void> => {
  try {
    const eventId = Number(req.params.eventId);
    if (Number.isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid event ID format provided 🚫" });
      return;
    }

    const payments = await getPaymentsByEventIdService(eventId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: Event payment records loaded successfully 🎉💳", 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_EVENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch event payments" });
  }
};

// ==========================================
// 5. GET PAYMENTS BY ORGANIZATION ID
// ==========================================
export const getPaymentsByOrgId: RequestHandler = async (req, res): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (Number.isNaN(orgId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid organization ID format provided 🚫" });
      return;
    }

    const payments = await getPaymentsByOrgIdService(orgId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: Organization payment transactions retrieved successfully 🏢💳", 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_ORG_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch organization payments" });
  }
};

// ==========================================
// 6. GET PAYMENTS BY DIGITAL ID (USER)
// ==========================================
export const getPaymentsByDigitalId: RequestHandler = async (req, res): Promise<void> => {
  try {
    const digitalId = Number(req.params.digitalId);
    if (Number.isNaN(digitalId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid digital user ID format provided 🚫" });
      return;
    }

    const payments = await getPaymentsByDigitalIdService(digitalId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: User payment history fetched successfully 👤💳", 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_USER_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch user payments" });
  }
};

// ==========================================
// 7. GET PAYMENTS BY STATUS
// ==========================================
export const getPaymentsByStatus: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { status } = req.params;
    const payments = await getPaymentsByStatusService(status as any);
    res.status(200).json({ 
      success: true, 
      message: `Payment: Transactions filtered by status '${status}' retrieved successfully 🔄💳`, 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_STATUS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch payments by status" });
  }
};

// ==========================================
// 8. GET PAYMENTS BY METHOD
// ==========================================
export const getPaymentsByMethod: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { method } = req.params;
    const methodString = Array.isArray(method) ? method[0] : method;
    
    if (!methodString) {
      res.status(400).json({ success: false, error: "Payment: Payment method parameter is required 🚫" });
      return;
    }

    const payments = await getPaymentsByMethodService(methodString);
    res.status(200).json({ 
      success: true, 
      message: `Payment: Transactions via method '${methodString}' retrieved successfully 📱💳`, 
      count: payments.length, 
      data: payments 
    });
  } catch (error: any) {
    console.error("[GET_PAYMENTS_BY_METHOD_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch payments by method" });
  }
};

// ==========================================
// 9. CREATE PAYMENT (Supports Guests & Users)
// ==========================================
export const createPayment: RequestHandler = async (req, res): Promise<void> => {
  try {
    const parseResult = createPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const resolvedDigitalId = parseResult.data.digitalId ?? (req as any).user?.userId ?? null;

    const payload = {
      ...parseResult.data,
      digitalId: resolvedDigitalId !== null ? resolvedDigitalId : undefined,
    };

    // Calls your updated service which automatically:
    //  - fetches the organization's custom commissionPercentage and calculates platformFee & netAmount
    //  - reads the buyer service fee
    //  - PREFERS the serviceFee/totalCharged already saved on the booking (set by getCheckoutTotals)
    const newPayment = await createPaymentService(payload as any);
    
    res.status(201).json({
      success: true,
      message: "Payment: The payment transaction has been registered and initialized successfully 💳✅",
      data: newPayment,
    });
  } catch (error: any) {
    console.error("[CREATE_PAYMENT_ERROR]", error);

    if (error.message && (error.message.includes("not found") || error.message.includes("could not be found"))) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({ success: false, error: error.message || "Failed to create payment" });
  }
};

// ==========================================
// 10. UPDATE PAYMENT
// ==========================================
export const updatePayment: RequestHandler = async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid payment ID format provided 🚫" });
      return;
    }

    const parseResult = updatePaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const data: any = parseResult.data;

    const updatePayload = {
      ...parseResult.data,
      amount: data.amount !== undefined ? String(data.amount) : undefined,
      platformFee: data.platformFee !== undefined ? String(data.platformFee) : undefined,
      netAmount: data.netAmount !== undefined ? String(data.netAmount) : undefined,
      serviceFee: data.serviceFee !== undefined ? String(data.serviceFee) : undefined,
      totalCharged: data.totalCharged !== undefined ? String(data.totalCharged) : undefined,
    };

    const updatedPayment = await updatePaymentService(paymentId, updatePayload as any);
    res.status(200).json({
      success: true,
      message: "Payment: The payment record has been updated successfully 🔄✨",
      data: updatedPayment,
    });
  } catch (error: any) {
    console.error("[UPDATE_PAYMENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update payment" });
  }
};

// ==========================================
// 11. UPDATE PAYMENT STATUS
// ==========================================
export const updatePaymentStatus: RequestHandler = async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid payment ID format provided 🚫" });
      return;
    }

    const parseResult = updatePaymentStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: parseResult.error.issues });
      return;
    }

    const { paymentStatus, transactionId, resultCode, resultDesc } = parseResult.data;
    const updatedPayment = await updatePaymentStatusService(
      paymentId,
      paymentStatus,
      transactionId,
      resultCode,
      resultDesc
    );

    res.status(200).json({
      success: true,
      message: `Payment: Payment status successfully updated to '${paymentStatus}' ✅`,
      data: updatedPayment,
    });
  } catch (error: any) {
    console.error("[UPDATE_PAYMENT_STATUS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update payment status" });
  }
};

// ==========================================
// 12. DELETE PAYMENT
// ==========================================
export const deletePayment: RequestHandler = async (req, res): Promise<void> => {
  try {
    const paymentId = Number(req.params.id);
    if (Number.isNaN(paymentId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid payment ID format provided 🚫" });
      return;
    }

    const message = await deletePaymentService(paymentId);
    res.status(200).json({ 
      success: true, 
      message: `Payment: ${message} - Transaction deleted successfully 🗑️❌` 
    });
  } catch (error: any) {
    console.error("[DELETE_PAYMENT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete payment" });
  }
};

// ==========================================
// 13. GET EVENT TOTAL REVENUE
// ==========================================
export const getEventTotalRevenue: RequestHandler = async (req, res): Promise<void> => {
  try {
    const eventId = Number(req.params.eventId);
    if (Number.isNaN(eventId)) {
      res.status(400).json({ success: false, error: "Payment: Invalid event ID format provided 🚫" });
      return;
    }

    const totalRevenue = await getEventTotalRevenueService(eventId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: Total event revenue calculated successfully 📊💰", 
      eventId, 
      totalRevenue 
    });
  } catch (error: any) {
    console.error("[GET_EVENT_REVENUE_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to calculate event revenue" });
  }
};

// ==========================================
// 14. GET PLATFORM TOTAL EARNINGS
// ==========================================
export const getPlatformTotalEarnings: RequestHandler = async (req, res): Promise<void> => {
  try {
    const totalEarnings = await getPlatformTotalEarningsService();
    res.status(200).json({ 
      success: true, 
      message: "Payment: Total platform earnings computed successfully 🌐📈", 
      totalPlatformEarnings: totalEarnings 
    });
  } catch (error: any) {
    console.error("[GET_PLATFORM_EARNINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to calculate platform earnings" });
  }
};

// ==========================================
// 15. GET SUCCESSFUL PAYMENTS COUNT
// ==========================================
export const getSuccessfulPaymentsCount: RequestHandler = async (req, res): Promise<void> => {
  try {
    const orgId = req.query.orgId ? Number(req.query.orgId) : undefined;
    const count = await getSuccessfulPaymentsCountService(orgId);
    res.status(200).json({ 
      success: true, 
      message: "Payment: Successful payments count retrieved successfully 🎯🔢", 
      successfulPaymentsCount: count 
    });
  } catch (error: any) {
    console.error("[GET_SUCCESSFUL_PAYMENTS_COUNT_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch successful payments count" });
  }
};

// ==========================================
// 🆕 16. GET CHECKOUT TOTALS (ticket + service fee) FOR A BOOKING
//     Reads the booking's totalAmount from the DB, calculates the fee,
//     AND saves the result back onto the booking so the webhook can use
//     the exact same numbers. This is the single source of truth for
//     what the buyer will be charged.
//     GET /payments/checkout-totals?bookingId=12&method=mpesa
// ==========================================
export const getCheckoutTotals: RequestHandler = async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.query.bookingId);
    if (!req.query.bookingId || Number.isNaN(bookingId)) {
      res.status(400).json({ success: false, error: "Payment: A valid bookingId is required 🚫" });
      return;
    }

    const method = typeof req.query.method === "string" ? req.query.method : undefined;
    const totals = await getCheckoutTotalsByBookingService(bookingId, method);

    // Freeze the totals on the booking so the later webhook / verify path
    // uses the exact fee and total the buyer saw. createPaymentService
    // prefers these saved values over recomputing.
    await db
      .update(bookings)
      .set({
        serviceFee: totals.serviceFee,
        totalCharged: totals.totalCharged,
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, bookingId));

    res.status(200).json({
      success: true,
      message: "Payment: Checkout totals calculated and saved on the booking 🧾💳",
      data: totals,
    });
  } catch (error: any) {
    console.error("[GET_CHECKOUT_TOTALS_ERROR]", error);

    if (error.message && error.message.includes("not found")) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    res.status(500).json({ success: false, error: error.message || "Failed to calculate checkout totals" });
  }
};

// ==========================================
// 🆕 17. GET SERVICE FEE SETTINGS (admin)
// ==========================================
export const getServiceFeeSettings: RequestHandler = async (req, res): Promise<void> => {
  try {
    const settings = await getServiceFeeSettingsService();
    res.status(200).json({
      success: true,
      message: "Payment: Service fee settings retrieved successfully ⚙️💳",
      data: settings,
    });
  } catch (error: any) {
    console.error("[GET_SERVICE_FEE_SETTINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch service fee settings" });
  }
};

// ==========================================
// 🆕 18. UPDATE SERVICE FEE SETTINGS (admin)
// ==========================================
export const updateServiceFeeSettings: RequestHandler = async (req, res): Promise<void> => {
  try {
    const percent = Number(req.body?.percent);
    const flat = req.body?.flat === undefined ? 0 : Number(req.body.flat);

    if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
      res.status(400).json({ success: false, error: "Payment: Percentage must be a number between 0 and 50 🚫" });
      return;
    }
    if (!Number.isFinite(flat) || flat < 0) {
      res.status(400).json({ success: false, error: "Payment: Flat fee must be 0 or more 🚫" });
      return;
    }

    const adminId = (req as any).user?.userId ?? null;
    const settings = await updateServiceFeeSettingsService(percent, flat, adminId);

    res.status(200).json({
      success: true,
      message: "Payment: Service fee updated. It applies to new payments from now on ✅⚙️",
      data: settings,
    });
  } catch (error: any) {
    console.error("[UPDATE_SERVICE_FEE_SETTINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update service fee settings" });
  }
};

// ==========================================
// 🆕 19. GET PLATFORM SERVICE-FEE EARNINGS
// ==========================================
export const getPlatformServiceFeeEarnings: RequestHandler = async (req, res): Promise<void> => {
  try {
    const totalServiceFees = await getPlatformServiceFeeEarningsService();
    res.status(200).json({
      success: true,
      message: "Payment: Total service fee earnings computed successfully 🧾📈",
      totalServiceFeeEarnings: totalServiceFees,
    });
  } catch (error: any) {
    console.error("[GET_SERVICE_FEE_EARNINGS_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to calculate service fee earnings" });
  }
};

// ==========================================
// 🆕 20. GET PLATFORM TOTAL REVENUE (commission + service fees)
// ==========================================
export const getPlatformTotalRevenue: RequestHandler = async (req, res): Promise<void> => {
  try {
    const totalRevenue = await getPlatformTotalRevenueService();
    res.status(200).json({
      success: true,
      message: "Payment: Total platform revenue (commission + service fees) computed successfully 🌐💰",
      totalPlatformRevenue: totalRevenue,
    });
  } catch (error: any) {
    console.error("[GET_PLATFORM_REVENUE_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to calculate platform revenue" });
  }
};

// ==========================================
// 🆕 21. SERVICE FEE PREVIEW (public, display-only)
// ==========================================
export const getServiceFeePreview: RequestHandler = async (req, res): Promise<void> => {
  try {
    const amount = Number(req.query.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ success: false, error: "Payment: A valid amount is required 🚫" });
      return;
    }

    const method = typeof req.query.method === "string" ? req.query.method : undefined;
    const totals = await getCheckoutTotalsService(amount, method);

    res.status(200).json({
      success: true,
      message: "Payment: Service fee preview calculated successfully 🧾",
      data: totals,
    });
  } catch (error: any) {
    console.error("[GET_SERVICE_FEE_PREVIEW_ERROR]", error);
    res.status(500).json({ success: false, error: error.message || "Failed to calculate service fee preview" });
  }
};