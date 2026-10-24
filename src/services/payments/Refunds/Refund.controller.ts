import { Request, Response } from "express";
import {
  Actor,
  RefundError,
  requestRefund,
  approveRefund,
  rejectRefund,
  reconcileRefund,
  refundCancelledEvent,
  listRefunds,
  listMyRefunds,
} from "./Refund.service";
import { PaystackRefundError } from "../Mpesa/Paystack.refunds";

const actorFrom = (req: Request): Actor => ({
  userId: req.user!.userId,
  role: req.user!.role as "admin" | "organizer",
  orgId: req.user!.orgId ?? null,
});

/**
 * Actor for the customer route. The role is ALWAYS "user" here, even if the caller is an
 * admin or organizer, so the "own payment only" check applies to everyone who uses /mine.
 * userId is the person's digitalId (it is compared with payments.digitalId).
 */
const customerActorFrom = (req: Request): Actor => {
  const u = req.user as any;
  return { userId: Number(u?.digitalId ?? u?.userId), role: "user", orgId: null };
};

const fail = (res: Response, e: any) => {
  const status = e instanceof RefundError ? e.status : e instanceof PaystackRefundError ? 400 : 500;
  return res.status(status).json({ success: false, message: e.message || "Internal server error" });
};

const REASON_TYPES = ["EventCancelled", "EventPostponed", "MaterialChange", "Other"] as const;
const STATUSES = ["Pending", "Processing", "Completed", "Failed", "Rejected"] as const;

/**
 * POST /api/refunds   (admin or organizer)
 * Body: { paymentId, ticketIds?, includeServiceFee?, reason?, reasonType?, idempotencyKey?, autoApprove? }
 */
export const requestRefundController = async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const paymentId = Number(b.paymentId);
    if (!Number.isInteger(paymentId)) {
      return res.status(400).json({ success: false, message: "paymentId is required" });
    }
    if (b.ticketIds !== undefined && (!Array.isArray(b.ticketIds) || b.ticketIds.some((n: unknown) => !Number.isInteger(Number(n))))) {
      return res.status(400).json({ success: false, message: "ticketIds must be an array of integers" });
    }
    if (b.reasonType !== undefined && !REASON_TYPES.includes(b.reasonType)) {
      return res.status(400).json({ success: false, message: `reasonType must be one of: ${REASON_TYPES.join(", ")}` });
    }

    const actor = actorFrom(req);
    let refund = await requestRefund(
      {
        paymentId,
        ticketIds: b.ticketIds?.map(Number),
        includeServiceFee: Boolean(b.includeServiceFee),
        reason: typeof b.reason === "string" ? b.reason.slice(0, 1000) : undefined,
        reasonType: b.reasonType,
        idempotencyKey: typeof b.idempotencyKey === "string" ? b.idempotencyKey : undefined,
      },
      actor
    );

    if (b.autoApprove && refund.status === "Pending") refund = await approveRefund(refund.refundId, actor);

    return res.status(201).json({ success: true, message: "Refund request created", data: refund });
  } catch (e: any) {
    return fail(res, e);
  }
};

/**
 * POST /api/refunds/mine   (any signed-in user)
 * A customer asks for a refund on their OWN payment.
 * Body: { paymentId, reason?, idempotencyKey? }
 * Everything else is fixed on the server: whole booking, ticket price only, reason type "Other",
 * never auto-approved. The request stays Pending until an organizer or admin approves it.
 */
export const requestMyRefundController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Please sign in" });
    if ((req.user as any).role === "scanner") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to access this resource" });
    }

    const b = req.body ?? {};
    const paymentId = Number(b.paymentId);
    if (!Number.isInteger(paymentId)) {
      return res.status(400).json({ success: false, message: "paymentId is required" });
    }

    const actor = customerActorFrom(req);
    if (!Number.isFinite(actor.userId)) {
      return res.status(401).json({ success: false, message: "Please sign in again" });
    }

    // Prefix with the user's id so one person's key can never match another person's refund
    const rawKey = typeof b.idempotencyKey === "string" ? b.idempotencyKey.trim().slice(0, 100) : "";
    const idempotencyKey = rawKey ? `user-${actor.userId}-${rawKey}` : undefined;

    const refund = await requestRefund(
      {
        paymentId,
        includeServiceFee: false,
        reasonType: "Other",
        reason: typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 500) : "Customer cancelled booking",
        idempotencyKey,
      },
      actor
    );

    return res.status(201).json({
      success: true,
      message: "Refund requested. The organizer will review it.",
      data: refund,
    });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** POST /api/refunds/:refundId/approve */
export const approveRefundController = async (req: Request, res: Response) => {
  try {
    const refundId = Number(req.params.refundId);
    if (!Number.isInteger(refundId)) return res.status(400).json({ success: false, message: "Invalid refund ID" });

    const refund = await approveRefund(refundId, actorFrom(req));
    return res.status(200).json({ success: true, message: "Refund sent to Paystack, awaiting confirmation ⏳", data: refund });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** POST /api/refunds/:refundId/reject   Body: { note? } */
export const rejectRefundController = async (req: Request, res: Response) => {
  try {
    const refundId = Number(req.params.refundId);
    if (!Number.isInteger(refundId)) return res.status(400).json({ success: false, message: "Invalid refund ID" });

    const refund = await rejectRefund(refundId, actorFrom(req), req.body?.note);
    return res.status(200).json({ success: true, message: "Refund rejected", data: refund });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** POST /api/refunds/:refundId/reconcile  (admin) */
export const reconcileRefundController = async (req: Request, res: Response) => {
  try {
    const refundId = Number(req.params.refundId);
    if (!Number.isInteger(refundId)) return res.status(400).json({ success: false, message: "Invalid refund ID" });

    const refund = await reconcileRefund(refundId);
    return res.status(200).json({ success: true, message: `Refund is ${refund.status} 🔄`, data: refund });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** POST /api/refunds/event/:eventId/refund-all   Body: { includeServiceFee? } */
export const refundCancelledEventController = async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId)) return res.status(400).json({ success: false, message: "Invalid event ID" });

    const results = await refundCancelledEvent(eventId, actorFrom(req), {
      includeServiceFee: Boolean(req.body?.includeServiceFee),
    });
    const ok = results.filter((r) => r.ok).length;
    return res.status(200).json({ success: true, message: `Processed ${ok} of ${results.length} refunds`, data: results });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** GET /api/refunds/org/:orgId?status=Pending */
export const listOrgRefundsController = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as (typeof STATUSES)[number] | undefined;
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` });
    }
    const data = await listRefunds({ orgId: Number(req.params.orgId), status });
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** GET /api/refunds  (admin) */
export const listAllRefundsController = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as (typeof STATUSES)[number] | undefined;
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(", ")}` });
    }
    const data = await listRefunds({ status });
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return fail(res, e);
  }
};

/** GET /api/refunds/mine  (any signed-in user): refunds on their OWN payments */
export const listMyRefundsController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Please sign in" });
    if ((req.user as any).role === "scanner") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to access this resource" });
    }
    const actor = customerActorFrom(req);
    if (!Number.isFinite(actor.userId)) {
      return res.status(401).json({ success: false, message: "Please sign in again" });
    }
    const data = await listMyRefunds(actor.userId);
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return fail(res, e);
  }
};