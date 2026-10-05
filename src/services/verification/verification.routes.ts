import { Router } from "express";
import * as verificationController from "./verification.controller";
import { adminAuth, adminOrOrganizerAuth } from "../../middleware/bearAuth";
 // Adjust to your actual auth middleware import path

const verificationRouter = Router();

/**
 * ==========================================
 * ORGANIZER & CREATOR PORTAL ENDPOINTS
 * ==========================================
 */

// 1. Submit new organizer verification KYC
verificationRouter.post(
  "/",
  adminOrOrganizerAuth,
  verificationController.createVerificationController
);

// 3. Get verification record by User Digital ID
verificationRouter.get(
  "/user/:userId",
  adminOrOrganizerAuth,
  verificationController.getVerificationByUserIdController
);

// 4. Get verification record by Organization ID
verificationRouter.get(
  "/organization/:orgId",
  adminOrOrganizerAuth,
  verificationController.getVerificationByOrgIdController
);

// 8. Update general verification details (e.g. re-uploading documents)
verificationRouter.patch(
  "/:id",
  adminOrOrganizerAuth,
  verificationController.updateOrganizerVerificationController
);

// 18. Clear an itemized rejection when re-uploading a specific asset
verificationRouter.patch(
  "/:id/clear-rejection",
  adminOrOrganizerAuth,
  verificationController.clearItemizedRejectionController
);


/**
 * ==========================================
 * ADMIN REVIEW & DASHBOARD ENDPOINTS
 * ==========================================
 */

// 2. Get verification record by ID
verificationRouter.get(
  "/:id",
  adminAuth,
  verificationController.getVerificationByIdController
);

// 5. Get all verification submissions with pagination
verificationRouter.get(
  "/",
  adminAuth,
  verificationController.getAllVerificationsController
);

// 6. Get verifications filtered by review status
verificationRouter.get(
  "/status/:status",
  adminAuth,
  verificationController.getVerificationsByStatusController
);

// 7. Get verifications filtered by entity type (individual vs corporate)
verificationRouter.get(
  "/entity/:entityType",
  adminAuth,
  verificationController.getVerificationsByEntityTypeController
);

// 9. Update global review status
verificationRouter.patch(
  "/:id/status",
  adminAuth,
  verificationController.updateVerificationStatusController
);

// 10. Fully approve organizer verification record
verificationRouter.patch(
  "/:id/approve",
  adminAuth,
  verificationController.approveVerificationController
);

// 11. Reject an organizer verification record globally
verificationRouter.patch(
  "/:id/reject",
  adminAuth,
  verificationController.rejectVerificationController
);

// 12. Request targeted general resubmission
verificationRouter.patch(
  "/:id/request-resubmission",
  adminAuth,
  verificationController.requestResubmissionController
);

// 13. Itemized Rejection: Flag Front ID as rejected
verificationRouter.patch(
  "/:id/reject-field/id-front",
  adminAuth,
  verificationController.rejectIdFrontController
);

// 14. Itemized Rejection: Flag Back ID as rejected
verificationRouter.patch(
  "/:id/reject-field/id-back",
  adminAuth,
  verificationController.rejectIdBackController
);

// 15. Itemized Rejection: Flag Selfies as rejected
verificationRouter.patch(
  "/:id/reject-field/selfies",
  adminAuth,
  verificationController.rejectSelfiesController
);

// 16. Itemized Rejection: Flag Business Document as rejected
verificationRouter.patch(
  "/:id/reject-field/business-doc",
  adminAuth,
  verificationController.rejectBusinessDocController
);

// 17. Itemized Rejection: Flag Tax Certificate as rejected
verificationRouter.patch(
  "/:id/reject-field/tax-cert",
  adminAuth,
  verificationController.rejectTaxCertController
);

// 19. Get count of pending verifications for admin dashboards
verificationRouter.get(
  "/metrics/pending-count",
  adminAuth,
  verificationController.getPendingCountController
);

// 20. Get all verifications currently awaiting resubmission review
verificationRouter.get(
  "/metrics/needing-resubmission",
  adminAuth,
  verificationController.getNeedingResubmissionController
);

// 21. Delete an organizer verification record (Admin cleanup/testing)
verificationRouter.delete(
  "/:id",
  adminAuth,
  verificationController.deleteVerificationController
);

export default verificationRouter;