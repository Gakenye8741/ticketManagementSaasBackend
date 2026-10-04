import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId?: number | string;
        digitalId?: number | string;
        orgId: number | null;
        email?: string;
        role?: string;
        firstName?: string;
        [key: string]: any;
      };
    }
  }
}