import { eq, and, desc, ilike, count } from "drizzle-orm";
import db from "../../drizzle/db";
import {
  organizations,
  organizationMembers,
  users,
  TSelectOrg,
  TInsertOrg,
  TSelectOrgMember,
  TInsertOrgMember,
} from "../../drizzle/schema";

export type { TSelectOrg, TInsertOrg, TSelectOrgMember, TInsertOrgMember };

export type UpdateOrgInput = Partial<TInsertOrg> & {
  isVerified?: boolean;
  isActive?: boolean;
};

// ==========================================
// 🏢 SECURE ORGANIZATION & MEMBER SERVICES
// ==========================================

/**
 * 1. ✅ Create a new organization tenant with role check (Admin or Organizer only)
 * Automatically enforces a default 5.00% commission and links the creator as the 'owner'.
 */
export const createOrganizationWithRoleCheckService = async (
  digitalId: number,
  input: TInsertOrg
): Promise<{ organization: TSelectOrg; member: TSelectOrgMember }> => {
  // Step A: Fetch the user to check their global/system role
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.digitalId, digitalId));

  if (!userRecord) {
    throw new Error("User not found ❌");
  }

  // Step B: Enforce that only 'admin' or 'organizer' can create an organization
  if (userRecord.role !== "admin" && userRecord.role !== "organizer") {
    throw new Error("Unauthorized: Only users with 'admin' or 'organizer' roles can create an organization 🚫");
  }

  // Step C: Ensure commission defaults to 5.00 if not provided
  const organizationData = {
    ...input,
    commissionPercentage: input.commissionPercentage ?? "5.00",
  };

  // Step D: Run transaction to create the org and assign the creator as 'owner'
  const result = await db.transaction(async (tx) => {
    const [newOrg] = await tx
      .insert(organizations)
      .values(organizationData)
      .returning();

    if (!newOrg) {
      throw new Error("Failed to create organization ⚠️");
    }

    const [newMember] = await tx
      .insert(organizationMembers)
      .values({
        orgId: newOrg.orgId,
        digitalId: userRecord.digitalId,
        orgRole: "owner", // Creator gets owner privileges
      })
      .returning();

    return { organization: newOrg, member: newMember };
  });

  return result;
};

// 2. ✅ Get organization by primary key (orgId)
export const getOrganizationByIdService = async (
  orgId: number
): Promise<TSelectOrg | null> => {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.orgId, orgId));
  return org || null;
};

// 3. ✅ Get organization with full relations
export const getOrganizationWithRelationsService = async (orgId: number) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.orgId, orgId),
    with: {
      members: {
        with: {
          user: true,
        },
      },
      venues: true,
      events: true,
      payments: true,
      wallet: true,
      payouts: true,
      payoutMethods: true,
      promoCodes: true,
      scannerLogs: true,
      auditLogs: true,
    },
  });
  return org || null;
};

// 4. ✅ Get organization by URL slug
export const getOrganizationBySlugService = async (
  slug: string
): Promise<TSelectOrg | null> => {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  return org || null;
};

// 5. ✅ Update organization profile details
export const updateOrganizationService = async (
  orgId: number,
  input: UpdateOrgInput
): Promise<TSelectOrg | null> => {
  const [updatedOrg] = await db
    .update(organizations)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(organizations.orgId, orgId))
    .returning();
  return updatedOrg || null;
};

// 6. ✅ List all active organizations
export const listActiveOrganizationsService = async (): Promise<TSelectOrg[]> => {
  const results = await db
    .select()
    .from(organizations)
    .where(eq(organizations.isActive, true));
  return results;
};

// 7. ✅ Get all organizations (Admin view)
export const getAllOrganizationsService = async (): Promise<TSelectOrg[]> => {
  const results = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));
  return results;
};

// 8. ✅ Admin: Set or update organization commission percentage
export const updateOrganizationCommissionService = async (
  orgId: number,
  commissionPercentage: string
): Promise<TSelectOrg | null> => {
  const [updatedOrg] = await db
    .update(organizations)
    .set({
      commissionPercentage,
      updatedAt: new Date(),
    })
    .where(eq(organizations.orgId, orgId))
    .returning();
  return updatedOrg || null;
};

