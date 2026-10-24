// middleware/orgAccess.ts  (same folder as bearAuth.ts)
// Run these AFTER adminAuth / organizerAuth / adminOrOrganizerAuth, because they read req.user.
import type { NextFunction, Request, Response } from "express";

const forbidden = (res: Response, message: string) =>
  void res.status(403).json({ success: false, message });

/**
 * For routes with :orgId in the URL.
 * Admin: any org. Organizer: only the org stored in their token.
 */
export const enforceOrgParam = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }
  if (user.role === "admin") return next();

  const orgId = Number(req.params.orgId);
  if (user.role === "organizer" && user.orgId != null && Number(user.orgId) === orgId) {
    return next();
  }
  forbidden(res, "Forbidden: you can only access your own organization");
};

/**
 * For routes that read orgId from the request body.
 * Organizer: body.orgId is OVERWRITTEN with the org from their token, so it can't be spoofed.
 * Admin: body is left as sent.
 */
export const forceOrgFromToken = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }
  if (user.role === "admin") return next();

  if (user.orgId == null) {
    forbidden(res, "Your account is not linked to an organization");
    return;
  }
  req.body = { ...(req.body ?? {}), orgId: Number(user.orgId) };
  next();
};