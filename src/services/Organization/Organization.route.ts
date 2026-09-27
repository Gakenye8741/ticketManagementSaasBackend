import { Router } from "express";
import {
  createOrganization,
  getOrganizationById,
  getOrganizationWithRelations,
  getOrganizationBySlug,
  updateOrganization,
  listActiveOrganizations,
  getAllOrganizations,
  updateOrganizationCommission,
  verifyOrganization,
  toggleOrganizationStatus,
  searchOrganizations,
  deleteOrganization,
  addOrganizationMember,
  getOrganizationMembers,
  getOrganizationMemberByUserAndOrg,
  updateOrganizationMemberRole,
  removeOrganizationMember,
  getUserOrganizations,
  countOrganizationMembers,
  getOrganizationStats,
  updateOrganizationPayoutConfig,
} from "./Organaization.controller";

// Import authentication and role middlewares
import {
  adminAuth,
  adminOrOrganizerAuth,
  anyAuthenticatedUser,
} from "../../middleware/bearAuth"; 

const OrgRouter = Router();

// ==========================================
// 🏢 ORGANIZATION ROUTES
// ==========================================

// 1. Create Organization (Requires authenticated organizer or admin session)
OrgRouter.post("/", adminOrOrganizerAuth, createOrganization);

// 2. List Active Organizations (Public/Client facing)
OrgRouter.get("/active", listActiveOrganizations);

// 3. Admin: Get All Organizations
OrgRouter.get("/admin/all", adminAuth, getAllOrganizations);

// 4. Search Organizations by Query (Public)
OrgRouter.get("/search", searchOrganizations);

// 5. Get Organization by URL Slug (Public)
OrgRouter.get("/slug/:slug", getOrganizationBySlug);

// 6. Get Organization Summary Dashboard Stats (Protected: Organizers/Admins)
OrgRouter.get("/:orgId/stats", adminOrOrganizerAuth, getOrganizationStats);

// 7. Get Total Active Members Count in an Organization (Protected)
OrgRouter.get("/:orgId/members/count", anyAuthenticatedUser, countOrganizationMembers);

// 8. Get All Members for an Organization (Protected)
OrgRouter.get("/:orgId/members", anyAuthenticatedUser, getOrganizationMembers);

// 9. Check Member Mapping by User Digital ID and Organization ID (Protected)
OrgRouter.get("/:orgId/members/user/:digitalId", anyAuthenticatedUser, getOrganizationMemberByUserAndOrg);

// 10. Get Organization with Full Relations (Protected)
OrgRouter.get("/:orgId/relations", adminOrOrganizerAuth, getOrganizationWithRelations);

// 11. Get Organization by ID (Public profile info)
OrgRouter.get("/:orgId", getOrganizationById);

// 12. Update Organization Profile Details (Protected: Organizer/Admin)
OrgRouter.put("/:orgId", adminOrOrganizerAuth, updateOrganization);

// 13. Update Payout Configuration (Protected: Organizer/Admin)
OrgRouter.put("/:orgId/payout", adminOrOrganizerAuth, updateOrganizationPayoutConfig);

// 14. Admin: Update Organization Commission Percentage
OrgRouter.patch("/:orgId/commission", adminAuth, updateOrganizationCommission);

// 15. Admin: Verify or Unverify Organization Badge
OrgRouter.patch("/:orgId/verify", adminAuth, verifyOrganization);

// 16. Admin: Toggle Organization Active/Suspended Status
OrgRouter.patch("/:orgId/status", adminAuth, toggleOrganizationStatus);

// 17. Delete Organization (Admin Only)
OrgRouter.delete("/:orgId", adminAuth, deleteOrganization);


// ==========================================
// 👤 ORGANIZATION MEMBER & ROLE ROUTES
// ==========================================

// 18. Get All Organizations a Specific User Belongs To
OrgRouter.get("/user/:digitalId", anyAuthenticatedUser, getUserOrganizations);

// 19. Add a Member to an Organization (Protected: Organizer/Admin)
OrgRouter.post("/members", adminOrOrganizerAuth, addOrganizationMember);

// 20. Update Organization Member Role (Protected: Organizer/Admin)
OrgRouter.patch("/members/:memberId/role", adminOrOrganizerAuth, updateOrganizationMemberRole);

// 21. Remove Member from Organization (Protected: Organizer/Admin)
OrgRouter.delete("/members/:memberId", adminOrOrganizerAuth, removeOrganizationMember);

export default OrgRouter;