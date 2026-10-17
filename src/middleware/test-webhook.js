const crypto = require('crypto');

// Use your exact test secret key
const secret = 'sk_test_0a01eaa23e3eac5f4f281b4af70724e0953aa95a';

// The exact JSON payload payload you want to send
const payload = JSON.stringify({
  event: 'charge.success',
  data: {
    reference: 'your_actual_test_reference_here'
  }
});

// Compute the valid HMAC SHA512 signature just like Paystack does
const signature = crypto
  .createHmac('sha512', secret)
  .update(payload)
  .digest('hex');

console.log('Copy this signature for your test header:\n', signature);