// 9. ✅ Admin: Verify or unverify an organization badge
export const verifyOrganizationService = async (
  orgId: number,
  isVerified: boolean
): Promise<TSelectOrg | null> => {
  const [updatedOrg] = await db
    .update(organizations)
    .set({
      isVerified,
      updatedAt: new Date(),
    })
    .where(eq(organizations.orgId, orgId))
    .returning();
  return updatedOrg || null;
};

// 10. ✅ Admin: Toggle organization active/suspended status
export const toggleOrganizationStatusService = async (
  orgId: number,
  isActive: boolean
): Promise<TSelectOrg | null> => {
  const [updatedOrg] = await db
    .update(organizations)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(organizations.orgId, orgId))
    .returning();
  return updatedOrg || null;
};

// 11. ✅ Search organizations by name
export const searchOrganizationsService = async (
  query: string
): Promise<TSelectOrg[]> => {
  const results = await db
    .select()
    .from(organizations)
    .where(ilike(organizations.name, `%${query}%`));
  return results;
};

// 12. ✅ Delete organization by orgId
export const deleteOrganizationService = async (orgId: number): Promise<string> => {
  await db.delete(organizations).where(eq(organizations.orgId, orgId));
  return "Organization deleted successfully ❌";
};

// 13. ✅ Add a user as a member to an organization
export const addOrganizationMemberService = async (
  input: TInsertOrgMember
): Promise<TSelectOrgMember> => {
  const [newMember] = await db.insert(organizationMembers).values(input).returning();
  return newMember;
};

// 14. ✅ Get all members belonging to an organization with user details (Using relational .with instead of .innerJoin)
export const getOrganizationMembersService = async (orgId: number) => {
  const membersList = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.orgId, orgId),
    with: {
      user: true,
    },
    orderBy: [desc(organizationMembers.createdAt)],
  });

  return membersList;
};

// 15. ✅ Check if a user belongs to an organization & get their role mapping
export const getOrganizationMemberByUserAndOrgService = async (
  orgId: number,
  digitalId: number
): Promise<TSelectOrgMember | null> => {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.digitalId, digitalId)
      )
    );
  return member || null;
};

// 16. ✅ Update a member's role within an organization
export const updateOrganizationMemberRoleService = async (
  memberId: number,
  orgRole: string
): Promise<TSelectOrgMember | null> => {
  const [updatedMember] = await db
    .update(organizationMembers)
    .set({ orgRole: orgRole as any })
    .where(eq(organizationMembers.memberId, memberId))
    .returning();
  return updatedMember || null;
};

// 17. ✅ Remove a member from an organization
export const removeOrganizationMemberService = async (
  memberId: number
): Promise<string> => {
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.memberId, memberId));
  return "Organization member removed successfully ❌";
};

// 18. ✅ Get all organizations a user belongs to (Using relational .with)
export const getUserOrganizationsService = async (digitalId: number) => {
  const userOrgs = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.digitalId, digitalId),
    with: {
      organization: true,
    },
    orderBy: [desc(organizationMembers.createdAt)],
  });

  return userOrgs;
};

// 19. ✅ Count total active members inside an organization
export const countOrganizationMembersService = async (orgId: number): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId));
  return Number(result?.count || 0);
};

// 20. ✅ Get summary statistics for an organization dashboard
export const getOrganizationStatsService = async (orgId: number) => {
  const [memberCountResult] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId));

  const orgDetails = await getOrganizationByIdService(orgId);

  return {
    orgId,
    name: orgDetails?.name,
    isVerified: orgDetails?.isVerified,
    isActive: orgDetails?.isActive,
    commissionPercentage: orgDetails?.commissionPercentage ?? "5.00",
    totalMembers: Number(memberCountResult?.count || 0),
  };
};

// 21. ✅ Update payout configuration for an organization
export const updateOrganizationPayoutConfigService = async (
  orgId: number,
  payoutPhone: string,
  payoutType: "mpesa_phone" | "paybill" | "bank"
): Promise<TSelectOrg | null> => {
  const [updated] = await db
    .update(organizations)
    .set({
      payoutPhone,
      payoutType,
      updatedAt: new Date(),
    })
    .where(eq(organizations.orgId, orgId))
    .returning();
  return updated || null;
};