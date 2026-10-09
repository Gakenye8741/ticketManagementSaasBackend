import { eq, desc, and, sum, count, gte, lte, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  payments,
  bookings,
  wallets,
  organizations,
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
// 13. CREATE A NEW PAYMENT & AUTO-FUND WALLET (FINAL)
// ==========================================
export const createPaymentService = async (input: any) => {
  const newPayment = await db.transaction(async (tx) => {
    // 1. Fetch the booking with its event (to get the orgId)
    const bookingRecord = await tx.query.bookings.findFirst({
      where: eq(bookings.bookingId, input.bookingId),
      with: {
        event: true,
      },
    });

    if (!bookingRecord) {
      throw new Error(`Booking with ID ${input.bookingId} not found 🚫`);
    }

    // 2. Resolve amount and organization ID
    const paymentAmount = Number(input.amount ?? bookingRecord.totalAmount);
    const organizationId = input.orgId ?? bookingRecord.event?.orgId;

    if (!organizationId) {
      throw new Error(`Associated organization could not be found for booking ${input.bookingId} 🚫`);
    }

    // 3. Platform fee & net amount using the organization's commission
    const { amount, platformFee, netAmount } = await resolveFees(tx, organizationId, paymentAmount);

    // 4. Insert the payment record
    const [created] = await tx
      .insert(payments)
      .values({
        bookingId: bookingRecord.bookingId,
        orgId: organizationId,
        digitalId: bookingRecord.digitalId,
        amount,
        platformFee,
        netAmount,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus ?? "Completed",
        transactionId: input.transactionId,
      })
      .returning();

    // 5. Fund the organizer's wallet (only if the payment is already Completed)
    if (created.paymentStatus === "Completed") {
      await creditWalletFromPayment(tx, created);
    }

    return created;
  });

  // 🎯 After the transaction: deduct stock, make ALL tickets, email them to the payer
  if (newPayment.paymentStatus === "Completed" && newPayment.bookingId) {
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