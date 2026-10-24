import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import db from "../../../drizzle/db";
import {
  auditLogs,
  bookings,
  events,
  payments,
  refunds,
  tickets,
  wallets,
  TSelectRefund,
} from "../../../drizzle/schema";
import { verifyTransaction } from "../Mpesa/Paystack.service";
import { createRefund, fetchRefund, PaystackRefundError } from "../Mpesa/Paystack.refunds";

// ==========================================================
// Types & helpers
// ==========================================================

export class RefundError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "RefundError";
  }
}

/**
 * Who is doing it. `null` is used for system actions (webhook, reconcile).
 * `userId` is the person's digitalId (it is what we store in audit logs and `initiatedBy`).
 * role "user" = a customer asking for a refund on their OWN payment.
 */
export type Actor = { userId: number; role: "admin" | "organizer" | "user"; orgId: number | null };

type ReasonType = TSelectRefund["reasonType"];

const REFUNDABLE_PAYMENT_STATUSES = ["Completed", "Paid", "PartiallyRefunded"] as const;

// Work in cents to avoid floating point errors (same approach as calcBuyerFee)
const cents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100);
const money = (c: number) => (c / 100).toFixed(2);

/** Admin: anything. Organizer: own org only. Customers (role "user") are always refused here. */
const assertOrgAccess = (actor: Actor | null, orgId: number | null) => {
  if (!actor || actor.role === "admin") return;
  if (actor.role === "organizer" && actor.orgId != null && orgId != null && Number(actor.orgId) === Number(orgId)) return;
  throw new RefundError("Forbidden: you can only manage refunds for your own organization", 403);
};

/** Who may CREATE a refund request for this payment. */
const assertCanRequest = (actor: Actor, payment: { orgId: number | null; digitalId: number | null }) => {
  if (actor.role === "user") {
    if (payment.digitalId == null || Number(payment.digitalId) !== Number(actor.userId)) {
      throw new RefundError("Forbidden: you can only request refunds for your own payments", 403);
    }
    return;
  }
  assertOrgAccess(actor, payment.orgId);
};

/** Customers can't ask for a refund once the event has started (event times are Nairobi time, UTC+3). */
const assertEventNotStarted = async (tx: any, bookingId: number) => {
  // Relational query: booking -> event (no join)
  const booking = await tx.query.bookings.findFirst({
    where: eq(bookings.bookingId, bookingId),
    columns: { bookingId: true },
    with: { event: { columns: { date: true, time: true } } },
  });
  const ev = booking?.event;
  if (!ev?.date) return;

  const day = ev.date instanceof Date ? ev.date.toISOString().slice(0, 10) : String(ev.date).slice(0, 10);
  const time = String(ev.time ?? "00:00:00").slice(0, 8);
  const start = new Date(`${day}T${time}+03:00`);
  if (!Number.isNaN(start.getTime()) && start.getTime() <= Date.now()) {
    throw new RefundError("This event has already started, so refunds can't be requested online. Contact the organizer", 409);
  }
};

const audit = async (
  tx: any,
  actor: Actor | null,
  orgId: number | null,
  action: string,
  refundId: number,
  metadata?: Record<string, unknown>
) => {
  await tx.insert(auditLogs).values({
    orgId,
    actorDigitalId: actor?.userId ?? null,
    action,
    targetTable: "refunds",
    targetId: String(refundId),
    metadata: metadata ?? null,
  });
};

// TODO: hook into your notification service and send the `refund_issued` notification
const notifyRefundIssued = async (_refund: TSelectRefund) => {};

// ==========================================================
// 1. REQUEST (creates a Pending refund, moves no money)
// ==========================================================

