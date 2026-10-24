import { Request, Response } from "express";
import {
  getOrCreateWallet1,
  getWalletByOrgId2,
  creditWallet3,
  debitWallet4,
  getWalletStats5,
  requestPayout6,
  getOrganizationPayouts7,
  getPayoutById8,
  updatePayoutStatus9,
  getPendingPayouts10,
  addPayoutMethod11,
  getOrganizationPayoutMethods12,
  getPayoutMethodById13,
  setDefaultPayoutMethod14,
  deletePayoutMethod15,
  countPayoutMethods16,
  getDefaultPayoutMethod17,
  updatePayoutMethod18,
  getPayoutsByStatus19,
  getTotalPaidOut20,
  hasSufficientBalance21,
  clearPendingBalance22,
  resetWallet23,
  getTotalPlatformPendingLiability24,
  walletExists25,
  getPayoutCount26,
  getLatestPayout28,
  validateMethodOwnership29,
  getWalletOverview30,
  sendPayout,
  reconcilePayout,
  bulkSendPayouts,
  getBanksService,
} from "./Wallet.service";

import {
  getOrCreateWalletSchema,
  creditWalletSchema,
  debitWalletSchema,
  requestPayoutSchema,
  updatePayoutStatusSchema,
  insertPayoutMethodSchema,
  updatePayoutMethodSchema,
  getBanksQuerySchema,
} from "../../validators/wallet.validators";

const PAYOUT_STATUSES = ["Pending", "Processing", "Completed", "Failed", "Reversed"] as const;
type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

// ==========================================================
// ACCESS CONTROL
// Role checks live in Wallet.routes.ts (adminAuth / organizerAuth) and
// middleware/orgAccess.ts (enforceOrgParam / forceOrgFromToken).
// These helpers are the last line of defence inside the controllers.
// ==========================================================

/** Organizers always act on the org in their token. Admins may pass an orgId. */
const resolveOrgId = (req: Request, fallback?: unknown): number => {
  if (req.user?.role === "organizer") return Number(req.user.orgId);
  return Number(fallback);
};

/** Can the caller see data belonging to this org? */
const canAccessOrg = (req: Request, orgId: number): boolean =>
  req.user?.role === "admin" ||
  (req.user?.role === "organizer" && req.user.orgId != null && Number(req.user.orgId) === orgId);

// ==========================================
// WALLET CONTROLLERS
// ==========================================

