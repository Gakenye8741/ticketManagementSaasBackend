import { z } from "zod";

export const registerUserValidator = z.object({
    firstName: z
        .string({ required_error: "First name is required" })
        .trim()
        .min(2, "First name must be at least 2 characters long")
        .max(50, "First name cannot exceed 50 characters"),
        
    lastName: z
        .string({ required_error: "Last name is required" })
        .trim()
        .min(2, "Last name must be at least 2 characters long")
        .max(50, "Last name cannot exceed 50 characters"),
        
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format")
        .toLowerCase(),
        
    password: z
        .string({ required_error: "Password is required" })
        .min(6, "Password must be at least 6 characters long")
        .max(100, "Password is too long"),
        
    contactPhone: z
        .string({ required_error: "Contact phone is required" })
        .trim()
        .regex(/^(?:254|\+254|0)?([17]\d{8})$/, "Invalid Kenyan phone number format"),
        
    address: z
        .string()
        .trim()
        .max(255, "Address is too long")
        .optional()
        .nullable(),
        
    role: z
        .enum(["user", "admin", "organizer"])
        .default("user"),
        
    confirmationCode: z
        .string()
        .trim()
        .optional()
        .nullable(),
});

export const userLogInValidator = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format")
        .toLowerCase(),
        
    password: z
        .string({ required_error: "Password is required" })
        .min(1, "Password is required"),
});

export const passwordResetRequestValidator = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format")
        .toLowerCase(),
});

export const updatePasswordValidator = z.object({
    newPassword: z
        .string({ required_error: "New password is required" })
        .min(6, "New password must be at least 6 characters long")
        .max(100, "New password is too long"),
});

export const verifyOtpValidator = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .trim()
        .email("Invalid email format")
        .toLowerCase(),
        
    otp: z
        .string({ required_error: "OTP code is required" })
        .trim()
        .length(6, "Confirmation code must be exactly 6 characters"),
});

// Type exports for your controllers / services
export type TRegisterUser = z.infer<typeof registerUserValidator>;
export type TUserLogIn = z.infer<typeof userLogInValidator>;
export type TPasswordResetRequest = z.infer<typeof passwordResetRequestValidator>;
export type TUpdatePassword = z.infer<typeof updatePasswordValidator>;
export type TVerifyOtp = z.infer<typeof verifyOtpValidator>;