import { RequestHandler } from "express";
import {
  getUserByEmailService,
  getUserById,
  registerUserService,
  updateUserPasswordService,
  updateVerificationStatusService,
  savePasswordResetTokenService,
  getUserByResetTokenService,
} from "./auth.service";
import {
  registerUserValidator,
  userLogInValidator,
  passwordResetRequestValidator,
  updatePasswordValidator,
  verifyOtpValidator,
} from "../validators/user.validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendNotificationEmail } from "../middleware/googleMailer";

// Generate 6-digit code
const generateConfirmationCode = () => Math.floor(100000 + Math.random() * 900000);

// ===================== REGISTER =====================
export const registerUser: RequestHandler = async (req, res) => {
  try {
    const parseResult = registerUserValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues });
      return;
    }

    const user = parseResult.data;

    const existingUser = await getUserByEmailService(user.email);
    if (existingUser) {
      res.status(400).json({ error: "User with this email already exists" });
      return;
    }

    const hashedPassword = bcrypt.hashSync(user.password, bcrypt.genSaltSync(10));
    const confirmationCode = generateConfirmationCode().toString();

    const newUserPayload = {
      ...user,
      password: hashedPassword,
      confirmationCode,
      digitalId: Math.floor(100000000 + Math.random() * 900000000),
      emailVerified: false,
      profileImageUrl: null,
      address: user.address ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newUser = await registerUserService(newUserPayload);

    const subject = "Welcome to Ticket Stream Events - Account Verification";
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e1e8ed;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #093FB4; margin: 0;">Ticket Stream Events</h2>
          <p style="color: #657786; font-size: 14px; margin-top: 5px;">Your Gateway to Unforgettable Experiences</p>
        </div>
        <h3 style="color: #14171A;">Hello, ${user.firstName} ${user.lastName}!</h3>
        <p style="color: #657786; line-height: 1.6;">Thank you for creating an account with us. To activate your account and start booking tickets, please use the verification code below:</p>
        <div style="background-color: #f8f9fa; border: 2px dashed #093FB4; padding: 15px; border-radius: 8px; text-align: center; font-size: 28px; font-weight: bold; color: #093FB4; letter-spacing: 4px; margin: 25px 0;">
          ${confirmationCode}
        </div>
        <p style="color: #657786; line-height: 1.6;">Enter this code in the verification screen to complete your registration.</p>
        <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 25px 0;" />
        <p style="color: #aab8c2; font-size: 12px; text-align: center;">If you did not request this registration, please safely ignore this email.<br>© ${new Date().getFullYear()} Ticket Stream Events ICT Team.</p>
      </div>
    `;

    try {
      const emailSent = await sendNotificationEmail(user.email, subject, user.firstName, html);
      if (!emailSent) {
        console.warn(`[EMAIL WARNING] Email service returned false for ${user.email}`);
      }
    } catch (mailError: any) {
      console.error(`[MAILER FAILURE] Failed to send registration email to ${user.email}:`, mailError.message || mailError);
    }

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user: newUser,
    });
  } catch (error: any) {
    console.error("[REGISTER ERROR]", error);
    res.status(500).json({ error: error.message || "Failed to register user" });
  }
};

// ===================== LOGIN =====================
export const loginUser: RequestHandler = async (req, res) => {
  try {
    const parseResult = userLogInValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid input", details: parseResult.error.issues });
      return;
    }

    const { email, password } = parseResult.data;
    const userExists = await getUserByEmailService(email);

    if (!userExists) {
      res.status(404).json({ error: "User does not exist" });
      return;
    }

    if (!userExists.emailVerified) {
      res.status(403).json({ error: "Please verify your email." });
      return;
    }

    const isMatch = bcrypt.compareSync(password, userExists.password!);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    const payload = {
      userId: userExists.digitalId,
      digitalId: userExists.digitalId,
      email: userExists.email,
      role: userExists.role,
      firstName: userExists.firstName,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "60d",
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 60 * 1000,
    });

    res.status(200).json({
      digitalId: userExists.digitalId,
      email: userExists.email,
      role: userExists.role,
      firstName: userExists.firstName,
      message: "Login successful 😎",
    });
  } catch (error: any) {
    console.error("[LOGIN ERROR]", error);
    res.status(500).json({ error: error.message || "Failed to login user" });
  }
};

// ===================== PASSWORD RESET =====================
export const passwordReset: RequestHandler = async (req, res) => {
  try {
    const parseResult = passwordResetRequestValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues });
      return;
    }

    const { email } = parseResult.data;
    const user = await getUserByEmailService(email);
    if (!user) {
      // Return 200 even if user doesn't exist to prevent user enumeration attacks
      res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
      return;
    }

    // Generate secure random string or JWT token for database storage
    const resetToken = jwt.sign(
      { digitalId: user.digitalId },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token and expiry securely in the database
    await savePasswordResetTokenService(email, resetToken, expiresAt);

    const resetLink = `${process.env.FRONTEND_URL || 'https://ticketstream-events.netlify.app/'}reset-password/${resetToken}`;
    const subject = "Password Reset Request - Ticket Stream Events";
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e1e8ed;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #093FB4; margin: 0;">Ticket Stream Events</h2>
          <p style="color: #657786; font-size: 14px; margin-top: 5px;">Security & Account Recovery</p>
        </div>
        <h3 style="color: #14171A;">Hello, ${user.firstName},</h3>
        <p style="color: #657786; line-height: 1.6;">We received a request to reset your password. Click the secure button below to proceed. This link is valid for <strong>1 hour</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #093FB4; color: #ffffff; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #657786; line-height: 1.6;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #093FB4; font-size: 13px;">${resetLink}</p>
        <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 25px 0;" />
        <p style="color: #aab8c2; font-size: 12px; text-align: center;">If you did not request a password reset, please ignore this email or contact support if you have concerns.<br>© ${new Date().getFullYear()} Ticket Stream Events ICT Team.</p>
      </div>
    `;

    try {
      const emailSent = await sendNotificationEmail(email, subject, user.firstName, html);
      if (!emailSent) {
        res.status(500).json({ error: "Failed to send reset email due to mail service issue" });
        return;
      }
    } catch (mailError: any) {
      console.error(`[MAILER FAILURE] Failed to send password reset email to ${email}:`, mailError.message || mailError);
      res.status(500).json({ error: "Failed to send reset email due to network/server issue" });
      return;
    }

    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (error: any) {
    console.error("[PASSWORD RESET ERROR]", error);
    res.status(500).json({ error: error.message || "Failed to reset password" });
  }
};

