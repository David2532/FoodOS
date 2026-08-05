import { z } from "zod";

export const householdRoleSchema = z.enum(["owner", "member"]);
export const householdInviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const householdSummaryRowSchema = z.object({
  household_id: z.uuid(),
  household_name: z.string().trim().min(1).max(80),
  member_role: householdRoleSchema,
  membership_revision: z.coerce.number().int().positive(),
  member_count: z.coerce.number().int().positive(),
  member_limit: z.coerce.number().int().min(1).max(5)
});

export const householdMemberRowSchema = z.object({
  user_id: z.uuid(),
  member_role: householdRoleSchema,
  display_name: z.string().trim().min(1).max(80).nullable(),
  joined_at: z.iso.datetime({ offset: true }),
  membership_revision: z.coerce.number().int().positive()
});

export const pendingHouseholdInvitationRowSchema = z.object({
  invitation_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
  expires_at: z.iso.datetime({ offset: true })
});

export const createdHouseholdInvitationSchema = z.object({
  invitation_id: z.uuid(),
  invite_token: householdInviteTokenSchema,
  expires_at: z.iso.datetime({ offset: true }),
  membership_revision: z.coerce.number().int().positive()
});

export const acceptedHouseholdInvitationSchema = z.object({
  household_id: z.uuid(),
  household_name: z.string().trim().min(1).max(80),
  member_role: z.literal("member"),
  member_revision: z.coerce.number().int().positive(),
  membership_revision: z.coerce.number().int().positive()
});

export const membershipMutationResultSchema = z.object({
  membership_revision: z.coerce.number().int().positive()
}).passthrough();

export type HouseholdRole = z.infer<typeof householdRoleSchema>;
export type HouseholdSummaryRow = z.infer<typeof householdSummaryRowSchema>;
export type HouseholdMemberRow = z.infer<typeof householdMemberRowSchema>;
export type PendingHouseholdInvitationRow = z.infer<typeof pendingHouseholdInvitationRowSchema>;
export type CreatedHouseholdInvitation = z.infer<typeof createdHouseholdInvitationSchema>;
export type AcceptedHouseholdInvitation = z.infer<typeof acceptedHouseholdInvitationSchema>;
