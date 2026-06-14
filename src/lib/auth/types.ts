import { USER_ROLES, type UserRole } from "@/lib/api-endpoints";

export type { UserRole };
export { USER_ROLES };

export type StaffRole = "ADMIN" | "SALES" | "RESERVATION" | "INVENTORY" | "FINANCE";
export type ClientRole = "NORMAL" | "AGENCY";

export type AuthenticatedUser = {
  id: number | string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role?: UserRole | string;
  agency?: number | null;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
};
