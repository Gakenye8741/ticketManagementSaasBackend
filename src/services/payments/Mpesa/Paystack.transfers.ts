// Paystack.transfers.ts
// Put next to Paystack.service.ts. Only talks to Paystack; no database access here.
import axios from "axios";
import { toSubunit, fromSubunit, toPaystackPhone } from "./Paystack.service"; // adjust path if needed

const http = () =>
  axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

/**
 * definitive = Paystack answered and rejected the request (4xx), so nothing was sent.
 * not definitive = timeout / network / 5xx, so we do NOT know if money moved.
 * The payout service relies on this distinction to avoid double payouts.
 */
export class PaystackTransferError extends Error {
  constructor(
    message: string,
    public readonly definitive: boolean,
    public readonly httpStatus?: number
  ) {
    super(message);
  }
}

const wrap = (e: any, fallback: string) => {
  if (e.response) {
    const status = e.response.status as number;
    return new PaystackTransferError(e.response.data?.message || fallback, status < 500, status);
  }
  return new PaystackTransferError(`${fallback} (${e.code || e.message})`, false);
};

/** Available Paystack balance in KES (major units). */
export const getPaystackBalance = async (currency = "KES"): Promise<number> => {
  try {
    const { data } = await http().get("/balance");
    const row = (data.data as { currency: string; balance: number }[]).find(
      (b) => b.currency === currency
    );
    return row ? fromSubunit(row.balance) : 0;
  } catch (e) {
    throw wrap(e, "Failed to read Paystack balance");
  }
};

// ---------- Recipients ----------

export type PayoutDestination = {
  accountType: string; // your organizerPayoutMethods.accountType
  accountNumber: string;
  accountName: string;
  bankCode?: string | null; // required for bank accounts
};

/**
 * Maps your saved method to Paystack's Kenya recipient types.
 * M-Pesa wallet -> mobile_money / MPESA
 * Till          -> mobile_money_business / MPTILL
 * Bank          -> kepss / <bank code from GET /bank?country=kenya>
 * Paybill       -> mobile_money_business / MPPAYBILL, but Paystack says it needs
 *                  extra info at disbursement. Left unsupported until you confirm
 *                  the exact fields with Paystack.
 */
export const toRecipientSpec = (d: PayoutDestination) => {
  const t = d.accountType.toLowerCase().replace(/[^a-z]/g, "");

  if (t.includes("paybill")) {
    throw new Error("Paybill payouts are not supported yet (Paystack needs extra disbursement details).");
  }
  if (t.includes("till")) {
    return { type: "mobile_money_business", bank_code: "MPTILL", account_number: d.accountNumber.trim() };
  }
  if (t.includes("mpesa") || t.includes("mobile")) {
    return {
      type: "mobile_money",
      bank_code: "MPESA",
      account_number: toPaystackPhone(d.accountNumber).replace("+", ""), // 2547XXXXXXXX
    };
  }
  if (t.includes("bank")) {
    if (!d.bankCode) throw new Error("Bank payout method is missing a bank code.");
    return { type: "kepss", bank_code: d.bankCode, account_number: d.accountNumber.trim() };
  }
  throw new Error(`Unsupported payout account type "${d.accountType}".`);
};

export const createTransferRecipient = async (
  spec: ReturnType<typeof toRecipientSpec> & { name: string }
): Promise<string> => {
  try {
    const { data } = await http().post("/transferrecipient", { ...spec, currency: "KES" });
    return data.data.recipient_code as string;
  } catch (e) {
    throw wrap(e, "Failed to create Paystack transfer recipient");
  }
};

// ---------- Transfers ----------

export const initiateTransfer = async (opts: {
  amount: number; // KES
  recipientCode: string;
  reference: string; // lowercase, digits, - and _ only, 16-50 chars
  reason?: string;
}) => {
  try {
    const { data } = await http().post("/transfer", {
      source: "balance",
      amount: toSubunit(opts.amount),
      currency: "KES",
      recipient: opts.recipientCode,
      reference: opts.reference,
      reason: opts.reason,
    });
    return data.data as {
      status: string; // "pending" | "success" | "otp"
      transfer_code: string;
      reference: string;
      amount: number;
    };
  } catch (e) {
    throw wrap(e, "Failed to initiate Paystack transfer");
  }
};

export const verifyTransfer = async (reference: string) => {
  try {
    const { data } = await http().get(`/transfer/verify/${encodeURIComponent(reference)}`);
    return data.data as {
      status: string; // success | failed | reversed | pending | processing | otp | received
      reference: string;
      transfer_code: string;
      amount: number; // subunit
      reason?: string;
    };
  } catch (e) {
    throw wrap(e, "Failed to verify Paystack transfer");
  }
};