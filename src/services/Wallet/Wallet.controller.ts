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
  bulkUpdatePayoutStatus27,
  getLatestPayout28,
  validateMethodOwnership29,
  getWalletOverview30,
} from "./Wallet.service";

import {
  getOrCreateWalletSchema,
  creditWalletSchema,
  debitWalletSchema,
  requestPayoutSchema,
  updatePayoutStatusSchema,
  insertPayoutMethodSchema,
  updatePayoutMethodSchema,
  bulkUpdatePayoutStatusSchema,
} from "../../validators/wallet.validators";

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

    if (!payout) {
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

    if (!method) {
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
    const orgId = Number(req.body.orgId);

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
    const orgId = Number(req.query.orgId || req.body.orgId);

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
    const status = req.params.status as "Pending" | "Completed" | "Failed";

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

export const bulkUpdatePayoutStatusController = async (req: Request, res: Response) => {
  try {
    const parsed = bulkUpdatePayoutStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Validation error", errors: parsed.error.format() });
    }

    const updatedCount = await bulkUpdatePayoutStatus27(parsed.data.payoutIds, parsed.data.status);
    return res.status(200).json({
      success: true,
      message: `Bulk status update completed. Successfully updated ${updatedCount} payouts ⚡`,
      data: { updatedCount },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to perform bulk update" });
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