export const requestRefund = async (
  input: {
    paymentId: number;
    ticketIds?: number[]; // omit = every remaining valid ticket on the booking
    includeServiceFee?: boolean; // default false: face value only (matches your terms)
    reason?: string;
    reasonType?: ReasonType;
    idempotencyKey?: string;
  },
  actor: Actor
): Promise<TSelectRefund> => {
  // Customers get fixed options no matter what was passed in: whole booking, face value, reason "Other".
  const isCustomer = actor.role === "user";
  const includeServiceFee = isCustomer ? false : Boolean(input.includeServiceFee);
  const reasonType: ReasonType = isCustomer ? "Other" : input.reasonType ?? "Other";
  const requestedTicketIds = isCustomer ? undefined : input.ticketIds;

  return await db.transaction(async (tx) => {
    if (input.idempotencyKey) {
      const [dup] = await tx.select().from(refunds).where(eq(refunds.idempotencyKey, input.idempotencyKey));
      if (dup) {
        // A customer must never be able to read someone else's refund by guessing a key
        if (isCustomer && Number(dup.initiatedBy) !== Number(actor.userId)) {
          throw new RefundError("Forbidden", 403);
        }
        return dup;
      }
    }

    // Lock the payment so two requests can't both claim the same money
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.paymentId, input.paymentId))
      .for("update");

    if (!payment) throw new RefundError("Payment not found", 404);
    assertCanRequest(actor, payment);
    if (!payment.bookingId) throw new RefundError("Payment is not linked to a booking", 409);
    if (!(REFUNDABLE_PAYMENT_STATUSES as readonly string[]).includes(payment.paymentStatus)) {
      throw new RefundError(`A ${payment.paymentStatus} payment can't be refunded`, 409);
    }
    if (isCustomer) await assertEventNotStarted(tx, payment.bookingId);

    // Money already claimed by other refunds (Pending reserves it too)
    const prior = await tx
      .select()
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.paymentId), inArray(refunds.status, ["Pending", "Processing", "Completed"])));
    const sum = (pick: (r: TSelectRefund) => string | null) => prior.reduce((s, r) => s + cents(pick(r)), 0);

    const amountC = cents(payment.amount);
    const remTicketC = amountC - sum((r) => r.ticketAmount);
    if (remTicketC <= 0) throw new RefundError("Nothing left to refund on this payment", 409);

    // Which tickets
    const allTickets = await tx.select().from(tickets).where(eq(tickets.bookingId, payment.bookingId));
    const valid = allTickets.filter((t) => t.lifecycleStatus === "Valid");
    const wanted = requestedTicketIds?.length ? [...new Set(requestedTicketIds)] : null;
    const targets = wanted ? valid.filter((t) => wanted.includes(t.ticketId)) : valid;

    if (wanted && targets.length !== wanted.length) {
      throw new RefundError("Some tickets aren't on this booking or are no longer valid", 409);
    }
    if (!targets.length) throw new RefundError("No valid tickets left on this booking", 409);
    if (targets.some((t) => t.isScanned)) {
      throw new RefundError(
        isCustomer
          ? "Some tickets on this booking were already used, so it can't be refunded online. Contact the organizer"
          : "Scanned tickets can't be refunded. Pass ticketIds for the unscanned ones",
        409
      );
    }

    const isFinal = targets.length === valid.length; // refunding everything that remains
    const perTicketC = Math.floor(amountC / allTickets.length);
    const ticketC = isFinal ? remTicketC : Math.min(perTicketC * targets.length, remTicketC);

    // Proportional share of a total; the final refund takes the exact remainder (no cent drift)
    const share = (totalC: number, remainingC: number) =>
      isFinal ? remainingC : Math.min(Math.round((totalC * ticketC) / amountC), remainingC);

    const sfC = includeServiceFee
      ? share(cents(payment.serviceFee), cents(payment.serviceFee) - sum((r) => r.serviceFeeAmount))
      : 0;
    const netC = share(cents(payment.netAmount), cents(payment.netAmount) - sum((r) => r.organizerDebit));

    const [created] = await tx
      .insert(refunds)
      .values({
        paymentId: payment.paymentId,
        bookingId: payment.bookingId,
        orgId: payment.orgId,
        amount: money(ticketC + sfC),
        ticketAmount: money(ticketC),
        serviceFeeAmount: money(sfC),
        organizerDebit: money(netC),
        ticketIds: targets.map((t) => t.ticketId),
        reason: input.reason ?? null,
        reasonType,
        status: "Pending",
        initiatedBy: actor.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning();

    await audit(tx, actor, payment.orgId, "refund.requested", created.refundId, {
      amount: created.amount,
      ticketIds: created.ticketIds,
      requestedBy: actor.role,
    });
    return created;
  });
};

