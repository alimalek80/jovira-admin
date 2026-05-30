import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import DashboardUserMenu from "@/components/dashboard-user-menu";
import DashboardSidebarNav from "@/components/dashboard-sidebar-nav";
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-800 bg-slate-950 text-slate-100">
        <div className="border-b border-slate-800 px-6 py-6">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Jovira</p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Admin Panel</h1>
        </div>

        <DashboardSidebarNav />
      </aside>

      <div className="ml-64 min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Operational Dashboard</p>
            <DashboardUserMenu />
          </div>
        </header>

        <main className="px-8 py-8">{children}</main>
      </div>
    </div>
  );
}