import { describe, expect, it } from "vitest";
import { USER_ROLES } from "@/lib/auth/types";
import { canAccessAdminApp } from "@/lib/auth/roles";

describe("canAccessAdminApp", () => {
  it("allows organizational staff roles", () => {
    expect(
      canAccessAdminApp({
        role: USER_ROLES.SALES,
        is_staff: false,
        is_superuser: false,
      })
    ).toBe(true);
  });

  it("allows Django admin staff", () => {
    expect(
      canAccessAdminApp({
        role: USER_ROLES.NORMAL,
        is_staff: true,
        is_superuser: false,
      })
    ).toBe(true);
  });

  it("allows Django superuser", () => {
    expect(
      canAccessAdminApp({
        role: USER_ROLES.AGENCY,
        is_staff: false,
        is_superuser: true,
      })
    ).toBe(true);
  });

  it("blocks NORMAL users", () => {
    expect(
      canAccessAdminApp({
        role: USER_ROLES.NORMAL,
        is_staff: false,
        is_superuser: false,
      })
    ).toBe(false);
  });

  it("blocks AGENCY users", () => {
    expect(
      canAccessAdminApp({
        role: USER_ROLES.AGENCY,
        is_staff: false,
        is_superuser: false,
      })
    ).toBe(false);
  });
});
