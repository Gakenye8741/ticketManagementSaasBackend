import { randomUUID } from "crypto";
import db from "../../drizzle/db";
import {
  wallets,
  payouts,
  organizerPayoutMethods,
  TSelectWallet,
  TSelectPayout,
  TSelectPayoutMethod,
  TInsertPayoutMethod,
} from "../../drizzle/schema";
import { eq, and, sql, desc, lt } from "drizzle-orm";
import { createTransferRecipient, getPaystackBalance, initiateTransfer, PaystackTransferError, toRecipientSpec, verifyTransfer } from "../payments/Mpesa/Paystack.transfers";


type PayoutStatus = TSelectPayout["status"];

interface RequestPayoutInput {
  orgId: number;
  amount: number;
  methodId?: number;
}

const MIN_PAYOUT_KES = 100; // choose your minimum; also check Paystack's Kenya minimum

/**
 * Fee charged to the organizer. 0 = the platform absorbs Paystack's transfer fee.
 * If you return a fee here, we send (amount - fee) to the organizer.
 */
export const calcPayoutFee = (_amount: number, _accountType: string): number => 0;

// Paystack references: lowercase letters, digits, - and _, 16-50 chars
const makePayoutReference = () => `po_${randomUUID()}`; // 39 chars

// ==========================================
// WALLET FUNCTIONS
// ==========================================

/** 1. Get or create a wallet for an organization */
export const getOrCreateWallet1 = async (orgId: number, currency = "KES"): Promise<TSelectWallet> => {
  return await db.transaction(async (tx) => {
    let [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId));

    if (!wallet) {
      [wallet] = await tx
        .insert(wallets)
        .values({ orgId, currency })
        .returning();
    }

    return wallet;
  });
};

/** 2. Get wallet balance details by orgId */
export const getWalletByOrgId2 = async (orgId: number): Promise<TSelectWallet | undefined> => {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.orgId, orgId));
  return wallet;
};

/** 3. Credit wallet balance and add to total earned (INTERNAL / ADMIN ONLY) */
export const creditWallet3 = async (orgId: number, amount: number): Promise<TSelectWallet> => {
  if (amount <= 0) throw new Error("Credit amount must be greater than zero.");

  return await db.transaction(async (tx) => {
    const wallet = await getOrCreateWallet1(orgId);

    const [updated] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amount}`,
        totalEarned: sql`${wallets.totalEarned} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.walletId, wallet.walletId))
      .returning();

    return updated;
  });
};

/** 4. Debit wallet balance (INTERNAL / ADMIN ONLY) */
export const debitWallet4 = async (orgId: number, amount: number): Promise<TSelectWallet> => {
  if (amount <= 0) throw new Error("Debit amount must be greater than zero.");

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found.");
    if (Number(wallet.balance) < amount) throw new Error("Insufficient wallet balance.");

    const [updated] = await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.walletId, wallet.walletId))
      .returning();

    return updated;
  });
};

/** 5. Get wallet summary stats */
export const getWalletStats5 = async (orgId: number) => {
  const wallet = await getWalletByOrgId2(orgId);
  if (!wallet) throw new Error("Wallet not found.");

  return {
    balance: Number(wallet.balance),
    pendingBalance: Number(wallet.pendingBalance),
    totalEarned: Number(wallet.totalEarned),
    currency: wallet.currency,
  };
};

// ==========================================
// PAYOUT FUNCTIONS
// ==========================================

