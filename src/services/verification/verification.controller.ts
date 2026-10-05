import { Request, Response } from "express";
import * as verificationService from "./verification.service";
import {
  createVerificationSchema,
  updateVerificationSchema,
  adminReviewSchema,
  itemizedRejectionSchema,
  clearItemizedRejectionSchema,
} from "../../validators/verification.validator";

/**
 * Helper to safely extract a route parameter as a single string,
 * preventing the `string | string[]` TypeScript assignment error.
 */
const getStringParam = (param: string | string[] | undefined): string => {
  if (!param) return "";
  return Array.isArray(param) ? param[0] : param;
};

/**
 * 1. Create a new organizer verification submission
 */
export const createVerificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createVerificationSchema.parse(req.body);
    const newVerification = await verificationService.createOrganizerVerification(validatedData);

    res.status(201).json({
      success: true,
      message: "Organizer verification submitted successfully.",
      data: newVerification,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to submit verification." });
  }
};

/**
 * 2. Get verification by record ID
 */
export const getVerificationByIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const verification = await verificationService.getVerificationById(id);

    if (!verification) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, data: verification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Get verification by User Digital ID
 */
export const getVerificationByUserIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userIdStr = getStringParam(req.params.userId);
    const userId = Number.parseInt(userIdStr, 10);
    const verification = await verificationService.getVerificationByUserId(userId);

    if (!verification) {
      res.status(404).json({ success: false, message: "Verification record not found for this user." });
      return;
    }

    res.status(200).json({ success: true, data: verification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Get verification by Organization ID
 */
export const getVerificationByOrgIdController = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgIdStr = getStringParam(req.params.orgId);
    const orgId = Number.parseInt(orgIdStr, 10);
    const verification = await verificationService.getVerificationByOrgId(orgId);

    if (!verification) {
      res.status(404).json({ success: false, message: "Verification record not found for this organization." });
      return;
    }

    res.status(200).json({ success: true, data: verification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Get all verifications (with pagination)
 */
export const getAllVerificationsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? Number.parseInt(getStringParam(req.query.limit as any), 10) : 50;
    const offset = req.query.offset ? Number.parseInt(getStringParam(req.query.offset as any), 10) : 0;

    const verifications = await verificationService.getAllVerifications(limit, offset);
    res.status(200).json({ success: true, count: verifications.length, data: verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Get verifications by status
 */
export const getVerificationsByStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = getStringParam(req.params.status) as any;
    const verifications = await verificationService.getVerificationsByStatus(status);
    res.status(200).json({ success: true, count: verifications.length, data: verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. Get verifications by entity type
 */
export const getVerificationsByEntityTypeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const entityType = getStringParam(req.params.entityType) as any;
    const verifications = await verificationService.getVerificationsByEntityType(entityType);
    res.status(200).json({ success: true, count: verifications.length, data: verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 8. Update general verification details
 */
export const updateOrganizerVerificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const validatedData = updateVerificationSchema.parse(req.body);

    const updated = await verificationService.updateOrganizerVerification(id, validatedData);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Verification details updated.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 9. Update global verification status
 */
export const updateVerificationStatusController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { status, adminComment } = adminReviewSchema.parse(req.body);

    const updated = await verificationService.updateVerificationStatus(id, status, adminComment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: `Status updated to ${status}.`, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 10. Fully approve verification
 */
export const approveVerificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { adminComment } = req.body;

    const updated = await verificationService.approveOrganizerVerification(id, adminComment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Verification fully approved.", data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 11. Globally reject verification
 */
export const rejectVerificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: "Rejection reason is required." });
      return;
    }

    const updated = await verificationService.rejectOrganizerVerification(id, reason);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Verification rejected.", data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 12. Request general resubmission
 */
export const requestResubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { generalComment } = req.body;

    const updated = await verificationService.requestOrganizerResubmission(id, generalComment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Resubmission requested.", data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 13. Itemized Rejection: Front ID
 */
export const rejectIdFrontController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { comment } = itemizedRejectionSchema.omit({ field: true }).parse(req.body);

    const updated = await verificationService.rejectIdFrontField(id, comment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Front ID flagged for resubmission.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 14. Itemized Rejection: Back ID
 */
export const rejectIdBackController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { comment } = itemizedRejectionSchema.omit({ field: true }).parse(req.body);

    const updated = await verificationService.rejectIdBackField(id, comment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Back ID flagged for resubmission.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 15. Itemized Rejection: Selfies
 */
export const rejectSelfiesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { comment } = itemizedRejectionSchema.omit({ field: true }).parse(req.body);

    const updated = await verificationService.rejectSelfiesField(id, comment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Selfies flagged for resubmission.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 16. Itemized Rejection: Business Document
 */
export const rejectBusinessDocController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { comment } = itemizedRejectionSchema.omit({ field: true }).parse(req.body);

    const updated = await verificationService.rejectBusinessDocField(id, comment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Business document flagged for resubmission.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 17. Itemized Rejection: Tax Certificate
 */
export const rejectTaxCertController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { comment } = itemizedRejectionSchema.omit({ field: true }).parse(req.body);

    const updated = await verificationService.rejectTaxCertField(id, comment);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Tax certificate flagged for resubmission.", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 18. Clear itemized rejection on re-upload
 */
export const clearItemizedRejectionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const { field, newUrlValue } = clearItemizedRejectionSchema.parse(req.body);

    const updated = await verificationService.clearItemizedRejection(id, field, newUrlValue);
    if (!updated) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: `${field} re-uploaded and cleared successfully.`, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 19. Get count of pending verifications
 */
export const getPendingCountController = async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await verificationService.getPendingVerificationsCount();
    res.status(200).json({ success: true, pendingCount: count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 20. Get verifications needing resubmission
 */
export const getNeedingResubmissionController = async (req: Request, res: Response): Promise<void> => {
  try {
    const verifications = await verificationService.getVerificationsNeedingResubmission();
    res.status(200).json({ success: true, count: verifications.length, data: verifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 21. Delete verification record
 */
export const deleteVerificationController = async (req: Request, res: Response): Promise<void> => {
  try {
    const idStr = getStringParam(req.params.id);
    const id = Number.parseInt(idStr, 10);
    const deleted = await verificationService.deleteOrganizerVerification(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: "Verification record not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Verification record deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};