import { eq, desc, and, sum, count, gte, lte, sql, inArray } from "drizzle-orm"; // 🆕 inArray
import db from "../../drizzle/db";
import {
  payments,
  bookings,
  wallets,
  organizations,
  platformSettings, // 🆕 settings table (admin-configurable fees)
  TInsertPayment,
  TSelectPayment,
  paymentStatusEnum,
} from "../../drizzle/schema";
import { confirmBookingAfterPayment } from "../events/eventBooking.service";


// ==========================================
// 1. GET ALL PAYMENTS
// ==========================================
export const getAllPaymentsService = async (): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    orderBy: [desc(payments.createdAt)],
    with: {
      booking: true,
      organization: true,
      user: true,
    },
  });
};

// ==========================================
// 2. GET PAYMENT BY ID
// ==========================================
export const getPaymentByIdService = async (
  paymentId: number
): Promise<TSelectPayment | undefined> => {
  return await db.query.payments.findFirst({
    where: eq(payments.paymentId, paymentId),
    with: {
      booking: true,
      organization: true,
      user: true,
    },
  });
};

// ==========================================
// 3. GET PAYMENTS BY BOOKING ID
// ==========================================
export const getPaymentsByBookingIdService = async (
  bookingId: number
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: eq(payments.bookingId, bookingId),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 4. GET PAYMENTS BY EVENT ID
// ==========================================
export const getPaymentsByEventIdService = async (
  eventId: number
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: (payments, { exists }) =>
      exists(
        db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.bookingId, payments.bookingId),
              eq(bookings.eventId, eventId)
            )
          )
      ),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 5. GET PAYMENTS BY ORGANIZATION ID
