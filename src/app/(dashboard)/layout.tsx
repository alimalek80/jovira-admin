import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard-shell";
import { resolveAdminAppUser } from "@/lib/auth/server-auth";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;

  if (!accessToken) {
    redirect("/login");
  }

  const currentUser = await resolveAdminAppUser(accessToken);

  if (!currentUser) {
    redirect("/login?error=access_denied");
  }

  return <DashboardShell>{children}</DashboardShell>;
}