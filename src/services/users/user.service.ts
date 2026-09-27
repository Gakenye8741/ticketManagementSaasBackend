import { eq, desc, ilike, and, gt } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  users,
  bookings,
  events,
  venues,
  payments,
  supportTickets,
  TInsertUser,
  TSelectUser,
} from "../../drizzle/schema";

import bcrypt from "bcrypt";

// Utility: Exclude password from returned user objects
function excludePassword<T extends { password?: string | null }>(user: T): Omit<T, "password"> {
  const { password, ...rest } = user;
  return rest;
}

// ==========================================
// AUTHENTICATION & LOOKUP SERVICES
// ==========================================

// ✅ Get user by email for authentication / existence checks
export const getUserByEmailService = async (
  email: string
): Promise<TSelectUser | undefined> => {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  return user;
};

// ✅ Get user by digitalId (Primary Key) without password
export const getUserById = async (
  digitalId: number
): Promise<Omit<TSelectUser, "password"> | undefined> => {
  const user = await db.query.users.findFirst({
    where: eq(users.digitalId, digitalId),
  });
  return user ? excludePassword(user) : undefined;
};

// ✅ Register a new user
export const registerUserService = async (
  user: TInsertUser
): Promise<Omit<TSelectUser, "password">> => {
  const [newUser] = await db.insert(users).values(user).returning();
  return excludePassword(newUser);
};

// ✅ Update user verification status and confirmation code
export const updateVerificationStatusService = async (
  email: string,
  emailVerified: boolean,
  confirmationCode: string | null
): Promise<Omit<TSelectUser, "password"> | undefined> => {
  const [updatedUser] = await db
    .update(users)
    .set({
      emailVerified,
      confirmationCode: confirmationCode ?? "",
      updatedAt: new Date(),
    })
    .where(eq(users.email, email))
    .returning();

  return updatedUser ? excludePassword(updatedUser) : undefined;
};

// ✅ Update user password by email
export const updateUserPasswordService = async (
  email: string,
  hashedPassword: string
): Promise<void> => {
  await db
    .update(users)
    .set({
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.email, email));
};

// ✅ Save password reset token and expiration time
export const savePasswordResetTokenService = async (
  email: string,
  resetToken: string,
  expiresAt: Date
): Promise<void> => {
  await db
    .update(users)
    .set({
      passwordResetToken: resetToken,
      passwordResetExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.email, email));
};

// ✅ Get user by valid, unexpired password reset token
export const getUserByResetTokenService = async (
  token: string
): Promise<TSelectUser | undefined> => {
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.passwordResetToken, token),
      gt(users.passwordResetExpiresAt, new Date())
    ),
  });
  return user;
};

// ==========================================
// GENERAL USER MANAGEMENT SERVICES
// ==========================================

// ✅ Get all users (ordered by digitalId descending) without password
export const getAllUsersService = async (): Promise<Omit<TSelectUser, "password">[]> => {
  const usersList = await db.query.users.findMany({
    orderBy: [desc(users.digitalId)],
  });
  return usersList.map(excludePassword);
};

// ✅ Get user by last name (case-insensitive, partial match) without password
export const getUserByLastNameService = async (
  lastName: string
): Promise<Omit<TSelectUser, "password">[]> => {
  const results = await db.query.users.findMany({
    where: ilike(users.lastName, `%${lastName}%`),
  });
  return results.map(excludePassword);
};

// ✅ Get full user profile with all related data using digitalId (excluding password)
export const getUserWithDetailsService = async (
  digitalId: number
) => {
  const userDetails = await db.query.users.findFirst({
    where: eq(users.digitalId, digitalId),
    with: {
      bookings: {
        with: {
          event: {
            with: {
              venue: true,
            },
          },
          payments: true,
        },
      },
      supportTickets: true,
    },
  });

  if (!userDetails) return undefined;

  return excludePassword(userDetails);
};

// ✅ Search users with details using last name (excluding password)
export const searchUsersWithDetailsService = async (
  query: string
) => {
  const matchedUsers = await db.query.users.findMany({
    where: ilike(users.lastName, `%${query}%`),
    with: {
      bookings: {
        with: {
          event: {
            with: {
              venue: true,
            },
          },
          payments: true,
        },
      },
      supportTickets: true,
    },
    orderBy: [desc(users.digitalId)],
  });

  return matchedUsers.map(excludePassword);
};

// ✅ Update user details by digitalId
export const updateUserService = async (
  digitalId: number,
  user: Partial<TInsertUser>
): Promise<string> => {
  const dataToUpdate: Partial<TInsertUser> = { ...user, updatedAt: new Date() };

  // ✅ HASH PASSWORD IF PRESENT
  if (user.password) {
    const saltRounds = 10;
    dataToUpdate.password = await bcrypt.hash(user.password, saltRounds);
  }

  await db
    .update(users)
    .set(dataToUpdate)
    .where(eq(users.digitalId, digitalId));

  return "User updated successfully";
};

// ✅ Delete user by digitalId
export const deleteUserService = async (
  digitalId: number
): Promise<string> => {
  await db.delete(users).where(eq(users.digitalId, digitalId));
  return "User deleted successfully ❌";
};

// ✅ Get all users specifically for retrieving their emails in controllers
export const getAllUsersEmailsService = async () => {
  const usersList = await db.select({
    digitalId: users.digitalId,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  }).from(users);
  
  return usersList;
};