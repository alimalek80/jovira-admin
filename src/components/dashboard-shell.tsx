"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import DashboardSidebarNav from "@/components/dashboard-sidebar-nav";
import DashboardUserMenu from "@/components/dashboard-user-menu";
import { canAccessAdminRoute } from "@/lib/auth/roles";
import type { AuthenticatedUser } from "@/lib/auth/types";

type DashboardShellProps = {
  children: ReactNode;
  user: AuthenticatedUser;
};

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const canAccessCurrentRoute = canAccessAdminRoute(user, pathname);

  useEffect(() => {
    if (!canAccessCurrentRoute) {
      router.replace("/");
    }
  }, [canAccessCurrentRoute, router]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-100 transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div
          className={`shrink-0 border-b border-slate-800 py-6 transition-[padding] duration-300 ease-in-out ${
            collapsed ? "flex items-center justify-center px-0" : "px-6"
          }`}
        >
          {collapsed ? (
            <span className="text-base font-bold text-slate-300">J</span>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Jovira</p>
              <h1 className="mt-2 text-lg font-semibold tracking-tight">Admin Panel</h1>
            </>
          )}
        </div>

        <DashboardSidebarNav collapsed={collapsed} user={user} />

        <div className="shrink-0 border-t border-slate-800 p-2">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white ${
              collapsed ? "justify-center" : "justify-between px-3"
            }`}
          >
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out ${
          collapsed ? "ml-16" : "ml-64"
        }`}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Operational Dashboard</p>
            <DashboardUserMenu />
          </div>
        </header>

        <main className="flex-1 px-8 py-8">
          {canAccessCurrentRoute ? (
            children
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <ShieldAlert size={24} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Access denied</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Your role does not have permission to access this page. Redirecting to the
                  dashboard...
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}