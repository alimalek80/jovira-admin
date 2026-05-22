import { cookies } from "next/headers";
import Link from "next/link";
import {
  AGENCIES_ENDPOINTS,
  API_V1,
  INVENTORY_ENDPOINTS,
  RESERVATIONS_ENDPOINTS,
} from "@/lib/api-endpoints";

type Metric = {
  key: string;
  label: string;
  value: number | null;
  href: string;
  description: string;
};

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function resolveCount(payload: unknown): number | null {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as { count?: unknown; results?: unknown };

  if (typeof record.count === "number" && Number.isFinite(record.count)) {
    return record.count;
  }

  if (Array.isArray(record.results)) {
    return record.results.length;
  }

  return null;
}

async function fetchMetricCount(endpoint: string, accessToken: string | undefined): Promise<number | null> {
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripBearerPrefix(accessToken)}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    return resolveCount(payload);
  } catch {
    return null;
  }
}

function countLabel(value: number | null) {
  return value === null ? "--" : value.toLocaleString();
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;

  const [reservationsCount, tourPackagesCount, hotelsCount, agenciesCount, flightsCount] = await Promise.all([
    fetchMetricCount(RESERVATIONS_ENDPOINTS.adminReservations, accessToken),
    fetchMetricCount(INVENTORY_ENDPOINTS.adminTourPackages, accessToken),
    fetchMetricCount(INVENTORY_ENDPOINTS.adminHotels, accessToken),
    fetchMetricCount(AGENCIES_ENDPOINTS.adminAgencies, accessToken),
    fetchMetricCount(INVENTORY_ENDPOINTS.adminFlights, accessToken),
  ]);

  const metrics: Metric[] = [
    {
      key: "reservations",
      label: "Reservations",
      value: reservationsCount,
      href: "/reservations",
      description: "Manage bookings and service details.",
    },
    {
      key: "tour-packages",
      label: "Tour Packages",
      value: tourPackagesCount,
      href: "/tour-packages",
      description: "Edit packages and pricing quickly.",
    },
    {
      key: "hotels",
      label: "Hotels",
      value: hotelsCount,
      href: "/hotels",
      description: "Update room and destination inventory.",
    },
    {
      key: "agencies",
      label: "Agencies",
      value: agenciesCount,
      href: "/agencies",
      description: "Review and maintain partner agencies.",
    },
    {
      key: "flights",
      label: "Flights",
      value: flightsCount,
      href: "/flights",
      description: "Track and maintain flight data.",
    },
  ];

  const shortcuts = [
    { href: "/reservations", title: "Create or update reservation", note: "Most frequent daily operation" },
    { href: "/tour-packages", title: "Adjust package prices", note: "Public and agency prices" },
    { href: "/hotels", title: "Update hotel inventory", note: "Availability and core details" },
    { href: "/flights", title: "Review flight records", note: "Operations and schedule data" },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Operations Overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          Key admin metrics and direct access to the sections your staff uses most.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Link
            key={metric.key}
            href={metric.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{countLabel(metric.value)}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.description}</p>
            <p className="mt-3 text-xs font-semibold text-slate-700 group-hover:text-slate-900">Open section</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Actions</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="rounded-lg border border-slate-200 px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-slate-900">{shortcut.title}</p>
                <p className="mt-1 text-xs text-slate-500">{shortcut.note}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API Base</h3>
          <p className="mt-2 break-all text-xs text-slate-700">{API_V1}</p>
          <p className="mt-4 text-xs text-slate-500">
            If some metrics show --, verify backend availability and admin permissions.
          </p>
        </div>
      </div>
    </section>
  );
}