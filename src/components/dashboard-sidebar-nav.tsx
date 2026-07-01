"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  ListChecks,
  Building2,
  BedDouble,
  DoorOpen,
  Plane,
  Map,
  Mountain,
  Car,
  Wrench,
  Truck,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canAccessAdminRoute } from "@/lib/auth/roles";
import type { AuthenticatedUser } from "@/lib/auth/types";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Main",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/reservations",
        label: "Reservations",
        icon: CalendarCheck,
      },
      {
        href: "/work-desk",
        label: "Work Desk",
        icon: ListChecks,
      },
      {
        href: "/agencies",
        label: "Agencies",
        icon: Building2,
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        href: "/hotels",
        label: "Hotels",
        icon: BedDouble,
      },
      {
        href: "/hotel-rooms",
        label: "Hotel Rooms",
        icon: DoorOpen,
      },
      {
        href: "/flights",
        label: "Flights",
        icon: Plane,
      },
      {
        href: "/tour-packages",
        label: "Tour Packages",
        icon: Map,
      },
      {
        href: "/excursions",
        label: "Excursions",
        icon: Mountain,
      },
      {
        href: "/transfers",
        label: "Transfers",
        icon: Car,
      },
    ],
  },
  {
    label: "Services & Providers",
    items: [
      {
        href: "/excursion-services",
        label: "Excursion Services",
        icon: Wrench,
      },
      {
        href: "/transfer-providers",
        label: "Transfer Providers",
        icon: Truck,
      },
    ],
  },
  {
    label: "Site",
    items: [
      {
        href: "/web-sections",
        label: "Web Sections",
        icon: Globe,
      },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardSidebarNavProps = {
  collapsed?: boolean;
  user: AuthenticatedUser;
};

export default function DashboardSidebarNav({
  collapsed = false,
  user,
}: DashboardSidebarNavProps) {
  const pathname = usePathname();

  const filteredGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessAdminRoute(user, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
      {filteredGroups.map((group, groupIndex) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {collapsed ? (
            groupIndex > 0 ? (
              <div className="mx-2 mb-3 h-px bg-slate-800" />
            ) : null
          ) : (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>
          )}

          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-lg text-sm font-medium transition ${
                      collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2"
                    } ${
                      active
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={
                        active
                          ? "shrink-0 text-white"
                          : "shrink-0 text-slate-500 group-hover:text-slate-100"
                      }
                    />
                    {!collapsed && item.label}
                  </Link>

                  {collapsed && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100"
                    >
                      {item.label}
                      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}