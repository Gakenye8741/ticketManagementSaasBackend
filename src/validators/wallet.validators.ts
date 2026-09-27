import { z } from "zod";

// ==========================================
// COMMON PRIMITIVES
// ==========================================

const positiveNumberSchema = z.number().positive("Amount must be greater than zero");
const idSchema = z.number().int().positive("Invalid ID");

// ==========================================
// WALLET SCHEMAS
// ==========================================

export const getOrCreateWalletSchema = z.object({
  orgId: idSchema,
  currency: z.string().default("KES"),
});

export const getWalletByOrgIdSchema = z.object({
  orgId: idSchema,
});

export const creditWalletSchema = z.object({
  orgId: idSchema,
  amount: positiveNumberSchema,
});

export const debitWalletSchema = z.object({
  orgId: idSchema,
  amount: positiveNumberSchema,
});

export const getWalletStatsSchema = z.object({
  orgId: idSchema,
});

// ==========================================
// PAYOUT SCHEMAS
// ==========================================

export const requestPayoutSchema = z.object({
  orgId: idSchema,
  amount: positiveNumberSchema,
  methodId: idSchema.optional(),
});

export const getOrganizationPayoutsSchema = z.object({
  orgId: idSchema,
});

export const getPayoutByIdSchema = z.object({
  payoutId: idSchema,
});

export const updatePayoutStatusSchema = z.object({
  payoutId: idSchema,
  status: z.enum(["Completed", "Failed"]),
  transactionReference: z.string().optional(),
});

// ==========================================
// PAYOUT METHODS SCHEMAS
// ==========================================

export const insertPayoutMethodSchema = z.object({
  orgId: idSchema,
  accountNumber: z.string().min(1, "Account number is required"),
  accountType: z.string().min(1, "Account type is required"),
  accountName: z.string().min(1, "Account name is required"), // 👈 Added this
  isDefault: z.boolean().default(false),
});

export const getOrganizationPayoutMethodsSchema = z.object({
  orgId: idSchema,
});

export const getPayoutMethodByIdSchema = z.object({
  methodId: idSchema,
});

export const setDefaultPayoutMethodSchema = z.object({
  methodId: idSchema,
  orgId: idSchema,
});

export const deletePayoutMethodSchema = z.object({
  methodId: idSchema,
  orgId: idSchema,
});

export const countPayoutMethodsSchema = z.object({
  orgId: idSchema,
});

export const getDefaultPayoutMethodSchema = z.object({
  orgId: idSchema,
});

export const updatePayoutMethodSchema = z.object({
  methodId: idSchema,
  orgId: idSchema,
  data: z.object({
    accountNumber: z.string().min(1).optional(),
    accountType: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const getPayoutsByStatusSchema = z.object({
  orgId: idSchema,
  status: z.enum(["Pending", "Completed", "Failed"]),
});

export const getTotalPaidOutSchema = z.object({
  orgId: idSchema,
});

export const hasSufficientBalanceSchema = z.object({
  orgId: idSchema,
  amount: positiveNumberSchema,
});

export const clearPendingBalanceSchema = z.object({
  orgId: idSchema,
});

export const resetWalletSchema = z.object({
  orgId: idSchema,
});

export const walletExistsSchema = z.object({
  orgId: idSchema,
});

export const getPayoutCountSchema = z.object({
  orgId: idSchema,
});

export const bulkUpdatePayoutStatusSchema = z.object({
  payoutIds: z.array(idSchema).min(1, "At least one payout ID is required"),
  status: z.enum(["Completed", "Failed"]),
});

export const getLatestPayoutSchema = z.object({
  orgId: idSchema,
});

export const validateMethodOwnershipSchema = z.object({
  methodId: idSchema,
  orgId: idSchema,
});

export const getWalletOverviewSchema = z.object({
  orgId: idSchema,
});

// ==========================================
// EXPORTED TYPES (Inferred from Zod)
// ==========================================

export type RequestPayoutInputType = z.infer<typeof requestPayoutSchema>;
export type InsertPayoutMethodInputType = z.infer<typeof insertPayoutMethodSchema>;
export type UpdatePayoutStatusInputType = z.infer<typeof updatePayoutStatusSchema>;