/** 6. Request a new payout (reserves the money: balance -> pendingBalance) */
export const requestPayout6 = async ({
  orgId,
  amount,
  methodId,
}: RequestPayoutInput): Promise<{ success: boolean; message: string; payout: TSelectPayout }> => {
  if (!Number.isFinite(amount) || amount < MIN_PAYOUT_KES) {
    throw new Error(`Minimum payout is KES ${MIN_PAYOUT_KES}.`);
  }

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found.");
    if (Number(wallet.balance) < amount) throw new Error("Insufficient balance for payout.");

    const [method] = await tx
      .select()
      .from(organizerPayoutMethods)
      .where(
        methodId
          ? and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId))
          : and(eq(organizerPayoutMethods.orgId, orgId), eq(organizerPayoutMethods.isDefault, true))
      );

    if (!method) {
      throw new Error(methodId ? "Selected payout method not found." : "No default payout method configured.");
    }

    const fee = calcPayoutFee(amount, method.accountType);
    if (amount <= fee) throw new Error("Amount must be greater than the payout fee.");

    await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${amount}`,
        pendingBalance: sql`${wallets.pendingBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.walletId, wallet.walletId));

    const [newPayout] = await tx
      .insert(payouts)
      .values({
        walletId: wallet.walletId,
        orgId,
        methodId: method.methodId,
        amount: amount.toFixed(2),
        fee: fee.toFixed(2),
        status: "Pending",
        destinationAccount: method.accountNumber,
        destinationType: method.accountType,
        reference: makePayoutReference(),
      })
      .returning();

    return {
      success: true,
      message: "Payout requested successfully.",
      payout: newPayout,
    };
  });
};

/** 7. Get all payouts for an organization */
export const getOrganizationPayouts7 = async (orgId: number): Promise<TSelectPayout[]> => {
  return await db
    .select()
    .from(payouts)
    .where(eq(payouts.orgId, orgId))
    .orderBy(desc(payouts.createdAt));
};

/** 8. Get payout by ID */
export const getPayoutById8 = async (payoutId: number): Promise<TSelectPayout | undefined> => {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.payoutId, payoutId));
  return payout;
};

// ------------------------------------------------------------
// Single place where a payout changes state and wallet money moves
// ------------------------------------------------------------
type Outcome = "success" | "failed" | "reversed";

const applyOutcome = async (tx: any, payout: TSelectPayout, outcome: Outcome, reason?: string): Promise<TSelectPayout> => {
  const s = payout.status;
  let next: PayoutStatus;
  let walletSet: Record<string, unknown>;

  if (outcome === "success") {
    if (s === "Completed") return payout; // idempotent (webhook retries)
    if (s !== "Pending" && s !== "Processing") {
      throw new Error(`Payout ${payout.payoutId} is ${s} and was already refunded. Review manually.`);
    }
    next = "Completed";
    walletSet = { pendingBalance: sql`${wallets.pendingBalance} - ${payout.amount}` };
  } else if (outcome === "failed") {
    if (s === "Failed") return payout;
    if (s !== "Pending" && s !== "Processing") throw new Error(`Cannot fail a ${s} payout.`);
    next = "Failed";
    walletSet = {
      balance: sql`${wallets.balance} + ${payout.amount}`,
      pendingBalance: sql`${wallets.pendingBalance} - ${payout.amount}`,
    };
  } else {
    if (s === "Reversed" || s === "Failed") return payout;
    if (s === "Completed") {
      // money already left pendingBalance; give it back to the organizer
      next = "Reversed";
      walletSet = { balance: sql`${wallets.balance} + ${payout.amount}` };
    } else {
      next = "Failed";
      walletSet = {
        balance: sql`${wallets.balance} + ${payout.amount}`,
        pendingBalance: sql`${wallets.pendingBalance} - ${payout.amount}`,
      };
    }
  }

  const [updated] = await tx
    .update(payouts)
    .set({ status: next, failureReason: reason ?? payout.failureReason, updatedAt: new Date() })
    .where(eq(payouts.payoutId, payout.payoutId))
    .returning();

  await tx
    .update(wallets)
    .set({ ...walletSet, updatedAt: new Date() })
    .where(eq(wallets.walletId, payout.walletId));

  return updated as TSelectPayout;
};

