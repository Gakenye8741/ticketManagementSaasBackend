import { Request, Response } from "express";
import {
  createOrganizationWithRoleCheckService,
  getOrganizationByIdService,
  getOrganizationWithRelationsService,
  getOrganizationBySlugService,
  updateOrganizationService,
  listActiveOrganizationsService,
  getAllOrganizationsService,
  updateOrganizationCommissionService,
  verifyOrganizationService,
  toggleOrganizationStatusService,
  searchOrganizationsService,
  deleteOrganizationService,
  addOrganizationMemberService,
  getOrganizationMembersService,
  getOrganizationMemberByUserAndOrgService,
  updateOrganizationMemberRoleService,
  removeOrganizationMemberService,
  getUserOrganizationsService,
  countOrganizationMembersService,
  getOrganizationStatsService,
  updateOrganizationPayoutConfigService,
} from "./Organaization.service";

import {
  createOrganizationValidator,
  updateOrganizationValidator,
  updateCommissionValidator,
  verifyOrganizationValidator,
  toggleOrganizationStatusValidator,
  searchOrganizationValidator,
  addOrganizationMemberValidator,
  updateMemberRoleValidator,
  updatePayoutConfigValidator,
} from "../../validators/org.validator";

// ==========================================
// 🏢 ORGANIZATION CONTROLLER HANDLERS
// ==========================================

/**
 * 1. ✅ Create Organization (Enforces Organizer/Admin role via service)
 */
export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    // Assuming authenticated user's digitalId is attached to req.user by middleware
    const digitalId = (req as any).user?.digitalId;
    if (!digitalId) {
      res.status(401).json({ error: "Unauthorized: Missing user session 🚫" });
      return;
    }

    const validationResult = createOrganizationValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const result = await createOrganizationWithRoleCheckService(digitalId, validationResult.data);
    res.status(201).json({
      message: "Organization created successfully 🚀",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create organization ⚠️" });
  }
};

/**
 * 2. ✅ Get Organization by ID
 */
export const getOrganizationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const org = await getOrganizationByIdService(orgId);
    if (!org) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({ data: org });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 3. ✅ Get Organization with Full Relations
 */
export const getOrganizationWithRelations = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const org = await getOrganizationWithRelationsService(orgId);
    if (!org) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({ data: org });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 4. ✅ Get Organization by URL Slug
 */
export const getOrganizationBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure slug is treated as a string even if Express types it as string | string[]
    const slug = String(req.params.slug);
    const org = await getOrganizationBySlugService(slug);
    if (!org) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({ data: org });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 5. ✅ Update Organization Profile Details
 */
export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const validationResult = updateOrganizationValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updated = await updateOrganizationService(orgId, validationResult.data);
    if (!updated) {
      res.status(404).json({ error: "Organization not found to update ❌" });
      return;
    }

    res.status(200).json({
      message: "Organization updated successfully ✨",
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update organization ⚠️" });
  }
};

/**
 * 6. ✅ List Active Organizations
 */
