import axios from "axios";
import { toSubunit } from "./Paystack.service";

const client = () =>
  axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

/**
 * definitive = Paystack answered with a 4xx, so the refund was NOT created and it is safe to undo.
 * Not definitive (timeout / 5xx / network) = we can't know; the refund may exist at Paystack.
 */
export class PaystackRefundError extends Error {
  constructor(message: string, public httpStatus?: number, public definitive = false) {
    super(message);
    this.name = "PaystackRefundError";
  }
}

const toError = (error: any, fallback: string) => {
  const status: number | undefined = error.response?.status;
  return new PaystackRefundError(
    error.response?.data?.message || error.message || fallback,
    status,
    status !== undefined && status >= 400 && status < 500
  );
};

export type PaystackRefund = {
  id: number;
  status: string; // pending | processing | processed | failed | needs-attention
  amount: number; // subunit
  currency: string;
};

/** `transaction` = the Paystack reference or numeric id of the original payment. */
export const createRefund = async (opts: {
  transaction: string | number;
  amount: number; // KES
  customerNote?: string;
  merchantNote?: string;
}): Promise<PaystackRefund> => {
  try {
    const { data } = await client().post("/refund", {
      transaction: opts.transaction,
      amount: toSubunit(opts.amount),
      currency: "KES",
      customer_note: opts.customerNote,
      merchant_note: opts.merchantNote,
    });
    return data.data as PaystackRefund;
  } catch (error: any) {
    console.error("❌ Paystack refund error:", error.response?.data || error.message);
    throw toError(error, "Failed to create Paystack refund");
  }
};

/** Used by reconcile when a webhook was missed. */
export const fetchRefund = async (refundId: string | number): Promise<PaystackRefund> => {
  try {
    const { data } = await client().get(`/refund/${encodeURIComponent(String(refundId))}`);
    return data.data as PaystackRefund;
  } catch (error: any) {
    console.error("❌ Paystack fetch refund error:", error.response?.data || error.message);
    throw toError(error, "Failed to fetch Paystack refund");
  }
};