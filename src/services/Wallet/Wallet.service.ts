import db from "../../drizzle/db";
import { 
  wallets, 
  payouts, 
  organizerPayoutMethods, 
  organizations,
  TSelectWallet,
  TInsertWallet,
  TSelectPayout,
  TInsertPayout,
  TSelectPayoutMethod,
  TInsertPayoutMethod
} from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

interface RequestPayoutInput {
  orgId: number;
  amount: number;
  methodId?: number;
}

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

/** 3. Credit wallet balance and add to total earned */
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

/** 4. Debit wallet balance */
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

/** 6. Request a new payout */
export const requestPayout6 = async ({ orgId, amount, methodId }: RequestPayoutInput): Promise<{ success: boolean; message: string; payout: TSelectPayout }> => {
  if (amount <= 0) throw new Error("Payout amount must be greater than zero.");

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found.");
    if (Number(wallet.balance) < amount) throw new Error("Insufficient balance for payout.");

    let destination: { accountNumber: string; accountType: string };

    if (methodId) {
      const [method] = await tx
        .select()
        .from(organizerPayoutMethods)
        .where(and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId)));

      if (!method) throw new Error("Selected payout method not found.");
      destination = { accountNumber: method.accountNumber, accountType: method.accountType };
    } else {
      const [defaultMethod] = await tx
        .select()
        .from(organizerPayoutMethods)
        .where(and(eq(organizerPayoutMethods.orgId, orgId), eq(organizerPayoutMethods.isDefault, true)));

      if (!defaultMethod) throw new Error("No default payout method configured.");
      destination = { accountNumber: defaultMethod.accountNumber, accountType: defaultMethod.accountType };
    }

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
        amount: amount.toFixed(2),
        fee: "0.00",
        status: "Pending",
        destinationAccount: destination.accountNumber,
        destinationType: destination.accountType,
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

/** 9. Update Payout Status (Completed / Failed) */
export const updatePayoutStatus9 = async (payoutId: number, status: "Completed" | "Failed", transactionReference?: string): Promise<TSelectPayout> => {
  return await db.transaction(async (tx) => {
    const [payout] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.payoutId, payoutId));

    if (!payout) throw new Error("Payout not found.");
    if (payout.status === "Completed") throw new Error("Payout is already completed.");

    const [updatedPayout] = await tx
      .update(payouts)
      .set({
        status,
        transactionReference: transactionReference || payout.transactionReference,
        updatedAt: new Date(),
      })
      .where(eq(payouts.payoutId, payoutId))
      .returning();

    if (status === "Failed" && payout.status !== "Failed") {
      await tx
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${payout.amount}`,
          pendingBalance: sql`${wallets.pendingBalance} - ${payout.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.walletId, payout.walletId));
    } else if (status === "Completed" && payout.status === "Pending") {
      await tx
        .update(wallets)
        .set({
          pendingBalance: sql`${wallets.pendingBalance} - ${payout.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.walletId, payout.walletId));
    }

    return updatedPayout;
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
export const updatePayoutMethod18 = async (methodId: number, orgId: number, data: Partial<TInsertPayoutMethod>): Promise<TSelectPayoutMethod> => {
  return await db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx
        .update(organizerPayoutMethods)
        .set({ isDefault: false })
        .where(eq(organizerPayoutMethods.orgId, orgId));
    }

    const [updated] = await tx
      .update(organizerPayoutMethods)
      .set(data)
      .where(and(eq(organizerPayoutMethods.methodId, methodId), eq(organizerPayoutMethods.orgId, orgId)))
      .returning();

    if (!updated) throw new Error("Payout method not found.");
    return updated;
  });
};

/** 19. Get payouts by status */
export const getPayoutsByStatus19 = async (orgId: number, status: "Pending" | "Completed" | "Failed"): Promise<TSelectPayout[]> => {
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

/** 22. Clear pending balance */
export const clearPendingBalance22 = async (orgId: number): Promise<TSelectWallet> => {
  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId));

    if (!wallet) throw new Error("Wallet not found.");

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

/** 23. Reset wallet data */
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

/** 27. Bulk update payout statuses */
export const bulkUpdatePayoutStatus27 = async (payoutIds: number[], status: "Completed" | "Failed"): Promise<number> => {
  let count = 0;
  for (const id of payoutIds) {
    try {
      await updatePayoutStatus9(id, status);
      count++;
    } catch (err) {
      // Skip failed individual updates in bulk sequence
    }
  }
  return count;
};

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