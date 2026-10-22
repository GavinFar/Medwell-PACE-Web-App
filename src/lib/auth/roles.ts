// The four platform roles. A user's role is stored in Supabase app_metadata.role,
// which only the server (service-role key) can change; see the rls_policies migration.

export const ROLES = ["participant", "organizer", "sponsor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  participant: "Volunteer",
  organizer: "Organizer",
  sponsor: "Sponsor",
  admin: "Admin",
};

// Missing or unknown roles count as participant, the least-privileged role.
// This matches public.app_role() in the database.
export function toRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "participant";
}
