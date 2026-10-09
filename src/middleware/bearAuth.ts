
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export type UserRole = "user" | "admin" | "organizer" | "scanner";

export type DecodedToken = {
  userId: number;
  email: string;
  role: UserRole;
  fullName?: string;
  orgId: number | null;
  exp: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

export const verifyToken = async (
  token: string,
  secret: string
): Promise<DecodedToken | null> => {
  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.userId !== "number" ||
      typeof decoded.email !== "string" ||
      !["user", "admin", "organizer", "scanner"].includes(
        decoded.role
      )
    ) {
      return null;
    }

    return decoded as DecodedToken;
  } catch {
    return null;
  }
};

const getToken = (req: Request): string | undefined => {
  const authorization = req.header("Authorization");

  return (
    req.cookies?.auth_token ||
    req.cookies?.token ||
    (authorization?.match(/^Bearer\s+(.+)$/i)?.[1])
  );
};

export const authMiddleware = (
  requiredRoles: UserRole | UserRole[] | "any"
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = getToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Authentication token is missing",
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured on the server",
      });
      return;
    }

    const decodedToken = await verifyToken(token, secret);

    if (!decodedToken) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
      return;
    }

    const allowedRoles =
      requiredRoles === "any"
        ? null
        : Array.isArray(requiredRoles)
          ? requiredRoles
          : [requiredRoles];

    if (allowedRoles && !allowedRoles.includes(decodedToken.role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
      return;
    }

    req.user = decodedToken;
    next();
  };
};

// Optional authentication: valid sessions are attached;
// guests and invalid/expired sessions can continue.
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getToken(req);

  if (!token) {
    next();
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    next();
    return;
  }

  const decodedToken = await verifyToken(token, secret);

  if (decodedToken) {
    req.user = decodedToken;
  }

  next();
};

export const adminAuth = authMiddleware("admin");
export const userAuth = authMiddleware("user");
export const organizerAuth = authMiddleware("organizer");
export const scannerAuth = authMiddleware("scanner");

export const adminOrOrganizerAuth = authMiddleware([
  "admin",
  "organizer",
]);

export const anyAuthenticatedUser = authMiddleware("any");
