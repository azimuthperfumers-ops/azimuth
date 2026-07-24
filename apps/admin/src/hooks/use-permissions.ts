"use client";

import { can, type Access, type Resource, type StaffRole } from "@azimuth/api/permissions";

import { authClient } from "@/lib/auth-client";

// Client-side mirror of the server RBAC check. Same `can()` map the API enforces,
// so the sidebar/pages hide exactly what the server would reject. Server remains
// the real gate — this is only for UX.
export function usePermissions() {
  const { data: session, isPending } = authClient.useSession();
  const staffRole = (session?.user as { staffRole?: StaffRole | null } | undefined)?.staffRole ?? null;

  return {
    isPending,
    staffRole,
    isOwner: staffRole === "owner",
    // `can("orders")` checks read; `can("orders", "write")` checks write.
    can: (resource: Resource, access: Access = "read") => can(staffRole, resource, access),
  };
}