// ==========================================================
// 2. REJECT
// ==========================================================

export const rejectRefund = async (refundId: number, actor: Actor, note?: string): Promise<TSelectRefund> => {
  return await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refunds).where(eq(refunds.refundId, refundId)).for("update");
    if (!r) throw new RefundError("Refund not found", 404);
    assertOrgAccess(actor, r.orgId);
    if (r.status !== "Pending") throw new RefundError(`Only Pending refunds can be rejected (this one is ${r.status})`, 409);

    const [updated] = await tx
      .update(refunds)
      .set({ status: "Rejected", failureReason: note ?? null, updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();
    await audit(tx, actor, r.orgId, "refund.rejected", refundId, { note });
    return updated;
  });
};

// ==========================================================
// 3. APPROVE (reserve everything, then call Paystack)
//    Same pattern as sendPayout: claim in a transaction, call the API outside it.
// ==========================================================

export const approveRefund = async (refundId: number, actor: Actor): Promise<TSelectRefund> => {
  // ---- Phase 1: claim. Pending -> Processing, invalidate tickets, debit organizer wallet ----
  const { refund, payment } = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refunds).where(eq(refunds.refundId, refundId)).for("update");
    if (!r) throw new RefundError("Refund not found", 404);
    if (r.status !== "Pending") throw new RefundError(`Only Pending refunds can be approved (this one is ${r.status})`, 409);

    const [p] = await tx.select().from(payments).where(eq(payments.paymentId, r.paymentId)).for("update");
    if (!p) throw new RefundError("Payment not found", 404);
    assertOrgAccess(actor, r.orgId ?? p.orgId);

    const ids = r.ticketIds ?? [];
    if (!ids.length) throw new RefundError("Refund has no tickets attached", 409);

    const rows = await tx.select().from(tickets).where(inArray(tickets.ticketId, ids));
    const bad = rows.length !== ids.length || rows.some((t) => t.bookingId !== r.bookingId || t.lifecycleStatus !== "Valid" || t.isScanned);
    if (bad) throw new RefundError("Some tickets were already refunded, scanned or changed. Reject this request and create a new one", 409);

    await tx
      .update(tickets)
      .set({ lifecycleStatus: "Refunded", refundedAt: new Date(), updatedAt: new Date() })
      .where(inArray(tickets.ticketId, ids));

    // Debit the organizer. balance MAY go negative: that is how the refund gets
    // "deducted from future payouts" (requestPayout6 needs balance >= amount).
    const debitC = cents(r.organizerDebit);
    if (debitC > 0) {
      const orgId = r.orgId ?? p.orgId;
      if (!orgId) throw new RefundError("Refund has no organization to debit", 409);
      const [w] = await tx.select().from(wallets).where(eq(wallets.orgId, orgId)).for("update");
      if (!w) throw new RefundError("Organizer wallet not found", 409);
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${debitC / 100}`,
          totalRefunded: sql`${wallets.totalRefunded} + ${debitC / 100}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.walletId, w.walletId));
    }

    const [claimed] = await tx
      .update(refunds)
      .set({ status: "Processing", approvedBy: actor.userId, approvedAt: new Date(), failureReason: null, updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();

    await audit(tx, actor, r.orgId, "refund.approved", refundId, { amount: r.amount, organizerDebit: r.organizerDebit });
    return { refund: claimed, payment: p };
  });

  // ---- Phase 2: pre-flight. Nothing sent yet, so any failure is safe to undo ----
  const reference = payment.checkoutRequestId ?? payment.transactionId;
  try {
    if (!reference) throw new Error("Payment has no Paystack reference");

    const txn = await verifyTransaction(reference);
    if (txn.status !== "success") throw new Error(`Original Paystack transaction is ${txn.status}`);

    // Never refund more than the buyer REALLY paid at Paystack (payments.totalCharged is not proof of that)
    const others = await db
      .select()
      .from(refunds)
      .where(and(eq(refunds.paymentId, payment.paymentId), ne(refunds.refundId, refundId), inArray(refunds.status, ["Processing", "Completed"])));
    const alreadySentC = others.reduce((s, r) => s + cents(r.amount), 0);
    if (cents(refund.amount) + alreadySentC > txn.amount) {
      throw new Error("Refund would exceed what the customer actually paid at Paystack");
    }
  } catch (e: any) {
    await revertRefund(refundId, e.message, actor);
    throw new RefundError(e.message, 409);
  }

  // ---- Phase 3: the actual refund ----
  try {
    const r = await createRefund({
      transaction: reference!,
      amount: Number(refund.amount),
      customerNote: refund.reason ?? undefined,
      merchantNote: `Refund #${refund.refundId}`,
    });

    await db
      .update(refunds)
      .set({ transactionReference: String(r.id), updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId));

    if (r.status === "failed") {
      await revertRefund(refundId, "Paystack reported the refund failed", actor);
    } else if (r.status === "processed") {
      await completeRefund(refundId);
    }
    // pending / processing / needs-attention: the webhook (or reconcile) finishes the job
  } catch (e: any) {
    if (e instanceof PaystackRefundError && e.definitive) {
      await revertRefund(refundId, e.message, actor); // Paystack rejected it, nothing was sent
      throw new RefundError(e.message, 400);
    }
    // Ambiguous (timeout / 5xx): stay Processing. Run reconcile once Paystack is reachable.
    throw new RefundError(`Couldn't confirm the refund with Paystack (${e.message}). It's still Processing: reconcile it before retrying.`, 502);
  }

  const [fresh] = await db.select().from(refunds).where(eq(refunds.refundId, refundId));
  return fresh;
};

