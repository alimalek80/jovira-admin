"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import DashboardSidebarNav from "@/components/dashboard-sidebar-nav";
import DashboardUserMenu from "@/components/dashboard-user-menu";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-100 transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand header */}
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

        {/* Scrollable nav */}
        <DashboardSidebarNav collapsed={collapsed} />

        {/* Collapse toggle */}
        <div className="shrink-0 border-t border-slate-800 p-2">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white ${
              collapsed ? "justify-center" : "justify-between px-3"
            }`}
          >
            {!collapsed && (
              <span className="text-xs font-medium">Collapse</span>
            )}
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <ChevronLeft size={15} />
            )}
          </button>
        </div>
      </aside>

      {/* Main content — shifts with the sidebar */}
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

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
