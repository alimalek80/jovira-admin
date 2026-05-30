"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Building2,
  BedDouble,
  Plane,
  Map,
  Mountain,
  Car,
  Wrench,
  Truck,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/reservations", label: "Reservations", icon: CalendarCheck },
      { href: "/agencies", label: "Agencies", icon: Building2 },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/hotels", label: "Hotels", icon: BedDouble },
      { href: "/flights", label: "Flights", icon: Plane },
      { href: "/tour-packages", label: "Tour Packages", icon: Map },
      { href: "/excursions", label: "Excursions", icon: Mountain },
      { href: "/transfers", label: "Transfers", icon: Car },
    ],
  },
  {
    label: "Services & Providers",
    items: [
      { href: "/excursion-services", label: "Excursion Services", icon: Wrench },
      { href: "/transfer-providers", label: "Transfer Providers", icon: Truck },
    ],
  },
  {
    label: "Site",
    items: [
      { href: "/web-sections", label: "Web Sections", icon: Globe },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 py-4 flex flex-col gap-5 overflow-y-auto">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
                    }`}
                  >
                    <Icon
                      size={15}
                      className={active ? "text-white" : "text-slate-500"}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
