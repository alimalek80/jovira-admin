import { USER_ROLES } from "@/lib/api-endpoints";
import type { AuthenticatedUser } from "@/lib/auth/types";

export function hasBlockedAdminRole(role: string | undefined) {
  return role === USER_ROLES.NORMAL || role === USER_ROLES.AGENCY;
}

export function canAccessAdminApp(user: Pick<AuthenticatedUser, "role" | "is_staff" | "is_superuser">) {
  if (user.is_superuser || user.is_staff) {
    return true;
  }

  if (hasBlockedAdminRole(user.role)) {
    return false;
  }

  return user.role === USER_ROLES.STAFF;
}
