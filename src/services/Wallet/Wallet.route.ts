import { Router } from "express";
import {
  adminAuth,
  organizerAuth,
  adminOrOrganizerAuth,
} from "../../middleware/bearAuth";
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
  sendPayoutController,
  reconcilePayoutController,
  bulkSendPayoutsController,
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
  getLatestPayoutController,
  validateMethodOwnershipController,
  getWalletOverviewController,
  getBanksController,
} from "./Wallet.controller";
import { enforceOrgParam, forceOrgFromToken } from "../../middleware/Orgaccess";

const walletRouter = Router();

// ==========================================
// WALLET ROUTES
// ==========================================
walletRouter.post("/wallets", adminOrOrganizerAuth, forceOrgFromToken, getOrCreateWalletController);
walletRouter.post("/wallets/credit", adminAuth, creditWalletController);
walletRouter.post("/wallets/debit", adminAuth, debitWalletController);
walletRouter.get("/wallets/:orgId", adminOrOrganizerAuth, enforceOrgParam, getWalletByOrgIdController);
walletRouter.get("/wallets/:orgId/stats", adminOrOrganizerAuth, enforceOrgParam, getWalletStatsController);
walletRouter.get("/wallets/:orgId/overview", adminOrOrganizerAuth, enforceOrgParam, getWalletOverviewController);
walletRouter.get("/wallets/:orgId/exists", adminOrOrganizerAuth, enforceOrgParam, walletExistsController);
walletRouter.get("/wallets/:orgId/balance-check", adminOrOrganizerAuth, enforceOrgParam, hasSufficientBalanceController);
walletRouter.post("/wallets/:orgId/clear-pending", adminAuth, clearPendingBalanceController);
walletRouter.post("/wallets/:orgId/reset", adminAuth, resetWalletController);
walletRouter.get("/platform/pending-liability", adminAuth, getTotalPlatformPendingLiabilityController);

// ==========================================
// PAYOUT ROUTES
// ==========================================
// Organizer
walletRouter.post("/payouts", organizerAuth, forceOrgFromToken, requestPayoutController);

// Admin (static paths first so they are not swallowed by /payouts/:payoutId)
walletRouter.get("/payouts/pending", adminAuth, getPendingPayoutsController);
walletRouter.post("/payouts/bulk-send", adminAuth, bulkSendPayoutsController); // replaces PATCH /payouts/bulk-status

// Organizer or admin, scoped to their own org
walletRouter.get("/payouts/org/:orgId", adminOrOrganizerAuth, enforceOrgParam, getOrganizationPayoutsController);
walletRouter.get("/payouts/org/:orgId/latest", adminOrOrganizerAuth, enforceOrgParam, getLatestPayoutController);
walletRouter.get("/payouts/org/:orgId/count", adminOrOrganizerAuth, enforceOrgParam, getPayoutCountController);
walletRouter.get("/payouts/org/:orgId/total-paid", adminOrOrganizerAuth, enforceOrgParam, getTotalPaidOutController);
walletRouter.get("/payouts/org/:orgId/status/:status", adminOrOrganizerAuth, enforceOrgParam, getPayoutsByStatusController);

// By payout ID (the controller checks the payout belongs to the caller's org)
walletRouter.get("/payouts/:payoutId", adminOrOrganizerAuth, getPayoutByIdController);

// Admin actions on one payout
walletRouter.post("/payouts/:payoutId/send", adminAuth, sendPayoutController);
walletRouter.post("/payouts/:payoutId/reconcile", adminAuth, reconcilePayoutController);
walletRouter.patch("/payouts/:payoutId/status", adminAuth, updatePayoutStatusController); // manual override, Pending only

// ==========================================
// PAYOUT METHODS ROUTES
// ==========================================
walletRouter.post("/payout-methods", organizerAuth, forceOrgFromToken, addPayoutMethodController);
walletRouter.get("/payout-methods/org/:orgId", adminOrOrganizerAuth, enforceOrgParam, getOrganizationPayoutMethodsController);
walletRouter.get("/payout-methods/org/:orgId/default", adminOrOrganizerAuth, enforceOrgParam, getDefaultPayoutMethodController);
walletRouter.get("/payout-methods/org/:orgId/count", adminOrOrganizerAuth, enforceOrgParam, countPayoutMethodsController);
walletRouter.get("/payout-methods/:methodId/validate/:orgId", adminOrOrganizerAuth, enforceOrgParam, validateMethodOwnershipController);
walletRouter.get("/payout-methods/:methodId", adminOrOrganizerAuth, getPayoutMethodByIdController); // controller checks ownership
walletRouter.patch("/payout-methods/:methodId/default", organizerAuth, forceOrgFromToken, setDefaultPayoutMethodController);
walletRouter.patch("/payout-methods/:methodId", organizerAuth, forceOrgFromToken, updatePayoutMethodController);
walletRouter.delete("/payout-methods/:methodId", organizerAuth, forceOrgFromToken, deletePayoutMethodController);

walletRouter.get("/banks", adminOrOrganizerAuth, getBanksController);
walletRouter.get("/payout-methods/banks", adminOrOrganizerAuth, getBanksController);
export default walletRouter;