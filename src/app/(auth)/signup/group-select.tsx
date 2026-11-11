import { listOrganizations, type OrganizationOption } from "@/lib/auth/organizations";

// The "Your group" dropdown on the sign-up form. The form sends the chosen
// organization's id as organizationId; "" means no group.
export async function GroupSelect() {
  return <Select organizations={await listOrganizations()} />;
}

// Shown while the list loads.
export function GroupSelectLoading() {
  return <Select organizations={[]} />;
}

function Select({ organizations }: { organizations: OrganizationOption[] }) {
  return (
    <select className="input" id="cohort" name="organizationId" defaultValue="">
      <option value="">Select your group</option>
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
