import axios from "axios";

const BASE_URL = "https://api.paystack.co";

const client = () =>
  axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

// Paystack amounts are in the smallest unit (KES 100 -> 10000)
export const toSubunit = (amount: number) => Math.round(amount * 100);
export const fromSubunit = (amount: number) => amount / 100;

// Unique reference per attempt (a booking can be retried)
export const makeReference = (bookingId: number) =>
  `TS-${bookingId}-${Date.now()}`;

// +2547XXXXXXXX (Paystack Kenya mobile money format)
export const toPaystackPhone = (raw: string): string => {
  let p = raw.toString().trim().replace(/[\s+-]/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (/^[71]\d{8}$/.test(p)) p = "254" + p;
  return `+${p}`;
};

/** Hosted checkout (M-Pesa + card). Returns authorization_url to redirect to. */
export const initializeTransaction = async (opts: {
  email: string;
  amount: number;
  reference: string;
  bookingId: number;
  callbackUrl?: string;
}) => {
  try {
    const { data } = await client().post("/transaction/initialize", {
      email: opts.email,
      amount: toSubunit(opts.amount),
      currency: "KES",
      reference: opts.reference,
      channels: ["mobile_money", "card"],
      callback_url: opts.callbackUrl,
      metadata: { bookingId: opts.bookingId },
    });
    return data.data as {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  } catch (error: any) {
    console.error("❌ Paystack initialize error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to initialize Paystack payment");
  }
};

/** Direct M-Pesa prompt on the customer's phone (replaces STK push). */
export const chargeMpesa = async (opts: {
  email: string;
  amount: number;
  phone: string;
  reference: string;
  bookingId: number;
}) => {
  try {
    const { data } = await client().post("/charge", {
      email: opts.email,
      amount: toSubunit(opts.amount),
      currency: "KES",
      reference: opts.reference,
      mobile_money: { phone: opts.phone, provider: "mpesa" },
      metadata: { bookingId: opts.bookingId },
    });
    // data.data.status is usually "pay_offline" (waiting for customer PIN)
    return data.data as { status: string; reference: string; display_text?: string };
  } catch (error: any) {
    console.error("❌ Paystack charge error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to start M-Pesa charge");
  }
};

/** Source of truth for a payment's state (replaces queryStkPush). */
export const verifyTransaction = async (reference: string) => {
  try {
    const { data } = await client().get(`/transaction/verify/${encodeURIComponent(reference)}`);
    return data.data as {
      status: string; // success | failed | abandoned | pending | ongoing | pay_offline
      reference: string;
      amount: number; // subunit
      currency: string;
      id: number;
      gateway_response?: string;
      metadata?: any;
    };
  } catch (error: any) {
    console.error("❌ Paystack verify error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to verify Paystack payment");
  }
};