/** 9. Manual admin override (Pending payouts only). Payouts in flight at Paystack can't be overridden. */
export const updatePayoutStatus9 = async (
  payoutId: number,
  status: "Completed" | "Failed",
  transactionReference?: string
): Promise<TSelectPayout> => {
  return await db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.payoutId, payoutId))
      .for("update");

    if (!payout) throw new Error("Payout not found.");
    if (payout.status === "Processing") {
      throw new Error("Payout is in flight at Paystack. Wait for the webhook or run reconcile.");
    }

    let updated = await applyOutcome(tx, payout, status === "Completed" ? "success" : "failed");

    if (transactionReference) {
      [updated] = await tx
        .update(payouts)
        .set({ transactionReference })
        .where(eq(payouts.payoutId, payoutId))
        .returning();
    }
    return updated;
  });
};

/** 10. Get pending payouts */
export const getPendingPayouts10 = async (): Promise<TSelectPayout[]> => {
  return await db
    .select()
    .from(payouts)
    .where(eq(payouts.status, "Pending"))
    .orderBy(desc(payouts.createdAt));
};

// ==========================================
// PAYOUT METHODS (SAVED ACCOUNTS)
// ==========================================

/** 11. Add saved payout method */
export const addPayoutMethod11 = async (data: TInsertPayoutMethod): Promise<TSelectPayoutMethod> => {
  return await db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx
        .update(organizerPayoutMethods)
        .set({ isDefault: false })
        .where(eq(organizerPayoutMethods.orgId, data.orgId));
    }

    const [method] = await tx
      .insert(organizerPayoutMethods)
      .values(data)
      .returning();

    return method;
  });
};

/** 12. Get all payout methods for an org */
export const getOrganizationPayoutMethods12 = async (orgId: number): Promise<TSelectPayoutMethod[]> => {
  return await db
    .select()
    .from(organizerPayoutMethods)
    .where(eq(organizerPayoutMethods.orgId, orgId))
    .orderBy(desc(organizerPayoutMethods.isDefault));
};

/** 13. Get single payout method by ID */
export const getPayoutMethodById13 = async (methodId: number): Promise<TSelectPayoutMethod | undefined> => {
  const [method] = await db
    .select()
    .from(organizerPayoutMethods)
    .where(eq(organizerPayoutMethods.methodId, methodId));
  return method;
};

/** 14. Set default payout method */
export const setDefaultPayoutMethod14 = async (methodId: number, orgId: number): Promise<TSelectPayoutMethod> => {
  return await db.transaction(async (tx) => {
    await tx
      .update(organizerPayoutMethods)
      .set({ isDefault: false })
      .where(eq(organizerPayoutMethods.orgId, orgId));

    const [updated] = await tx
      .update(organizerPayoutMethods)
      .set({ isDefault: true })
      .where(and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId)))
      .returning();

    if (!updated) throw new Error("Payout method not found.");
    return updated;
  });
};

/** 15. Delete saved payout method */
export const deletePayoutMethod15 = async (methodId: number, orgId: number): Promise<boolean> => {
  const result = await db
    .delete(organizerPayoutMethods)
    .where(and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId)))
    .returning();

  return result.length > 0;
};

/** 16. Count organization payout methods */
export const countPayoutMethods16 = async (orgId: number): Promise<number> => {
  const methods = await getOrganizationPayoutMethods12(orgId);
  return methods.length;
};

/** 17. Get default payout method for organization */
export const getDefaultPayoutMethod17 = async (orgId: number): Promise<TSelectPayoutMethod | undefined> => {
  const [method] = await db
    .select()
    .from(organizerPayoutMethods)
    .where(and(eq(organizerPayoutMethods.orgId, orgId), eq(organizerPayoutMethods.isDefault, true)));
  return method;
};