// ==========================================================
// 4. OUTCOMES (idempotent: called by approve, webhook and reconcile)
// ==========================================================

/** Money reached the customer. */
export const completeRefund = async (refundId: number): Promise<TSelectRefund | null> => {
  const done = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refunds).where(eq(refunds.refundId, refundId)).for("update");
    if (!r) return null;
    if (r.status === "Completed") return null; // webhook retry
    if (r.status !== "Processing") {
      throw new Error(`Refund ${refundId} is ${r.status}, can't complete it. Review manually.`);
    }

    const [updated] = await tx
      .update(refunds)
      .set({ status: "Completed", processedAt: new Date(), updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();

    // Payment: fully or partially refunded?
    const [p] = await tx.select().from(payments).where(eq(payments.paymentId, r.paymentId)).for("update");
    const completed = await tx
      .select()
      .from(refunds)
      .where(and(eq(refunds.paymentId, r.paymentId), eq(refunds.status, "Completed")));
    const refundedC = completed.reduce((s, x) => s + cents(x.ticketAmount), 0);
    await tx
      .update(payments)
      .set({ paymentStatus: refundedC >= cents(p.amount) ? "Refunded" : "PartiallyRefunded", updatedAt: new Date() })
      .where(eq(payments.paymentId, r.paymentId));

    // Booking: Refunded only once no valid tickets remain
    const stillValid = await tx
      .select({ id: tickets.ticketId })
      .from(tickets)
      .where(and(eq(tickets.bookingId, r.bookingId), eq(tickets.lifecycleStatus, "Valid")))
      .limit(1);
    if (!stillValid.length) {
      await tx.update(bookings).set({ bookingStatus: "Refunded", updatedAt: new Date() }).where(eq(bookings.bookingId, r.bookingId));
    }

    await audit(tx, null, r.orgId, "refund.completed", refundId, { amount: r.amount });
    return updated;
  });

  if (done) {
    try {
      await notifyRefundIssued(done);
    } catch (err) {
      console.error(`⚠️ refund_issued notification failed for refund ${refundId}:`, err);
    }
  }
  return done;
};

