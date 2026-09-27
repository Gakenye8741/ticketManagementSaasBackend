import { Router } from "express";
import {
  adminAuth,
  organizerAuth,
  adminOrOrganizerAuth,
} from "../../middleware/bearAuth"; // Adjust path to your auth middleware file as needed

import {
  getOrCreateWalletController,
  getWalletByOrgIdController,
  creditWalletController,
  debitWalletController,
  getWalletStatsController,
  requestPayoutController,
  getOrganizationPayoutsController,
  getPayoutByIdController,
  updatePayoutStatusController,
  getPendingPayoutsController,
  addPayoutMethodController,
  getOrganizationPayoutMethodsController,
  getPayoutMethodByIdController,
  setDefaultPayoutMethodController,
  deletePayoutMethodController,
  countPayoutMethodsController,
  getDefaultPayoutMethodController,
  updatePayoutMethodController,
  getPayoutsByStatusController,
  getTotalPaidOutController,
  hasSufficientBalanceController,
  clearPendingBalanceController,
  resetWalletController,
  getTotalPlatformPendingLiabilityController,
  walletExistsController,
  getPayoutCountController,
  bulkUpdatePayoutStatusController,
  getLatestPayoutController,
  validateMethodOwnershipController,
  getWalletOverviewController,
} from "./Wallet.controller";

const walletRouter = Router();

// ==========================================
// WALLET ROUTES (Secured with Auth)
// ==========================================
walletRouter.post("/wallets", adminOrOrganizerAuth, getOrCreateWalletController);
walletRouter.get("/wallets/:orgId", adminOrOrganizerAuth, getWalletByOrgIdController);
walletRouter.post("/wallets/credit", adminAuth, creditWalletController);
walletRouter.post("/wallets/debit", adminAuth, debitWalletController);
walletRouter.get("/wallets/:orgId/stats", adminOrOrganizerAuth, getWalletStatsController);
walletRouter.get("/wallets/:orgId/overview", adminOrOrganizerAuth, getWalletOverviewController);
walletRouter.get("/wallets/:orgId/exists", adminOrOrganizerAuth, walletExistsController);
walletRouter.get("/wallets/:orgId/balance-check", adminOrOrganizerAuth, hasSufficientBalanceController);
walletRouter.post("/wallets/:orgId/clear-pending", adminAuth, clearPendingBalanceController);
walletRouter.post("/wallets/:orgId/reset", adminAuth, resetWalletController);
walletRouter.get("/platform/pending-liability", adminAuth, getTotalPlatformPendingLiabilityController);

// ==========================================
// PAYOUT ROUTES (Secured with Auth)
// ==========================================
walletRouter.post("/payouts", organizerAuth, requestPayoutController);
walletRouter.get("/payouts/pending", adminAuth, getPendingPayoutsController);
walletRouter.patch("/payouts/bulk-status", adminAuth, bulkUpdatePayoutStatusController);
walletRouter.get("/payouts/org/:orgId", adminOrOrganizerAuth, getOrganizationPayoutsController);
walletRouter.get("/payouts/org/:orgId/latest", adminOrOrganizerAuth, getLatestPayoutController);
walletRouter.get("/payouts/org/:orgId/count", adminOrOrganizerAuth, getPayoutCountController);
walletRouter.get("/payouts/org/:orgId/total-paid", adminOrOrganizerAuth, getTotalPaidOutController);
walletRouter.get("/payouts/org/:orgId/status/:status", adminOrOrganizerAuth, getPayoutsByStatusController);
walletRouter.get("/payouts/:payoutId", adminOrOrganizerAuth, getPayoutByIdController);
walletRouter.patch("/payouts/:payoutId/status", adminAuth, updatePayoutStatusController);

// ==========================================
// PAYOUT METHODS ROUTES (Secured with Auth)
// ==========================================
walletRouter.post("/payout-methods", organizerAuth, addPayoutMethodController);
walletRouter.get("/payout-methods/org/:orgId", adminOrOrganizerAuth, getOrganizationPayoutMethodsController);
walletRouter.get("/payout-methods/org/:orgId/default", adminOrOrganizerAuth, getDefaultPayoutMethodController);
walletRouter.get("/payout-methods/org/:orgId/count", adminOrOrganizerAuth, countPayoutMethodsController);
walletRouter.get("/payout-methods/:methodId", adminOrOrganizerAuth, getPayoutMethodByIdController);
walletRouter.patch("/payout-methods/:methodId/default", organizerAuth, setDefaultPayoutMethodController);
walletRouter.patch("/payout-methods/:methodId", organizerAuth, updatePayoutMethodController);
walletRouter.delete("/payout-methods/:methodId", organizerAuth, deletePayoutMethodController);
walletRouter.get("/payout-methods/:methodId/validate/:orgId", adminOrOrganizerAuth, validateMethodOwnershipController);

export default walletRouter;