/** 18. Update saved payout method details */
export const updatePayoutMethod18 = async (
  methodId: number,
  orgId: number,
  data: Partial<TInsertPayoutMethod>
): Promise<TSelectPayoutMethod> => {
  return await db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx
        .update(organizerPayoutMethods)
        .set({ isDefault: false })
        .where(eq(organizerPayoutMethods.orgId, orgId));
    }

    // Account details changed -> the cached Paystack recipient is no longer valid
    const detailsChanged =
      data.accountNumber !== undefined || data.accountType !== undefined || (data as any).bankCode !== undefined;

    const [updated] = await tx
      .update(organizerPayoutMethods)
      .set({ ...data, ...(detailsChanged ? { recipientCode: null } : {}) })
      .where(and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId)))
      .returning();

    if (!updated) throw new Error("Payout method not found.");
    return updated;
  });
};

/** 19. Get payouts by status */
export const getPayoutsByStatus19 = async (orgId: number, status: PayoutStatus): Promise<TSelectPayout[]> => {
  return await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.orgId, orgId), eq(payouts.status, status)))
    .orderBy(desc(payouts.createdAt));
};

/** 20. Calculate total paid out amount for organization */
export const getTotalPaidOut20 = async (orgId: number): Promise<number> => {
  const completedPayouts = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.orgId, orgId), eq(payouts.status, "Completed")));

  return completedPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
};

/** 21. Check if organization has sufficient balance */
export const hasSufficientBalance21 = async (orgId: number, amount: number): Promise<boolean> => {
  const wallet = await getWalletByOrgId2(orgId);
  if (!wallet) return false;
  return Number(wallet.balance) >= amount;
};

/** 22. Clear pending balance (ADMIN ONLY. Dangerous while payouts are Processing.) */
export const clearPendingBalance22 = async (orgId: number): Promise<TSelectWallet> => {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found.");

    const [inFlight] = await tx
      .select({ id: payouts.payoutId })
      .from(payouts)
      .where(and(eq(payouts.orgId, orgId), eq(payouts.status, "Processing")))
      .limit(1);
    if (inFlight) throw new Error("Cannot clear pending balance while payouts are Processing.");

    const [updated] = await tx
      .update(wallets)
      .set({
        pendingBalance: "0.00",
        updatedAt: new Date(),
      })
      .where(eq(wallets.walletId, wallet.walletId))
      .returning();

    return updated;
  });
};

/** 23. Reset wallet data (ADMIN ONLY. Consider removing this in production.) */
export const resetWallet23 = async (orgId: number): Promise<TSelectWallet> => {
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(wallets)
      .set({
        balance: "0.00",
        pendingBalance: "0.00",
        totalEarned: "0.00",
        updatedAt: new Date(),
      })
      .where(eq(wallets.orgId, orgId))
      .returning();

    if (!updated) throw new Error("Wallet not found.");
    return updated;
  });
};

/** 24. Get total platform pending payout liability */
export const getTotalPlatformPendingLiability24 = async (): Promise<number> => {
  const allWallets = await db.select().from(wallets);
  return allWallets.reduce((sum, w) => sum + Number(w.pendingBalance), 0);
};

/** 25. Verify wallet exists */
export const walletExists25 = async (orgId: number): Promise<boolean> => {
  const wallet = await getWalletByOrgId2(orgId);
  return !!wallet;
};

/** 26. Get payout history summary count */
export const getPayoutCount26 = async (orgId: number): Promise<number> => {
  const list = await getOrganizationPayouts7(orgId);
  return list.length;
};

// 27. (removed) bulkUpdatePayoutStatus27 swallowed errors. See bulkSendPayouts below.

/** 28. Get latest payout request */
export const getLatestPayout28 = async (orgId: number): Promise<TSelectPayout | undefined> => {
  const [payout] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.orgId, orgId))
    .orderBy(desc(payouts.createdAt))
    .limit(1);
  return payout;
};

/** 29. Validate payout method ownership */
export const validateMethodOwnership29 = async (methodId: number, orgId: number): Promise<boolean> => {
  const method = await getPayoutMethodById13(methodId);
  return !!method && method.orgId === orgId;
};

