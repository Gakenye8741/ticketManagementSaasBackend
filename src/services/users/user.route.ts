import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  getUserByLastName,
  getUserDetails,
  getUserByDigitalId,
  searchUsersWithDetails,
  updateAdminUser,
  sendEmailToRegisteredUsersController,
} from "./user.controller";

import { adminAuth, anyAuthenticatedUser } from "../../middleware/bearAuth";

export const userRouter = Router();

// 📋 Get all users (basic profiles) - Admin only
userRouter.get("/users", adminAuth, getUsers);

// 🔍🧑 Search users by last name (basic profile match) - Admin only
userRouter.get("/users-search", adminAuth, getUserByLastName);

// 🔍🧾 Search users by last name with full profile/details - Admin only
userRouter.get("/details/users-search", adminAuth, searchUsersWithDetails);

// 🧑‍💼 Get user by digital ID - Any authenticated user
userRouter.get("/users/:digitalId", anyAuthenticatedUser, getUserByDigitalId);

// 🧾 Get full user details (bookings, payments, support) - Any authenticated user
userRouter.get("/users/:digitalId/details", anyAuthenticatedUser, getUserDetails);

// ➕ Create a new user (Public registration endpoint)
userRouter.post("/users", createUser);

// ✉️ Broadcast emails to registered users - Admin only
userRouter.post("/users/send-email", adminAuth, sendEmailToRegisteredUsersController);

// ♻️ Update an existing user by digital ID - Any authenticated user
userRouter.put("/users/:digitalId", anyAuthenticatedUser, updateUser);

// ♻️ Update an existing user by digital ID (Admin) - Admin only
userRouter.put("/admin/users/:digitalId", adminAuth, updateAdminUser);

// ❌ Delete a user by digital ID - Admin only
userRouter.delete("/users/:digitalId", adminAuth, deleteUser);