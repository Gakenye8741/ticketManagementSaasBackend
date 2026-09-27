import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendNotificationEmail = async (
  email: string,
  subject: string,
  firstName: string | null,
  message: string,
  html?: string
): Promise<boolean> => {
  try {
    const defaultHtml = `
      <div style="font-family: Arial, sans-serif;">
        <p>Hello ${firstName ?? "User"},</p>
        <p>${message}</p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `Ticket Stream <${process.env.EMAIL_SENDER}>`,
      to: [email],
      // Redirect incoming replies away from your active inbox
      replyTo: "no-reply@gakenye-ndiritu.co.ke",
      subject,
      text: message,
      html: html ? html : defaultHtml,
    });

    if (error) {
      console.error(
        `[MAILER FAILURE] Failed to send email to ${email}`,
        error
      );
      return false;
    }

    console.log(
      `[MAILER SUCCESS] Email sent successfully to ${email}. ID: ${data?.id}`
    );
    return true;
  } catch (error) {
    console.error(
      `[MAILER EXCEPTION] Unexpected error sending email to ${email}`,
      error
    );
    return false;
  }
};