import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Allowed roles for TicketStream
type UserRole = "user" | "admin" | "organizer" | "scanner";

// JWT payload type matching TicketStream requirements
type DecodedToken = {
  userId: number;
  email: string;
  role: UserRole;
  fullName?: string;
  orgId: number | null; // <--- Add this line here
  exp: number;
};

// Extend Express Request with user payload
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

// Token verification helper
export const verifyToken = async (
  token: string,
  secret: string
): Promise<DecodedToken | null> => {
  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded;
  } catch (error) {
    return null;
  }
};

// Auth middleware factory supporting single role, array of roles, or "any"
export const authMiddleware = (
  requiredRoles: UserRole | UserRole[] | "any"
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract token from HttpOnly cookie first, with fallback to Authorization header
  // ✅ Check for 'auth_token' first
const token = req.cookies?.auth_token || req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ success: false, message: "Authentication token is missing" });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, message: "JWT secret is not configured on the server" });
      return;
    }

    const decodedToken = await verifyToken(token, secret);

    if (!decodedToken) {
      res.status(401).json({ success: false, message: "Invalid or expired token" });
      return;
    }

    const userRole = decodedToken.role;

    if (
      requiredRoles === "any" ||
      userRole === requiredRoles ||
      (Array.isArray(requiredRoles) && requiredRoles.includes(userRole))
    ) {
      req.user = decodedToken;
      return next();
    } else {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
      return;
    }
  };
};

// Role-based middleware exports for TicketStream
export const adminAuth = authMiddleware("admin");
export const userAuth = authMiddleware("user");
export const organizerAuth = authMiddleware("organizer");
export const scannerAuth = authMiddleware("scanner");

// Combined administrative or management helpers
export const adminOrOrganizerAuth = authMiddleware(["admin", "organizer"]);

// Any authenticated user
export const anyAuthenticatedUser = authMiddleware("any");