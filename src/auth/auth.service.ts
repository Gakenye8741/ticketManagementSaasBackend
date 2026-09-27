import db from "../drizzle/db";
import { eq } from "drizzle-orm";
import { TSelectUser, TInsertUser, users } from "../drizzle/schema";

export const registerUserService = async (user: TInsertUser): Promise<TSelectUser> => {
    const [newUser] = await db.insert(users).values(user).returning();

    if (!newUser) {
        throw new Error("Failed to create user");
    }

    return newUser;
}

export const getUserByEmailService = async (email: string): Promise<TSelectUser | undefined> => {
    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });
    
    return user;
}

export const getUserById = async (id: number): Promise<TSelectUser | undefined> => {
    const user = await db.query.users.findFirst({
        where: eq(users.digitalId, id)
    });

    return user;
}

// Save password reset token and expiration in the database
export const savePasswordResetTokenService = async (email: string, token: string, expiresAt: Date): Promise<void> => {
    const result = await db.update(users)
        .set({
            passwordResetToken: token,
            passwordResetExpiresAt: expiresAt,
            updatedAt: new Date()
        })
        .where(eq(users.email, email))
        .returning();

    if (result.length === 0) {
        throw new Error("User not found");
    }
}

// Find user by valid reset token and check expiration
export const getUserByResetTokenService = async (token: string): Promise<TSelectUser | undefined> => {
    const user = await db.query.users.findFirst({
        where: eq(users.passwordResetToken, token)
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
        return undefined;
    }

    return user;
}

export const updateUserPasswordService = async (email: string, newPassword: string): Promise<string> => {
    const result = await db.update(users)
        .set({ 
            password: newPassword, 
            passwordResetToken: null, 
            passwordResetExpiresAt: null, 
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date() 
        })
        .where(eq(users.email, email))
        .returning();

    if (result.length === 0) {
        throw new Error("User not found or password update failed");
    }
    
    return "Password updated successfully";
}

export const updateVerificationStatusService = async (email: string, status: boolean, otp: string | null): Promise<string> => {
    const result = await db.update(users)
        .set({ 
            emailVerified: status, 
            confirmationCode: otp ?? "", 
            updatedAt: new Date() 
        })
        .where(eq(users.email, email))
        .returning();

    if (result.length === 0) {
        throw new Error("User not found or verification status update failed");
    }
    
    return "Verification status updated successfully";
}

export const updateLastLoginService = async (digitalId: number): Promise<void> => {
    await db.update(users)
        .set({ 
            lastLoginAt: new Date(), 
            failedLoginAttempts: 0,
            updatedAt: new Date() 
        })
        .where(eq(users.digitalId, digitalId));
}