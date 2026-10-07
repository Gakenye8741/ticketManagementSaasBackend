import axios from "axios";

const BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// Daraja expects YYYYMMDDHHMMSS in Nairobi time
const getTimestamp = (): string => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
};

const getCredentials = () => {
  const shortCode = process.env.MPESA_SHORTCODE || "174379";
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
  return { shortCode, timestamp, password };
};

export const getMpesaCallbackUrl = (): string => {
  const serverUrl = (process.env.SERVER_URL || "").replace(/\/$/, "");
  const secret = process.env.MPESA_CALLBACK_SECRET;
  return `${serverUrl}/api/mpesa-callback${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;
};

export const getMpesaToken = async (): Promise<string> => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");
    const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return data.access_token;
  } catch (error: any) {
    console.error("❌ M-Pesa Token Error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Safaricom");
  }
};

export const initiateStkPush = async (amount: number, phoneNumber: string, bookingId: number) => {
  try {
    const token = await getMpesaToken();
    const { shortCode, timestamp, password } = getCredentials();

    const serverUrl = process.env.SERVER_URL;
    if (!serverUrl || serverUrl.includes("localhost")) {
      console.warn("⚠️ SERVER_URL is missing or localhost. Safaricom cannot reach it.");
    }
    const callBackUrl = getMpesaCallbackUrl();

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: callBackUrl,
      AccountReference: `TicketStream-${bookingId}`,
      TransactionDesc: "Event Ticket Payment",
    };

    // Don't log the secret
    console.log(
      `🔗 STK Push for booking ${bookingId} -> callback host: ${new URL(callBackUrl).origin}/api/mpesa-callback`
    );

    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (String(data.ResponseCode) !== "0") {
      throw new Error(data.ResponseDescription || "Safaricom did not accept the STK push");
    }

    return data;
  } catch (error: any) {
    if (error.response) {
      console.error("❌ Safaricom STK Push Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("❌ Network/Request Error:", error.message);
    }
    throw error;
  }
};

/**
 * Asks Safaricom what happened to an STK push.
 * Returns null while the transaction is still being processed.
 */
export const queryStkPush = async (
  checkoutRequestId: string
): Promise<{ resultCode: number; resultDesc: string } | null> => {
  const token = await getMpesaToken();
  const { shortCode, timestamp, password } = getCredentials();

  try {
    const { data } = await axios.post(
      `${BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.ResultCode === undefined || data.ResultCode === null) return null;
    return { resultCode: Number(data.ResultCode), resultDesc: data.ResultDesc };
  } catch (error: any) {
    // Daraja returns this error while the customer hasn't finished yet
    if (error.response?.data?.errorCode === "500.001.1001") return null;
    throw error;
  }
};