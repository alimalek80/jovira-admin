import type { AuthenticatedUser } from "@/lib/auth/types";

export type AdminRole = "ADMIN" | "SALES" | "RESERVATION" | "INVENTORY" | "FINANCE";

const ADMIN_ROLES: readonly AdminRole[] = [
  "ADMIN",
  "SALES",
  "RESERVATION",
  "INVENTORY",
  "FINANCE",
];

type RouteAccessRule = {
  path: string;
  allowedRoles?: readonly AdminRole[];
};

const ADMIN_ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  {
    path: "/",
  },
  {
    path: "/reservations",
    allowedRoles: ["SALES", "RESERVATION", "FINANCE"],
  },
  {
    path: "/work-desk",
    allowedRoles: ["ADMIN", "RESERVATION"],
  },
  {
    path: "/agencies",
    allowedRoles: ["SALES", "RESERVATION", "FINANCE"],
  },
  {
    path: "/hotels",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/hotel-rooms",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/flights",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/tour-packages",
    allowedRoles: ["INVENTORY", "SALES"],
  },
  {
    path: "/excursions",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/transfers",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/excursion-services",
    allowedRoles: ["INVENTORY"],
  },
  {
    path: "/transfer-providers",
    allowedRoles: ["INVENTORY", "FINANCE"],
  },
  {
    path: "/web-sections",
    allowedRoles: ["ADMIN"],
  },
];

function isAdminRole(role: string | undefined): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

export function hasBlockedAdminRole(role: string | undefined) {
  return role === "NORMAL" || role === "AGENCY" || !isAdminRole(role);
}

export function isAdminLikeUser(
  user: Pick<AuthenticatedUser, "role" | "is_staff" | "is_superuser">
) {
  return Boolean(user.is_superuser || user.is_staff || user.role === "ADMIN");
}

export function canAccessAdminApp(
  user: Pick<AuthenticatedUser, "role" | "is_staff" | "is_superuser">
) {
  if (isAdminLikeUser(user)) {
    return true;
  }

  return !hasBlockedAdminRole(user.role);
}

function normalizePathname(pathname: string) {
  const cleanPath = pathname.split("?")[0]?.split("#")[0] || "/";
  const withLeadingSlash = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function matchesRouteRule(pathname: string, rulePath: string) {
  if (rulePath === "/") {
    return pathname === "/";
  }

  return pathname === rulePath || pathname.startsWith(`${rulePath}/`);
}

function findBestRouteAccessRule(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  return ADMIN_ROUTE_ACCESS_RULES.reduce<RouteAccessRule | null>((bestRule, currentRule) => {
    if (!matchesRouteRule(normalizedPathname, currentRule.path)) {
      return bestRule;
    }

    if (!bestRule || currentRule.path.length > bestRule.path.length) {
      return currentRule;
    }

    return bestRule;
  }, null);
}

export function canAccessAdminRoute(
  user: Pick<AuthenticatedUser, "role" | "is_staff" | "is_superuser">,
  pathname: string
) {
  if (!canAccessAdminApp(user)) {
    return false;
  }

  if (isAdminLikeUser(user)) {
    return true;
  }

  const routeAccessRule = findBestRouteAccessRule(pathname);

  if (!routeAccessRule) {
    return false;
  }

  if (!routeAccessRule.allowedRoles) {
    return true;
  }

  return routeAccessRule.allowedRoles.includes(user.role as AdminRole);
}