// ===================== UPDATE PASSWORD =====================
export const updatePassword: RequestHandler = async (req, res) => {
  try {
    const token = req.params.token as string;
    
    const parseResult = updatePasswordValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues });
      return;
    }

    const { newPassword } = parseResult.data;

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    // Verify token against database record to prevent token reuse/tampering
    const user = await getUserByResetTokenService(token);
    if (!user) {
      res.status(400).json({ error: "Invalid or expired password reset token" });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
    await updateUserPasswordService(user.email!, hashedPassword);

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error: any) {
    console.error("[UPDATE PASSWORD ERROR]", error);
    res.status(500).json({ error: error.message || "Invalid or expired token" });
  }
};

// ===================== EMAIL VERIFICATION =====================
export const emailVerfication: RequestHandler = async (req, res) => {
  try {
    const parseResult = verifyOtpValidator.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.issues });
      return;
    }

    const { email, otp } = parseResult.data;

    const user = await getUserByEmailService(email);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.confirmationCode !== otp) {
      res.status(400).json({ error: "Invalid Confirmation code" });
      return;
    }

    const updatedUser = await updateVerificationStatusService(user.email!, true, null);

    if (!updatedUser) {
      res.status(500).json({ error: "Failed to update verification status" });
      return;
    }

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error: any) {
    console.error("[EMAIL VERIFICATION ERROR]", error);
    res.status(500).json({ error: error.message || "Email verification failed" });
  }
};