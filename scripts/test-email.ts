import { sendNotificationEmail } from "../src/middleware/googleMailer"; // Update path as needed

const runEmailTest = async (): Promise<void> => {
  console.log("🚀 Initializing mock parameters for email testing...");

  const testEmail = "codewithgakenye@gmail.com";
  const testSubject = "Your Color Fest 2026 Ticket Confirmation";
  const testFirstName = "Test";
  const testMessage = "Thank you for purchasing your VIP Access ticket for Color Fest 2026. Your payment of KES 3,000.00 has been successfully processed.";
  
  // Optional custom HTML if you want to test custom templates
  const testHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2c3e50;">Color Fest 2026 Ticket Confirmed!</h2>
        <p>Hello <strong>${testFirstName}</strong>,</p>
        <p>${testMessage}</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">Powered by Ticket Stream & Resend</p>
      </div>
    </div>
  `;

  const isSuccess = await sendNotificationEmail(
    testEmail,
    testSubject,
    testFirstName,
    testMessage,
    testHtml
  );

  console.log(isSuccess ? "✨ [SUCCESS] Test email sent!" : "❌ [FAILURE] Failed to send test email.");
};

runEmailTest();