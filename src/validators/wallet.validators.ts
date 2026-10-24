import { z } from "zod";

// ==========================================
// COMMON PRIMITIVES
// ==========================================

const positiveNumberSchema = z.number().positive("Amount must be greater than zero");
const idSchema = z.number().int().positive("Invalid ID");

export const PAYOUT_STATUSES = ["Pending", "Processing", "Completed", "Failed", "Reversed"] as const;

/** Same reading of accountType as toRecipientSpec in Paystack.transfers.ts */
const accountKind = (type: string): "paybill" | "till" | "mpesa" | "bank" | "other" => {
  const t = type.toLowerCase().replace(/[^a-z]/g, "");
  if (t.includes("paybill")) return "paybill";
  if (t.includes("till")) return "till";
  if (t.includes("mpesa") || t.includes("mobile")) return "mpesa";
  if (t.includes("bank")) return "bank";
  return "other";
};

// 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, +2541XXXXXXXX
const KE_PHONE = /^(?:\+?254|0)?[71]\d{8}$/;

// ==========================================
// WALLET SCHEMAS
// ==========================================

export const getOrCreateWalletSchema = z.object({
  orgId: idSchema,
  currency: z.enum(["KES", "USD", "EUR", "GBP"]).default("KES"),
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

/** Manual admin override (Pending payouts only) */
export const updatePayoutStatusSchema = z.object({
  payoutId: idSchema,
  status: z.enum(["Completed", "Failed"]),
  transactionReference: z.string().optional(),
});

/** Sending payouts through Paystack */
export const bulkSendPayoutsSchema = z.object({
  payoutIds: z.array(idSchema).min(1, "At least one payout ID is required").max(100),
});

// ==========================================
// PAYOUT METHODS & BANKS SCHEMAS
// ==========================================

export const getBanksQuerySchema = z.object({
  country: z.string().default("kenya"),
  currency: z.enum(["KES", "USD", "EUR", "GBP"]).default("KES"),
});

export const insertPayoutMethodSchema = z
  .object({
    orgId: idSchema,
    accountNumber: z.string().trim().min(1, "Account number is required"),
    accountType: z.string().trim().min(1, "Account type is required"),
    accountName: z.string().trim().min(1, "Account name is required"),
    bankCode: z.string().trim().min(1).max(20).optional().nullable(), // required for Bank
    isDefault: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const kind = accountKind(v.accountType);

    if (kind === "paybill") {
      ctx.addIssue({
        code: "custom",
        path: ["accountType"],
        message: "Paybill payouts are not supported yet. Use M-Pesa, Till or Bank.",
      });
    } else if (kind === "other") {
      ctx.addIssue({ code: "custom", path: ["accountType"], message: "Choose M-Pesa, Till or Bank." });
    } else if (kind === "bank" && !v.bankCode) {
      ctx.addIssue({ code: "custom", path: ["bankCode"], message: "Choose a bank." });
    } else if (kind === "mpesa" && !KE_PHONE.test(v.accountNumber.replace(/[\s-]/g, ""))) {
      ctx.addIssue({
        code: "custom",
        path: ["accountNumber"],
        message: "Enter a valid Safaricom number, e.g. 0712345678 or 254712345678.",
      });
    }
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

export const updatePayoutMethodSchema = z
  .object({
    methodId: idSchema,
    orgId: idSchema,
    data: z.object({
      accountNumber: z.string().trim().min(1).optional(),
      accountType: z.string().trim().min(1).optional(),
      accountName: z.string().trim().min(1).optional(),
      bankCode: z.string().trim().min(1).max(20).nullable().optional(),
      isDefault: z.boolean().optional(),
    }),
  })
  .superRefine((val, ctx) => {
    if (val.data.accountType) {
      const kind = accountKind(val.data.accountType);
      if (kind === "bank" && !val.data.bankCode) {
        ctx.addIssue({
          code: "custom",
          path: ["data", "bankCode"],
          message: "Choose a bank code when selecting bank account type.",
        });
      }
    }
  });

export const getPayoutsByStatusSchema = z.object({
  orgId: idSchema,
  status: z.enum(PAYOUT_STATUSES),
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