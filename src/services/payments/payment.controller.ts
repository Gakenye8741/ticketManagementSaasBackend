import {  RequestHandler } from "express";
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
  getSuccessfulPaymentsCountService
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

    // Calls your updated service which automatically fetches the organization's 
    // custom commissionPercentage, calculates platformFee & netAmount, and saves to DB.
    const newPayment = await createPaymentService(payload as any);
    
    res.status(201).json({
      success: true,
      message: "Payment: The payment transaction has been registered and initialized successfully 💳✅",
      data: newPayment,
    });
  } catch (error: any) {
    console.error("[CREATE_PAYMENT_ERROR]", error);

    // Handle missing bookings or organizations cleanly with a 404
    if (error.message && (error.message.includes("not found") || error.message.includes("could not be found"))) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }

    // Fallback for general server errors
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

    const updatePayload = {
      ...parseResult.data,
      amount: parseResult.data.amount !== undefined ? String(parseResult.data.amount) : undefined,
      platformFee: parseResult.data.platformFee !== undefined ? String(parseResult.data.platformFee) : undefined,
      netAmount: parseResult.data.netAmount !== undefined ? String(parseResult.data.netAmount) : undefined,
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