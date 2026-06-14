"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@/lib/auth/types";

type RoleGuardProps = {
  children: ReactNode;
  userRole?: string;       
  allowedRoles: string[];  
};

export default function RoleGuard({ children, userRole, allowedRoles }: RoleGuardProps) {
  if (!userRole) return null;
  
  
  if (userRole === "ADMIN") {
    return <>{children}</>;
  }

  if (allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  return null;
}