/** Refund did not happen: give the tickets and the organizer's money back. */
export const revertRefund = async (refundId: number, reason: string, actor: Actor | null = null): Promise<TSelectRefund | null> => {
  return await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refunds).where(eq(refunds.refundId, refundId)).for("update");
    if (!r) return null;
    if (r.status === "Failed") return r; // idempotent
    if (r.status !== "Processing") {
      throw new Error(`Refund ${refundId} is ${r.status}, can't revert it. Review manually.`);
    }

    const ids = r.ticketIds ?? [];
    if (ids.length) {
      await tx
        .update(tickets)
        .set({ lifecycleStatus: "Valid", refundedAt: null, updatedAt: new Date() })
        .where(and(inArray(tickets.ticketId, ids), eq(tickets.lifecycleStatus, "Refunded")));
    }

    const debitC = cents(r.organizerDebit);
    if (debitC > 0 && r.orgId) {
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${debitC / 100}`,
          totalRefunded: sql`${wallets.totalRefunded} - ${debitC / 100}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.orgId, r.orgId));
    }

    const [updated] = await tx
      .update(refunds)
      .set({ status: "Failed", failureReason: reason, updatedAt: new Date() })
      .where(eq(refunds.refundId, refundId))
      .returning();
    await audit(tx, actor, r.orgId, "refund.failed", refundId, { reason });
    return updated;
  });
};

// ==========================================================
// 5. WEBHOOK (refund.processed / refund.failed)
// ==========================================================

export const handleRefundWebhook = async (eventName: string, data: any): Promise<void> => {
  const txRef: string | undefined = data?.transaction_reference;
  if (!txRef) {
    console.warn("[REFUND] Webhook without transaction_reference, ignoring:", JSON.stringify(data));
    return;
  }

  const [payment] = await db.select().from(payments).where(eq(payments.checkoutRequestId, txRef));
  if (!payment) {
    console.warn(`[REFUND] No payment for reference ${txRef}, ignoring.`);
    return;
  }

  const inFlight = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.paymentId, payment.paymentId), eq(refunds.status, "Processing")))
    .orderBy(desc(refunds.createdAt));
  if (!inFlight.length) return; // already settled (retry) or nothing in flight

  let target = inFlight[0];
  if (inFlight.length > 1) {
    const byAmount = inFlight.filter((r) => cents(r.amount) === Number(data.amount));
    if (byAmount.length !== 1) {
      console.warn(`[REFUND] ${inFlight.length} refunds in flight for ${txRef} and the webhook can't pick one. Use reconcile.`);
      return;
    }
    target = byAmount[0];
  }

  if (eventName === "refund.processed") await completeRefund(target.refundId);
  else if (eventName === "refund.failed") await revertRefund(target.refundId, "Paystack reported the refund failed");
};

// ==========================================================
// 6. RECONCILE (missed webhook / ambiguous error)
// ==========================================================

export const reconcileRefund = async (refundId: number): Promise<TSelectRefund> => {
  const [r] = await db.select().from(refunds).where(eq(refunds.refundId, refundId));
  if (!r) throw new RefundError("Refund not found", 404);
  if (r.status !== "Processing") return r;
  if (!r.transactionReference) {
    throw new RefundError("No Paystack refund id was saved for this refund. Check the Paystack dashboard before doing anything else", 409);
  }

  const pr = await fetchRefund(r.transactionReference);
  if (pr.status === "processed") await completeRefund(refundId);
  else if (pr.status === "failed") await revertRefund(refundId, "Paystack reported the refund failed");
  // pending / processing / needs-attention: still in flight

  const [fresh] = await db.select().from(refunds).where(eq(refunds.refundId, refundId));
  return fresh;
};