/** 30. Get wallet summary with payout method count */
export const getWalletOverview30 = async (orgId: number) => {
  const wallet = await getOrCreateWallet1(orgId);
  const methodCount = await countPayoutMethods16(orgId);
  const defaultMethod = await getDefaultPayoutMethod17(orgId);

  return {
    wallet,
    methodCount,
    defaultMethod: defaultMethod || null,
  };
};

// ==========================================
// PAYSTACK TRANSFERS (new)
// ==========================================

/** 31. Called by the webhook and by reconcile. Idempotent. */
export const applyTransferOutcomeByReference = async (
  reference: string,
  outcome: Outcome,
  opts: { reason?: string; amountKes?: number } = {}
): Promise<TSelectPayout | null> => {
  return await db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.reference, reference))
      .for("update");

    if (!payout) {
      console.warn(`[PAYOUT] No payout for reference ${reference}, ignoring.`);
      return null;
    }

    if (outcome === "success" && opts.amountKes !== undefined) {
      const expected = Number(payout.amount) - Number(payout.fee);
      if (Math.abs(opts.amountKes - expected) > 0.01) {
        throw new Error(`Payout ${payout.payoutId}: Paystack amount ${opts.amountKes} != expected ${expected}`);
      }
    }

    return applyOutcome(tx, payout, outcome, opts.reason);
  });
};

/** Resolve (or create and cache) the Paystack recipient for a payout's saved method */
const ensureRecipient = async (payout: TSelectPayout): Promise<string> => {
  if (!payout.methodId) throw new Error("Payout has no saved payout method (legacy payout?).");

  const [m] = await db
    .select()
    .from(organizerPayoutMethods)
    .where(and(eq(organizerPayoutMethods.methodId, payout.methodId), eq(organizerPayoutMethods.orgId, payout.orgId)));

  if (!m) throw new Error("Payout method no longer exists.");

  if (m.accountNumber !== payout.destinationAccount) {
    throw new Error("Payout method was edited after this payout was requested. Reject it and ask for a new request.");
  }
  if (m.recipientCode) return m.recipientCode;

  const spec = toRecipientSpec(m);
  const code = await createTransferRecipient({ ...spec, name: m.accountName });
  await db
    .update(organizerPayoutMethods)
    .set({ recipientCode: code })
    .where(eq(organizerPayoutMethods.methodId, m.methodId));
  return code;
};

/** 32. Send a Pending payout through Paystack (admin approval, or call automatically) */
export const sendPayout = async (payoutId: number): Promise<TSelectPayout> => {
  // 1. Claim it: only one caller can move Pending -> Processing (prevents double sends)
  const claimed = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.payoutId, payoutId)).for("update");
    if (!p) throw new Error("Payout not found.");
    if (p.status !== "Pending") throw new Error(`Payout is ${p.status}; only Pending payouts can be sent.`);
    if (!p.reference) throw new Error("Payout has no reference (legacy payout). Use the manual status update.");

    const [u] = await tx
      .update(payouts)
      .set({ status: "Processing", failureReason: null, updatedAt: new Date() })
      .where(eq(payouts.payoutId, payoutId))
      .returning();
    return u;
  });

  const backToPending = async (reason: string) => {
    await db
      .update(payouts)
      .set({ status: "Pending", failureReason: reason, updatedAt: new Date() })
      .where(and(eq(payouts.payoutId, payoutId), eq(payouts.status, "Processing")));
  };

  const sendAmount = Number(claimed.amount) - Number(claimed.fee);

  // 2. Pre-flight: nothing has been sent yet, so any failure here is safe to revert
  let recipientCode: string;
  try {
    recipientCode = await ensureRecipient(claimed);
    const available = await getPaystackBalance();
    if (available < sendAmount) {
      throw new Error("Paystack balance is too low to cover this payout. Top up or wait for settlement.");
    }
  } catch (e: any) {
    await backToPending(e.message);
    throw e;
  }

  // 3. The actual transfer
  try {
    const t = await initiateTransfer({
      amount: sendAmount,
      recipientCode,
      reference: claimed.reference!,
      reason: `Payout #${claimed.payoutId}`,
    });

    await db
      .update(payouts)
      .set({ transactionReference: t.transfer_code, updatedAt: new Date() })
      .where(eq(payouts.payoutId, payoutId));

    if (t.status === "otp") {
      throw new Error("Paystack requires OTP for transfers. Disable it (Settings > Preferences) for automatic payouts.");
    }
    // "pending" is the normal answer; the webhook finishes the job.
  } catch (e: any) {
    if (e instanceof PaystackTransferError && e.definitive) {
      await backToPending(e.message); // Paystack rejected it, nothing was sent
    }
    // Ambiguous (timeout / 5xx / otp): stay Processing; reconcilePayout settles it safely.
    throw e;
  }

  const [fresh] = await db.select().from(payouts).where(eq(payouts.payoutId, payoutId));
  return fresh;
};