export const getOrCreateWalletController = async (req: Request, res: Response) => {
  try {
    const parsed = getOrCreateWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const wallet = await getOrCreateWallet1(parsed.data.orgId, parsed.data.currency);
    return res.status(200).json({
      success: true,
      message: "Wallet retrieved or created successfully ✨",
      data: wallet,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getWalletByOrgIdController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const wallet = await getWalletByOrgId2(orgId);

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found for this organization ❌" });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet fetched successfully 🚀",
      data: wallet,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/** ADMIN ONLY */
export const creditWalletController = async (req: Request, res: Response) => {
  try {
    const parsed = creditWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const updatedWallet = await creditWallet3(parsed.data.orgId, parsed.data.amount);
    return res.status(200).json({
      success: true,
      message: "Wallet credited successfully 💰",
      data: updatedWallet,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to credit wallet" });
  }
};

/** ADMIN ONLY */
export const debitWalletController = async (req: Request, res: Response) => {
  try {
    const parsed = debitWalletSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const updatedWallet = await debitWallet4(parsed.data.orgId, parsed.data.amount);
    return res.status(200).json({
      success: true,
      message: "Wallet debited successfully 💸",
      data: updatedWallet,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to debit wallet" });
  }
};

export const getWalletStatsController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const stats = await getWalletStats5(orgId);
    return res.status(200).json({
      success: true,
      message: "Wallet statistics retrieved successfully 📊",
      data: stats,
    });
  } catch (error: any) {
    return res.status(404).json({ success: false, message: error.message || "Wallet not found" });
  }
};

// ==========================================
// PAYOUT CONTROLLERS
// ==========================================

export const requestPayoutController = async (req: Request, res: Response) => {
  try {
    const parsed = requestPayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const result = await requestPayout6(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Payout request submitted successfully 🚀",
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to request payout" });
  }
};

export const getOrganizationPayoutsController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const payouts = await getOrganizationPayouts7(orgId);
    return res.status(200).json({
      success: true,
      message: "Organization payouts fetched successfully 📋",
      data: payouts,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getPayoutByIdController = async (req: Request, res: Response) => {
  try {
    const payoutId = Number(req.params.payoutId);
    const payout = await getPayoutById8(payoutId);

    // Same 404 for "missing" and "not yours" so IDs can't be probed
    if (!payout || !canAccessOrg(req, payout.orgId)) {
      return res.status(404).json({ success: false, message: "Payout record not found ❌" });
    }

    return res.status(200).json({
      success: true,
      message: "Payout retrieved successfully ✅",
      data: payout,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/** ADMIN ONLY. Manual override for Pending payouts (e.g. paid outside Paystack, or rejecting a request). */
export const updatePayoutStatusController = async (req: Request, res: Response) => {
  try {
    const payoutId = Number(req.params.payoutId);
    const parsed = updatePayoutStatusSchema.safeParse({ payoutId, ...req.body });
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const updated = await updatePayoutStatus9(parsed.data.payoutId, parsed.data.status, parsed.data.transactionReference);
    return res.status(200).json({
      success: true,
      message: `Payout status updated to ${parsed.data.status} successfully ⚡`,
      data: updated,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update payout status" });
  }
};

/** ADMIN ONLY */
export const getPendingPayoutsController = async (req: Request, res: Response) => {
  try {
    const pending = await getPendingPayouts10();
    return res.status(200).json({
      success: true,
      message: "Pending payouts retrieved successfully ⏳",
      data: pending,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/** ADMIN ONLY. Sends a Pending payout to Paystack. Final status arrives via webhook. */
export const sendPayoutController = async (req: Request, res: Response) => {
  try {
    const payoutId = Number(req.params.payoutId);
    if (!Number.isInteger(payoutId)) {
      return res.status(400).json({ success: false, message: "Invalid payout ID" });
    }

    const payout = await sendPayout(payoutId);
    return res.status(200).json({
      success: true,
      message: "Payout sent to Paystack, awaiting confirmation ⏳",
      data: payout,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to send payout" });
  }
};

/** ADMIN ONLY. Ask Paystack for the real state of a Processing payout. */
export const reconcilePayoutController = async (req: Request, res: Response) => {
  try {
    const payoutId = Number(req.params.payoutId);
    if (!Number.isInteger(payoutId)) {
      return res.status(400).json({ success: false, message: "Invalid payout ID" });
    }

    const payout = await reconcilePayout(payoutId);
    return res.status(200).json({
      success: true,
      message: `Payout is ${payout.status} 🔄`,
      data: payout,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to reconcile payout" });
  }
};

/** ADMIN ONLY. Replaces the old bulk status update. Body: { payoutIds: number[] } */
export const bulkSendPayoutsController = async (req: Request, res: Response) => {
  try {
    const raw = req.body?.payoutIds;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
      return res.status(400).json({ success: false, message: "payoutIds must be an array of 1 to 100 IDs" });
    }
    const payoutIds = raw.map(Number);
    if (payoutIds.some((n) => !Number.isInteger(n))) {
      return res.status(400).json({ success: false, message: "payoutIds must all be integers" });
    }

    const results = await bulkSendPayouts(payoutIds);
    const okCount = results.filter((r) => r.ok).length;
    return res.status(200).json({
      success: true,
      message: `Sent ${okCount} of ${results.length} payouts to Paystack ⚡`,
      data: results,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to perform bulk send" });
  }
};

// ==========================================
// PAYOUT METHODS CONTROLLERS
// ==========================================

export const addPayoutMethodController = async (req: Request, res: Response) => {
  try {
    const parsed = insertPayoutMethodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const method = await addPayoutMethod11(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Payout method added successfully 💳",
      data: method,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to add payout method" });
  }
};

export const getOrganizationPayoutMethodsController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const methods = await getOrganizationPayoutMethods12(orgId);
    return res.status(200).json({
      success: true,
      message: "Payout methods retrieved successfully 📂",
      data: methods,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getPayoutMethodByIdController = async (req: Request, res: Response) => {
  try {
    const methodId = Number(req.params.methodId);
    const method = await getPayoutMethodById13(methodId);

    if (!method || !canAccessOrg(req, method.orgId)) {
      return res.status(404).json({ success: false, message: "Payout method not found ❌" });
    }

    return res.status(200).json({
      success: true,
      message: "Payout method fetched successfully ✅",
      data: method,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const setDefaultPayoutMethodController = async (req: Request, res: Response) => {
  try {
    const methodId = Number(req.params.methodId);
    const orgId = resolveOrgId(req, req.body.orgId);

    const updated = await setDefaultPayoutMethod14(methodId, orgId);
    return res.status(200).json({
      success: true,
      message: "Default payout method updated successfully ⭐",
      data: updated,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to set default method" });
  }
};

export const deletePayoutMethodController = async (req: Request, res: Response) => {
  try {
    const methodId = Number(req.params.methodId);
    // For organizers this is always the token's org, so ?orgId=<someone else> is ignored
    const orgId = resolveOrgId(req, req.query.orgId || req.body?.orgId);

    const deleted = await deletePayoutMethod15(methodId, orgId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Payout method not found or unauthorized ❌" });
    }

    return res.status(200).json({
      success: true,
      message: "Payout method deleted successfully 🗑️",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const countPayoutMethodsController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const count = await countPayoutMethods16(orgId);
    return res.status(200).json({
      success: true,
      message: "Payout methods count retrieved successfully 🔢",
      data: { count },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getDefaultPayoutMethodController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const defaultMethod = await getDefaultPayoutMethod17(orgId);

    return res.status(200).json({
      success: true,
      message: "Default payout method fetched successfully ⭐",
      data: defaultMethod || null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const updatePayoutMethodController = async (req: Request, res: Response) => {
  try {
    const methodId = Number(req.params.methodId);
    const parsed = updatePayoutMethodSchema.safeParse({ methodId, ...req.body });
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const updated = await updatePayoutMethod18(parsed.data.methodId, parsed.data.orgId, parsed.data.data);
    return res.status(200).json({
      success: true,
      message: "Payout method updated successfully ✏️",
      data: updated,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to update payout method" });
  }
};

export const getPayoutsByStatusController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const status = req.params.status as PayoutStatus;

    if (!PAYOUT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Use one of: ${PAYOUT_STATUSES.join(", ")}`,
      });
    }

    const payouts = await getPayoutsByStatus19(orgId, status);
    return res.status(200).json({
      success: true,
      message: `Payouts with status '${status}' fetched successfully 📑`,
      data: payouts,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getTotalPaidOutController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const total = await getTotalPaidOut20(orgId);
    return res.status(200).json({
      success: true,
      message: "Total paid out amount calculated successfully 📊",
      data: { totalPaidOut: total },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const hasSufficientBalanceController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const amount = Number(req.query.amount);

    const sufficient = await hasSufficientBalance21(orgId, amount);
    return res.status(200).json({
      success: true,
      message: "Balance sufficiency checked successfully ✔️",
      data: { hasSufficientBalance: sufficient },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

/** ADMIN ONLY */
export const clearPendingBalanceController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const updatedWallet = await clearPendingBalance22(orgId);
    return res.status(200).json({
      success: true,
      message: "Pending balance cleared successfully 🧹",
      data: updatedWallet,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to clear pending balance" });
  }
};

/** ADMIN ONLY. Consider removing in production. */
export const resetWalletController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const reset = await resetWallet23(orgId);
    return res.status(200).json({
      success: true,
      message: "Wallet reset successfully 🔄",
      data: reset,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to reset wallet" });
  }
};

/** ADMIN ONLY */
export const getTotalPlatformPendingLiabilityController = async (req: Request, res: Response) => {
  try {
    const liability = await getTotalPlatformPendingLiability24();
    return res.status(200).json({
      success: true,
      message: "Platform pending liability calculated successfully 🌐",
      data: { totalPendingLiability: liability },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const walletExistsController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const exists = await walletExists25(orgId);
    return res.status(200).json({
      success: true,
      message: "Wallet existence checked successfully 🔍",
      data: { exists },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getPayoutCountController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const count = await getPayoutCount26(orgId);
    return res.status(200).json({
      success: true,
      message: "Payout history count retrieved successfully 📈",
      data: { count },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getLatestPayoutController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const latest = await getLatestPayout28(orgId);

    return res.status(200).json({
      success: true,
      message: "Latest payout retrieved successfully ⏱️",
      data: latest || null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const validateMethodOwnershipController = async (req: Request, res: Response) => {
  try {
    const methodId = Number(req.params.methodId);
    const orgId = Number(req.params.orgId);

    const valid = await validateMethodOwnership29(methodId, orgId);
    return res.status(200).json({
      success: true,
      message: "Method ownership validated successfully 🔐",
      data: { isValidOwner: valid },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getWalletOverviewController = async (req: Request, res: Response) => {
  try {
    const orgId = Number(req.params.orgId);
    const overview = await getWalletOverview30(orgId);

    return res.status(200).json({
      success: true,
      message: "Wallet overview retrieved successfully 🌟",
      data: overview,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

// Add this import at the top of your Wallet.controller.ts file if not already present:
// import { getBanksService } from "./Wallet.service";
// import { getBanksQuerySchema } from "../../validators/wallet.validators";

export const getBanksController = async (req: Request, res: Response) => {
  try {
    const parsed = getBanksQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.format(),
      });
    }

    const { country, currency } = parsed.data;
    const banks = await getBanksService(country, currency);

    return res.status(200).json({
      success: true,
      message: "Banks fetched successfully 🏦",
      data: banks,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};