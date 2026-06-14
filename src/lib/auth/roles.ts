import { USER_ROLES } from "@/lib/api-endpoints";
import type { AuthenticatedUser } from "@/lib/auth/types";

export function hasBlockedAdminRole(role: string | undefined) {
  return role === USER_ROLES.NORMAL || role === USER_ROLES.AGENCY || !role;
}

const ALLOWED_STAFF_ROLES = [
  USER_ROLES.ADMIN,
  USER_ROLES.SALES,
  USER_ROLES.RESERVATION,
  USER_ROLES.INVENTORY,
  USER_ROLES.FINANCE,
];

export function canAccessAdminApp(user: Pick<AuthenticatedUser, "role" | "is_staff" | "is_superuser">) {
  if (user.is_superuser || user.is_staff) {
    return true;
  }

  if (hasBlockedAdminRole(user.role)) {
    return false;
  }

  return ALLOWED_STAFF_ROLES.includes(user.role as (typeof ALLOWED_STAFF_ROLES)[number]);
}