/** 33. Safety net for missed webhooks and ambiguous errors */
export const reconcilePayout = async (payoutId: number): Promise<TSelectPayout> => {
  const [p] = await db.select().from(payouts).where(eq(payouts.payoutId, payoutId));
  if (!p) throw new Error("Payout not found.");
  if (p.status !== "Processing" || !p.reference) return p;

  try {
    const t = await verifyTransfer(p.reference);

    if (t.status === "success") {
      return (await applyTransferOutcomeByReference(p.reference, "success", { amountKes: t.amount / 100 })) ?? p;
    }
    if (t.status === "failed") {
      return (await applyTransferOutcomeByReference(p.reference, "failed", { reason: "Paystack reported the transfer failed" })) ?? p;
    }
    if (t.status === "reversed") {
      return (await applyTransferOutcomeByReference(p.reference, "reversed", { reason: "Transfer reversed by Paystack" })) ?? p;
    }
    return p; // pending / processing / received: still in flight
  } catch (e: any) {
    // Paystack has no record of this reference after a while: the transfer never happened
    const ageMs = Date.now() - new Date(p.updatedAt).getTime();
    if (e instanceof PaystackTransferError && e.httpStatus === 404 && ageMs > 15 * 60_000) {
      await db
        .update(payouts)
        .set({ status: "Pending", failureReason: "Transfer never reached Paystack", updatedAt: new Date() })
        .where(and(eq(payouts.payoutId, payoutId), eq(payouts.status, "Processing")));
      const [fresh] = await db.select().from(payouts).where(eq(payouts.payoutId, payoutId));
      return fresh;
    }
    throw e;
  }
};

/** 34. Run every few minutes from a cron / setInterval */
export const reconcileStuckPayouts = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const stuck = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.status, "Processing"), lt(payouts.updatedAt, cutoff)))
    .orderBy(desc(payouts.createdAt));

  let n = 0;
  for (const p of stuck) {
    try {
      await reconcilePayout(p.payoutId);
      n++;
    } catch (err: any) {
      console.error(`[PAYOUT] reconcile ${p.payoutId} failed:`, err.message);
    }
  }
  return n;
};

/** 35. Send several payouts, reporting success or error for each */
export const bulkSendPayouts = async (payoutIds: number[]) => {
  const results: { payoutId: number; ok: boolean; error?: string }[] = [];
  for (const id of payoutIds) {
    try {
      await sendPayout(id);
      results.push({ payoutId: id, ok: true });
    } catch (e: any) {
      results.push({ payoutId: id, ok: false, error: e.message });
    }
  }
  return results;
};

// Add to Wallet.service.ts

export const getBanksService = async (country = "kenya", currency = "KES") => {
  const response = await fetch(`https://api.paystack.co/bank?country=${country}&currency=${currency}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || "Failed to fetch banks from Paystack");
  }

  return data.data.map((b: any) => ({
    name: b.name,
    code: b.code,
    longcode: b.longcode,
    id: b.id,
  }));
};