export const listActiveOrganizations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await listActiveOrganizationsService();
    res.status(200).json({ data: orgs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 7. ✅ Get All Organizations (Admin View)
 */
export const getAllOrganizations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await getAllOrganizationsService();
    res.status(200).json({ data: orgs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 8. ✅ Admin: Update Organization Commission Percentage
 */
export const updateOrganizationCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const validationResult = updateCommissionValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updated = await updateOrganizationCommissionService(orgId, validationResult.data.commissionPercentage);
    if (!updated) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({
      message: "Commission percentage updated successfully 💰",
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update commission ⚠️" });
  }
};

/**
 * 9. ✅ Admin: Verify or Unverify Organization Badge
 */
export const verifyOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const validationResult = verifyOrganizationValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updated = await verifyOrganizationService(orgId, validationResult.data.isVerified);
    if (!updated) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({
      message: `Organization verification status updated to: ${validationResult.data.isVerified} ✅`,
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update verification status ⚠️" });
  }
};

/**
 * 10. ✅ Admin: Toggle Organization Active/Suspended Status
 */
export const toggleOrganizationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const validationResult = toggleOrganizationStatusValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updated = await toggleOrganizationStatusService(orgId, validationResult.data.isActive);
    if (!updated) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({
      message: `Organization active status updated to: ${validationResult.data.isActive} ⚡`,
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update status ⚠️" });
  }
};

/**
 * 11. ✅ Search Organizations by Name
 */
export const searchOrganizations = async (req: Request, res: Response): Promise<void> => {
  try {
    const queryParam = req.query.q as string;
    const validationResult = searchOrganizationValidator.safeParse({ query: queryParam });
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const results = await searchOrganizationsService(validationResult.data.query);
    res.status(200).json({ data: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 12. ✅ Delete Organization
 */
export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const responseMessage = await deleteOrganizationService(orgId);
    res.status(200).json({ message: responseMessage });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 13. ✅ Add Member to Organization
 */
export const addOrganizationMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = addOrganizationMemberValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const newMember = await addOrganizationMemberService(validationResult.data);
    res.status(201).json({
      message: "Organization member added successfully 👤",
      data: newMember,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to add member ⚠️" });
  }
};

/**
 * 14. ✅ Get All Members for an Organization
 */
export const getOrganizationMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const members = await getOrganizationMembersService(orgId);
    res.status(200).json({ data: members });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 15. ✅ Check Member Mapping by User and Org
 */
export const getOrganizationMemberByUserAndOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    const digitalId = Number(req.params.digitalId);
    if (isNaN(orgId) || isNaN(digitalId)) {
      res.status(400).json({ error: "Invalid organization ID or digital ID format ❌" });
      return;
    }

    const member = await getOrganizationMemberByUserAndOrgService(orgId, digitalId);
    if (!member) {
      res.status(404).json({ error: "Organization member link not found ❌" });
      return;
    }

    res.status(200).json({ data: member });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 16. ✅ Update Member Role
 */
export const updateOrganizationMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = Number(req.params.memberId);
    if (isNaN(memberId)) {
      res.status(400).json({ error: "Invalid member ID format ❌" });
      return;
    }

    const validationResult = updateMemberRoleValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const updated = await updateOrganizationMemberRoleService(memberId, validationResult.data.orgRole);
    if (!updated) {
      res.status(404).json({ error: "Organization member not found ❌" });
      return;
    }

    res.status(200).json({
      message: "Member role updated successfully 🔄",
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update member role ⚠️" });
  }
};

/**
 * 17. ✅ Remove Member from Organization
 */
export const removeOrganizationMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = Number(req.params.memberId);
    if (isNaN(memberId)) {
      res.status(400).json({ error: "Invalid member ID format ❌" });
      return;
    }

    const responseMessage = await removeOrganizationMemberService(memberId);
    res.status(200).json({ message: responseMessage });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 18. ✅ Get All Organizations a User Belongs To
 */
export const getUserOrganizations = async (req: Request, res: Response): Promise<void> => {
  try {
    const digitalId = Number(req.params.digitalId);
    if (isNaN(digitalId)) {
      res.status(400).json({ error: "Invalid digital ID format ❌" });
      return;
    }

    const orgs = await getUserOrganizationsService(digitalId);
    res.status(200).json({ data: orgs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 19. ✅ Count Total Active Members in an Organization
 */
export const countOrganizationMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const count = await countOrganizationMembersService(orgId);
    res.status(200).json({ orgId, totalMembers: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 20. ✅ Get Organization Summary Dashboard Stats
 */
export const getOrganizationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const stats = await getOrganizationStatsService(orgId);
    res.status(200).json({ data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error ⚠️" });
  }
};

/**
 * 21. ✅ Update Payout Configuration for Organization
 */
export const updateOrganizationPayoutConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = Number(req.params.orgId);
    if (isNaN(orgId)) {
      res.status(400).json({ error: "Invalid organization ID format ❌" });
      return;
    }

    const validationResult = updatePayoutConfigValidator.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({ error: validationResult.error.format() });
      return;
    }

    const { payoutPhone, payoutType } = validationResult.data;
    const updated = await updateOrganizationPayoutConfigService(orgId, payoutPhone, payoutType);
    if (!updated) {
      res.status(404).json({ error: "Organization not found ❌" });
      return;
    }

    res.status(200).json({
      message: "Payout configuration updated successfully 💳",
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update payout configuration ⚠️" });
  }
};