// ==========================================================
// 7. BULK: refund everyone for a cancelled event
// ==========================================================

export const refundCancelledEvent = async (
  eventId: number,
  actor: Actor,
  opts: { includeServiceFee?: boolean } = {}
) => {
  const [event] = await db.select().from(events).where(eq(events.eventId, eventId));
  if (!event) throw new RefundError("Event not found", 404);
  assertOrgAccess(actor, event.orgId);
  if (event.status !== "cancelled") throw new RefundError("Cancel the event first, then refund its attendees", 409);

  // Relational query: event -> bookings -> payments (no join, no callback operators)
  const eventBookings = await db.query.bookings.findMany({
    where: eq(bookings.eventId, eventId),
    columns: { bookingId: true },
    with: {
      payments: { columns: { paymentId: true, paymentStatus: true } },
    },
  });

  const refundable: readonly string[] = REFUNDABLE_PAYMENT_STATUSES;
  const paymentIds = eventBookings.flatMap((b) =>
    b.payments.filter((p) => refundable.includes(p.paymentStatus)).map((p) => p.paymentId)
  );

  const results: { paymentId: number; ok: boolean; skipped?: boolean; error?: string }[] = [];
  for (const paymentId of paymentIds) {
    try {
      const req = await requestRefund(
        {
          paymentId,
          includeServiceFee: opts.includeServiceFee,
          reasonType: "EventCancelled",
          reason: `Event cancelled: ${event.title}`,
          idempotencyKey: `event-${eventId}-payment-${paymentId}`, // safe to run again
        },
        actor
      );
      if (req.status !== "Pending") {
        results.push({ paymentId, ok: true, skipped: true }); // handled on an earlier run
        continue;
      }
      await approveRefund(req.refundId, actor);
      results.push({ paymentId, ok: true });
    } catch (e: any) {
      results.push({ paymentId, ok: false, error: e.message });
    }
  }
  return results;
};

// ==========================================================
// 8. LIST
// ==========================================================

export const listRefunds = async (filter: { orgId?: number; status?: TSelectRefund["status"] } = {}) => {
  const conds = [];
  if (filter.orgId !== undefined) conds.push(eq(refunds.orgId, filter.orgId));
  if (filter.status) conds.push(eq(refunds.status, filter.status));
  return await db
    .select()
    .from(refunds)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(refunds.createdAt));
};

// ==========================================================
// 9. LIST MY REFUNDS (customer)
// ==========================================================

/**
 * Refunds on the customer's OWN payments, with only the fields a customer should see.
 * Internal fields (organizerDebit, Paystack ids, approver ids, idempotency keys) are left out,
 * and failureReason is only shown for Rejected refunds (it then holds the organizer's note).
 * Uses relational queries (no joins): first the customer's payments, then the refunds on them.
 */
export const listMyRefunds = async (digitalId: number) => {
  const myPayments = await db.query.payments.findMany({
    where: eq(payments.digitalId, digitalId),
    columns: { paymentId: true },
  });
  const paymentIds = myPayments.map((p) => p.paymentId);
  if (!paymentIds.length) return [];

  const rows = await db.query.refunds.findMany({
    where: inArray(refunds.paymentId, paymentIds),
    orderBy: desc(refunds.createdAt),
  });

  return rows.map((r) => ({
    refundId: r.refundId,
    paymentId: r.paymentId,
    bookingId: r.bookingId,
    amount: r.amount,
    ticketAmount: r.ticketAmount,
    serviceFeeAmount: r.serviceFeeAmount,
    reason: r.reason,
    reasonType: r.reasonType,
    status: r.status,
    note: r.status === "Rejected" ? r.failureReason : null,
    processedAt: r.processedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
};