// ==========================================
export const getPaymentsByOrgIdService = async (
  orgId: number
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: eq(payments.orgId, orgId),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 6. GET PAYMENTS BY DIGITAL ID (USER)
// ==========================================
export const getPaymentsByDigitalIdService = async (
  digitalId: number
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: eq(payments.digitalId, digitalId),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 7. GET PAYMENTS BY STATUS
// ==========================================
export const getPaymentsByStatusService = async (
  status: typeof paymentStatusEnum.enumValues[number]
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: eq(payments.paymentStatus, status),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 8. GET PAYMENTS BY PAYMENT METHOD (M-Pesa / Stripe)
// ==========================================
export const getPaymentsByMethodService = async (
  paymentMethod: string
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: eq(payments.paymentMethod, paymentMethod),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 9. GET PAYMENT BY M-PESA CHECKOUT REQUEST ID
// ==========================================
export const getPaymentByCheckoutRequestIdService = async (
  checkoutRequestId: string
): Promise<TSelectPayment | undefined> => {
  return await db.query.payments.findFirst({
    where: eq(payments.checkoutRequestId, checkoutRequestId),
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 10. GET PAYMENT BY STRIPE PAYMENT INTENT ID
// ==========================================
export const getPaymentByStripeIntentService = async (
  stripePaymentIntentId: string
): Promise<TSelectPayment | undefined> => {
  return await db.query.payments.findFirst({
    where: eq(payments.stripePaymentIntentId, stripePaymentIntentId),
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 11. GET PAYMENT BY TRANSACTION ID
// ==========================================
export const getPaymentByTransactionIdService = async (
  transactionId: string
): Promise<TSelectPayment | undefined> => {
  return await db.query.payments.findFirst({
    where: eq(payments.transactionId, transactionId),
    with: {
      booking: true,
    },
  });
};

// ==========================================
// 12. GET PAYMENTS WITHIN DATE RANGE
// ==========================================
export const getPaymentsByDateRangeService = async (
  startDate: Date,
  endDate: Date
): Promise<TSelectPayment[]> => {
  return await db.query.payments.findMany({
    where: and(gte(payments.paymentDate, startDate), lte(payments.paymentDate, endDate)),
    orderBy: [desc(payments.paymentDate)],
    with: {
      booking: true,
    },
  });
};

// 🧮 Dynamic Fee-Splitting Calculator using the Organization's custom commission percentage
export const calculatePaymentFees = (
  amount: number | string,
  commissionPercentage: number | string
) => {
  const totalAmount = Number(amount);
  const commissionRate = Number(commissionPercentage);

  const platformFee = Number((totalAmount * (commissionRate / 100)).toFixed(2));
  const netAmount = Number((totalAmount - platformFee).toFixed(2));

  return {
    amount: totalAmount.toFixed(2),
    platformFee: platformFee.toFixed(2),
    netAmount: netAmount.toFixed(2),
  };
};

// ==========================================
// WALLET HELPERS (used by create + status update)
// ==========================================
const DEFAULT_COMMISSION = 5; // % fallback if the organization has none set

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Splits the amount using the organization's own commission percentage
const resolveFees = async (tx: Tx, orgId: number, amount: number) => {
  const [org] = await tx
    .select({ commission: organizations.commissionPercentage }) // 👈 adjust to your real column name
    .from(organizations)
    .where(eq(organizations.orgId, orgId));

  const rate = Number(org?.commission ?? DEFAULT_COMMISSION);
  return calculatePaymentFees(amount, rate);
};

// Credits the organizer's wallet with the NET amount (after the platform fee)
const creditWalletFromPayment = async (
  tx: Tx,
  payment: { orgId: number | null; netAmount: string | null }
) => {
  const net = Number(payment.netAmount ?? 0);
  if (!payment.orgId || net <= 0) return;

  const [existing] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.orgId, payment.orgId));

  if (!existing) {
    await tx.insert(wallets).values({
      orgId: payment.orgId,
      balance: "0.00",
      pendingBalance: "0.00",
      totalEarned: "0.00",
      currency: "KES",
    });
  }

  // Atomic increment: safe even if two payments land at the same moment
  await tx
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} + ${net}`,
      totalEarned: sql`${wallets.totalEarned} + ${net}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.orgId, payment.orgId));
};

// ==========================================
// 🆕 BUYER SERVICE FEE (admin-configurable via platform_settings)
//    Charged to the buyer ON TOP of the ticket amount, for platform maintenance.
//    Admin changes the rate from the settings page; no code change needed.
// ==========================================
const DEFAULT_SERVICE_FEE_PERCENT = 2.5; // fallback if platform_settings has no value yet

export const getBuyerFeeConfig = async (executor: typeof db | Tx = db) => {
  const d = executor as typeof db;
  const rows = await d
    .select()
    .from(platformSettings)
    .where(inArray(platformSettings.key, ["buyer_service_fee_percent", "buyer_service_fee_flat"]));

  const m = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  return {
    percent: Number.isFinite(m.buyer_service_fee_percent) ? m.buyer_service_fee_percent : DEFAULT_SERVICE_FEE_PERCENT,
    flat: Number.isFinite(m.buyer_service_fee_flat) ? m.buyer_service_fee_flat : 0,
  };
};

const isMpesa = (method?: string | null) => /m-?pesa/i.test(String(method ?? ""));

// Works in cents to avoid floating-point errors.
// M-Pesa STK push needs a whole-shilling total, so for M-Pesa the fee is rounded up to make it whole.
export const calcBuyerFee = (
  ticketAmount: number | string,
  cfg: { percent: number; flat: number },
  wholeAmounts = false
) => {
  const cents = Math.round(Number(ticketAmount) * 100);
  let fee = cents > 0 ? Math.round((cents * cfg.percent) / 100) + Math.round(cfg.flat * 100) : 0;
  let total = cents + fee;

  if (wholeAmounts && total % 100 !== 0) {
    total = Math.ceil(total / 100) * 100;
    fee = total - cents;
  }

  return {
    serviceFee: (fee / 100).toFixed(2),
    totalCharged: (total / 100).toFixed(2),
  };
};

// Call this where you START the payment (M-Pesa STK push / Stripe PaymentIntent)
// so the buyer is charged `totalCharged` instead of only the ticket amount.
export const getCheckoutTotalsService = async (
  ticketAmount: number | string,
  paymentMethod?: string | null
) => {
  const cfg = await getBuyerFeeConfig();
  return {
    ticketAmount: Number(ticketAmount).toFixed(2),
    ...calcBuyerFee(ticketAmount, cfg, isMpesa(paymentMethod)),
    serviceFeePercent: cfg.percent,
  };
};

// ==========================================
// 13. CREATE A NEW PAYMENT & AUTO-FUND WALLET (FINAL)
// ==========================================
export const createPaymentService = async (input: any) => {
  let alreadyRecorded = false;

  const newPayment = await db.transaction(async (tx) => {
    // Serialize concurrent callers (webhook + status polling) for this booking
    await tx
      .select({ id: bookings.bookingId })
      .from(bookings)
      .where(eq(bookings.bookingId, input.bookingId))
      .for("update");

    // Already recorded for this reference? Return it, don't insert again
    if (input.checkoutRequestId) {
      const [duplicate] = await tx
        .select()
        .from(payments)
        .where(eq(payments.checkoutRequestId, input.checkoutRequestId));

      if (duplicate) {
        alreadyRecorded = true;
        return duplicate;
      }
    }

    const bookingRecord = await tx.query.bookings.findFirst({
      where: eq(bookings.bookingId, input.bookingId),
      with: { event: true },
    });

    if (!bookingRecord) {
      throw new Error(`Booking with ID ${input.bookingId} not found 🚫`);
    }

    let paymentAmount = Number(input.amount ?? bookingRecord.totalAmount);

    // 🆕 Safety: the commission must be calculated on the TICKET amount only.
    // If a caller passes the amount the buyer actually paid (tickets + service fee),
    // cap it at the booking's ticket total so the fee is never counted as ticket revenue.
    const bookingTotal = Number(bookingRecord.totalAmount);
    if (Number.isFinite(bookingTotal) && bookingTotal > 0 && paymentAmount > bookingTotal) {
      paymentAmount = bookingTotal;
    }

    const organizationId = input.orgId ?? bookingRecord.event?.orgId;

    if (!organizationId) {
      throw new Error(`Associated organization could not be found for booking ${input.bookingId} 🚫`);
    }

    const { amount, platformFee, netAmount } = await resolveFees(tx, organizationId, paymentAmount);

    // 🆕 Buyer service fee, paid on top of the ticket amount (read fresh from platform_settings)
    const feeCfg = await getBuyerFeeConfig(tx);
    const { serviceFee, totalCharged } = calcBuyerFee(
      amount, // ticket total, same base as the commission
      feeCfg,
      isMpesa(input.paymentMethod)
    );

    const [created] = await tx
      .insert(payments)
      .values({
        bookingId: bookingRecord.bookingId,
        orgId: organizationId,
        digitalId: bookingRecord.digitalId,
        amount,
        platformFee,
        netAmount,
        serviceFee, // 🆕
        serviceFeePercent: String(feeCfg.percent), // 🆕 rate used at purchase time
        totalCharged, // 🆕 what the buyer paid (amount + serviceFee)
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus ?? "Completed",
        transactionId: input.transactionId,
        checkoutRequestId: input.checkoutRequestId,
        resultCode: input.resultCode,
        resultDesc: input.resultDesc,
      })
      .returning();

    if (created.paymentStatus === "Completed") {
      await creditWalletFromPayment(tx, created); // still credits netAmount only
    }

    return created;
  });

  if (!alreadyRecorded && newPayment.paymentStatus === "Completed" && newPayment.bookingId) {
    try {
      await confirmBookingAfterPayment(newPayment.bookingId);
    } catch (err) {
      console.error(`❌ Post-payment fulfilment failed for booking ${newPayment.bookingId}:`, err);
    }
  }

  return newPayment;
};

// ==========================================
// 14. UPDATE PAYMENT BY ID
// ==========================================
export const updatePaymentService = async (
  paymentId: number,
  paymentData: Partial<TInsertPayment>
): Promise<TSelectPayment> => {
  const [updatedPayment] = await db
    .update(payments)
    .set({ ...paymentData, updatedAt: new Date() })
    .where(eq(payments.paymentId, paymentId))
    .returning();

  return updatedPayment;
};

// ==========================================
// 15. UPDATE PAYMENT STATUS & TRANSACTION ID (FINAL)
//     M-Pesa and Stripe both go through here.
//     Credits the wallet on the FIRST move to Completed.
// ==========================================
export const updatePaymentStatusService = async (
  paymentId: number,
  status: typeof paymentStatusEnum.enumValues[number],
  transactionId?: string,
  resultCode?: string,
  resultDesc?: string
): Promise<TSelectPayment> => {
  const { updatedPayment, firstCompletion } = await db.transaction(async (tx) => {
    // Lock the row so duplicate callbacks can't double-credit the wallet
    const [previous] = await tx
      .select()
      .from(payments)
      .where(eq(payments.paymentId, paymentId))
      .for("update");

    if (!previous) throw new Error("Payment not found.");

    const [updated] = await tx
      .update(payments)
      .set({
        paymentStatus: status,
        ...(transactionId && { transactionId }),
        ...(resultCode && { resultCode }),
        ...(resultDesc && { resultDesc }),
        updatedAt: new Date(),
      })
      .where(eq(payments.paymentId, paymentId))
      .returning();

    const first = status === "Completed" && previous.paymentStatus !== "Completed";

    // 💰 Credit the organizer's wallet with the net amount (after platform fee)
    if (first) {
      await creditWalletFromPayment(tx, updated);
    }

    return { updatedPayment: updated, firstCompletion: first };
  });

  // 🎯 Only on the FIRST move to Completed: deduct stock, make tickets, email them
  if (firstCompletion && updatedPayment.bookingId) {
    try {
      await confirmBookingAfterPayment(updatedPayment.bookingId);
    } catch (err) {
      // Payment is saved. An admin can still set the booking to "Confirmed" to retry.
      console.error(`❌ Post-payment fulfilment failed for booking ${updatedPayment.bookingId}:`, err);
    }
  }

  return updatedPayment;
};

// ==========================================
// 16. HANDLE M-PESA CALLBACK & STATUS UPDATE
// ==========================================
export const handleMpesaCallbackService = async (
  checkoutRequestId: string,
  status: typeof paymentStatusEnum.enumValues[number],
  transactionId?: string,
  resultCode?: string,
  resultDesc?: string
): Promise<TSelectPayment | undefined> => {
  const existingPayment = await getPaymentByCheckoutRequestIdService(checkoutRequestId);
  if (!existingPayment) return undefined;

  return await updatePaymentStatusService(
    existingPayment.paymentId,
    status,
    transactionId,
    resultCode,
    resultDesc
  );
};

// ==========================================
// 17. HANDLE STRIPE WEBHOOK & STATUS UPDATE
// ==========================================
export const handleStripeWebhookService = async (
  stripePaymentIntentId: string,
  status: typeof paymentStatusEnum.enumValues[number],
  chargeId?: string
): Promise<TSelectPayment | undefined> => {
  const existingPayment = await getPaymentByStripeIntentService(stripePaymentIntentId);
  if (!existingPayment) return undefined;

  return await updatePaymentStatusService(existingPayment.paymentId, status, chargeId);
};

// ==========================================
// 18. DELETE PAYMENT BY ID
// ==========================================
export const deletePaymentService = async (paymentId: number): Promise<string> => {
  await db.delete(payments).where(eq(payments.paymentId, paymentId));
  return "Payment deleted successfully ❌";
};

// ==========================================
// 19. CALCULATE TOTAL REVENUE FOR AN EVENT
// ==========================================
export const getEventTotalRevenueService = async (eventId: number): Promise<number> => {
  const completedPayments = await db.query.payments.findMany({
    where: eq(payments.paymentStatus, "Completed"),
    with: {
      booking: true,
    },
  });

  const totalRevenue = completedPayments.reduce((total, payment) => {
    if (payment.booking && payment.booking.eventId === eventId) {
      return total + Number(payment.amount);
    }
    return total;
  }, 0);

  return totalRevenue;
};

// ==========================================
// 20. CALCULATE PLATFORM EARNINGS (Fees)
//     (commission only, unchanged)
// ==========================================
export const getPlatformTotalEarningsService = async (): Promise<number> => {
  const result = await db
    .select({ totalPlatformFees: sum(payments.platformFee) })
    .from(payments)
    .where(eq(payments.paymentStatus, "Completed"));

  return Number(result[0]?.totalPlatformFees || 0);
};

// ==========================================
// 21. GET TOTAL SUCCESSFUL PAYMENTS COUNT
// ==========================================
export const getSuccessfulPaymentsCountService = async (orgId?: number): Promise<number> => {
  const result = await db
    .select({ count: count(payments.paymentId) })
    .from(payments)
    .where(
      orgId
        ? and(eq(payments.paymentStatus, "Completed"), eq(payments.orgId, orgId))
        : eq(payments.paymentStatus, "Completed")
    );

  return Number(result[0]?.count || 0);
};

// ==========================================
// 🆕 22. PLATFORM SERVICE-FEE EARNINGS (buyer fees only)
// ==========================================
export const getPlatformServiceFeeEarningsService = async (): Promise<number> => {
  const result = await db
    .select({ total: sum(payments.serviceFee) })
    .from(payments)
    .where(eq(payments.paymentStatus, "Completed"));

  return Number(result[0]?.total || 0);
};

// ==========================================
// 🆕 23. TOTAL PLATFORM REVENUE (organizer commission + buyer service fees)
// ==========================================
export const getPlatformTotalRevenueService = async (): Promise<number> => {
  const result = await db
    .select({
      commission: sum(payments.platformFee),
      serviceFees: sum(payments.serviceFee),
    })
    .from(payments)
    .where(eq(payments.paymentStatus, "Completed"));

  return Number(result[0]?.commission || 0) + Number(result[0]?.serviceFees || 0);
};

// ==========================================
// 🆕 24. CHECKOUT TOTALS FOR A BOOKING (ticket + service fee, calculated server-side)
//     The ticket amount comes from the booking in the DB, never from the client.
// ==========================================
export const getCheckoutTotalsByBookingService = async (
  bookingId: number,
  paymentMethod?: string | null
) => {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
  });

  if (!booking) {
    throw new Error(`Booking with ID ${bookingId} not found 🚫`);
  }

  const totals = await getCheckoutTotalsService(booking.totalAmount, paymentMethod);
  return { bookingId, ...totals };
};

// ==========================================
// 🆕 25. SERVICE FEE SETTINGS (admin can view and change without touching code)
// ==========================================
export const getServiceFeeSettingsService = async () => {
  return await getBuyerFeeConfig();
};

export const updateServiceFeeSettingsService = async (
  percent: number,
  flat: number,
  updatedBy?: number | null
) => {
  const entries = [
    { key: "buyer_service_fee_percent", value: String(percent) },
    { key: "buyer_service_fee_flat", value: String(flat) },
  ];

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      await tx
        .insert(platformSettings)
        .values({ ...entry, updatedBy: updatedBy ?? null })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: entry.value, updatedBy: updatedBy ?? null, updatedAt: new Date() },
        });
    }
  });

  return await getBuyerFeeConfig();
};