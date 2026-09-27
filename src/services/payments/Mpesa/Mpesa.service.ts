import axios from "axios";

const BASE_URL = "https://sandbox.safaricom.co.ke"; 

export const getMpesaToken = async () => {
  try {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
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
    
    // 1. Generate Timestamp: YYYYMMDDHHMMSS
    const date = new Date();
    const timestamp = 
      date.getFullYear().toString() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);
    
    // 2. Setup Shortcode and Passkey
    const shortCode = process.env.MPESA_SHORTCODE || "174379";
    const passkey = process.env.MPESA_PASSKEY!;
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");

    // 3. Construct Callback URL and Verify it exists
    const serverUrl = process.env.SERVER_URL;
    if (!serverUrl || serverUrl.includes("localhost")) {
      console.warn("⚠️ Warning: SERVER_URL is missing or set to localhost. M-Pesa will reject this.");
    }
    const callBackUrl = `${serverUrl}/api/mpesa-callback`;

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

    const darajaEndpoint = `${BASE_URL}/mpesa/stkpush/v1/processrequest`;
    
    // FIXED: Log clearly shows the Safaricom endpoint being called and shows the callback URL separately
    console.log(`🔗 Attempting STK Push for Booking: ${bookingId} -> Target: ${darajaEndpoint} (Callback: ${callBackUrl})`);

    const { data } = await axios.post(darajaEndpoint, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return data; // Returns CheckoutRequestID
  } catch (error: any) {
    // Log detailed Safaricom error if available
    if (error.response) {
      console.error("❌ Safaricom STK Push Error:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("❌ Network/Request Error:", error.message);
    }
    throw error;
  }
};