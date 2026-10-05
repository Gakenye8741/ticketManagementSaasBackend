import { desc, eq, sql } from "drizzle-orm";
import db from "../../drizzle/db";
import { organizerVerifications, TInsertOrganizerVerification, TSelectOrganizerVerification } from "../../drizzle/schema";

/**
 * 1. Create a new organizer verification submission
 */
export const createOrganizerVerification = async (
  data: TInsertOrganizerVerification
): Promise<TSelectOrganizerVerification> => {
  const [newVerification] = await db
    .insert(organizerVerifications)
    .values(data)
    .returning();
  return newVerification;
};

/**
 * 2. Get verification record by ID with related User and Organization details
 */
export const getVerificationById = async (
  id: number
): Promise<TSelectOrganizerVerification | undefined> => {
  return await db.query.organizerVerifications.findFirst({
    where: eq(organizerVerifications.id, id),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 3. Get verification record by User Digital ID
 */
export const getVerificationByUserId = async (
  userId: number
): Promise<TSelectOrganizerVerification | undefined> => {
  return await db.query.organizerVerifications.findFirst({
    where: eq(organizerVerifications.userId, userId),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 4. Get verification record by Organization ID
 */
export const getVerificationByOrgId = async (
  orgId: number
): Promise<TSelectOrganizerVerification | undefined> => {
  return await db.query.organizerVerifications.findFirst({
    where: eq(organizerVerifications.orgId, orgId),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 5. Get all verification submissions with pagination
 */
export const getAllVerifications = async (
  limit: number = 50,
  offset: number = 0
): Promise<TSelectOrganizerVerification[]> => {
  return await db.query.organizerVerifications.findMany({
    limit,
    offset,
    orderBy: [desc(organizerVerifications.createdAt)],
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 6. Get verifications filtered by review status
 */
export const getVerificationsByStatus = async (
  status: "pending" | "in_progress" | "resubmission_requested" | "approved" | "rejected" | "suspended"
): Promise<TSelectOrganizerVerification[]> => {
  return await db.query.organizerVerifications.findMany({
    where: eq(organizerVerifications.status, status),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 7. Get verifications filtered by entity type (individual vs corporate)
 */
export const getVerificationsByEntityType = async (
  entityType: "individual" | "corporate"
): Promise<TSelectOrganizerVerification[]> => {
  return await db.query.organizerVerifications.findMany({
    where: eq(organizerVerifications.entityType, entityType),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 8. Update general verification details (e.g. document URLs or legal name)
 */
export const updateOrganizerVerification = async (
  id: number,
  data: Partial<TInsertOrganizerVerification>
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 9. Update global review status
 */
export const updateVerificationStatus = async (
  id: number,
  status: "pending" | "in_progress" | "resubmission_requested" | "approved" | "rejected" | "suspended",
  adminComment?: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status,
      adminComment: adminComment !== undefined ? adminComment : sql`adminComment`,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 10. Approve an organizer verification record fully
 */
export const approveOrganizerVerification = async (
  id: number,
  adminComment?: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "approved",
      idFrontRejected: false,
      idBackRejected: false,
      selfiesRejected: false,
      businessDocRejected: false,
      taxCertRejected: false,
      adminComment: adminComment || "Verification approved successfully.",
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 11. Reject an organizer verification record globally
 */
export const rejectOrganizerVerification = async (
  id: number,
  reason: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "rejected",
      adminComment: reason,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 12. Request targeted resubmission for specific assets
 */
export const requestOrganizerResubmission = async (
  id: number,
  generalComment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      adminComment: generalComment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 13. Itemized Rejection: Flag Front ID as rejected with custom comment
 */
export const rejectIdFrontField = async (
  id: number,
  comment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      idFrontRejected: true,
      idFrontComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 14. Itemized Rejection: Flag Back ID as rejected with custom comment
 */
export const rejectIdBackField = async (
  id: number,
  comment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      idBackRejected: true,
      idBackComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 15. Itemized Rejection: Flag Selfies as rejected with custom comment
 */
export const rejectSelfiesField = async (
  id: number,
  comment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      selfiesRejected: true,
      selfiesComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 16. Itemized Rejection: Flag Business Document as rejected with comment
 */
export const rejectBusinessDocField = async (
  id: number,
  comment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      businessDocRejected: true,
      businessDocComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 17. Itemized Rejection: Flag Tax Certificate as rejected with comment
 */
export const rejectTaxCertField = async (
  id: number,
  comment: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const [updated] = await db
    .update(organizerVerifications)
    .set({
      status: "resubmission_requested",
      taxCertRejected: true,
      taxCertComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 18. Clear an itemized field rejection once the organizer re-uploads the asset
 */
export const clearItemizedRejection = async (
  id: number,
  field: "idFront" | "idBack" | "selfies" | "businessDoc" | "taxCert",
  newUrlValue: string
): Promise<TSelectOrganizerVerification | undefined> => {
  const updatePayload: Record<string, any> = { updatedAt: new Date() };

  if (field === "idFront") {
    updatePayload.idFrontUrl = newUrlValue;
    updatePayload.idFrontRejected = false;
    updatePayload.idFrontComment = null;
  } else if (field === "idBack") {
    updatePayload.idBackUrl = newUrlValue;
    updatePayload.idBackRejected = false;
    updatePayload.idBackComment = null;
  } else if (field === "selfies") {
    updatePayload.selfiePhotos = [newUrlValue]; // or array handling
    updatePayload.selfiesRejected = false;
    updatePayload.selfiesComment = null;
  } else if (field === "businessDoc") {
    updatePayload.businessRegistrationDocUrl = newUrlValue;
    updatePayload.businessDocRejected = false;
    updatePayload.businessDocComment = null;
  } else if (field === "taxCert") {
    updatePayload.taxComplianceCertUrl = newUrlValue;
    updatePayload.taxCertRejected = false;
    updatePayload.taxCertComment = null;
  }

  const [updated] = await db
    .update(organizerVerifications)
    .set(updatePayload)
    .where(eq(organizerVerifications.id, id))
    .returning();
  return updated;
};

/**
 * 19. Get count of pending verifications for admin dashboards
 */
export const getPendingVerificationsCount = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizerVerifications)
    .where(eq(organizerVerifications.status, "pending"));
  return Number(result[0]?.count || 0);
};

/**
 * 20. Get all verifications currently awaiting resubmission review
 */
export const getVerificationsNeedingResubmission = async (): Promise<TSelectOrganizerVerification[]> => {
  return await db.query.organizerVerifications.findMany({
    where: eq(organizerVerifications.status, "resubmission_requested"),
    with: {
      user: true,
      organization: true,
    },
  });
};

/**
 * 21. Delete an organizer verification record (Admin cleanup/testing)
 */
export const deleteOrganizerVerification = async (
  id: number
): Promise<boolean> => {
  const result = await db
    .delete(organizerVerifications)
    .where(eq(organizerVerifications.id, id))
    .returning({ deletedId: organizerVerifications.id });
  return result.length > 0;
};