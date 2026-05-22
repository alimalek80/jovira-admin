import { USER_ROLES, type UserRole } from "@/lib/api-endpoints";

export type AuthenticatedUser = {
  id: number;
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

export { USER_ROLES };
