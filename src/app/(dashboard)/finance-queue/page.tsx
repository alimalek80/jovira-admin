"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

type FinanceQueueAgency = { id: number; name?: string | null } | number | null;

type FinanceQueueReservation = {
  id: number;
  reservation_number: string;
  status: string;
  agency: FinanceQueueAgency;
  created_at: string;
  tourists?: unknown[];
  assigned_to_email?: string | null;
};

function normalizeFinanceQueue(payload: unknown): FinanceQueueReservation[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows.filter((row): row is FinanceQueueReservation => Boolean(row && typeof row === "object"));
}

function agencyLabel(agency: FinanceQueueAgency) {
  if (agency === null || agency === undefined) {
    return "-";
  }
  if (typeof agency === "number") {
    return String(agency);
  }
  return agency.name?.trim() || String(agency.id);
}

function statusBadgeClassName(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (normalized === "ON_PROCESS") return "border-sky-300 bg-sky-50 text-sky-700";
  if (normalized === "CANCELED" || normalized === "CANCELLED") return "border-red-300 bg-red-50 text-red-700";
  if (normalized === "DRAFT") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export default function FinanceQueuePage() {
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();

  const isAdmin = Boolean(
    currentUser?.is_superuser || currentUser?.is_staff || currentUser?.role === "ADMIN"
  );
  const isFinance = currentUser?.role === "FINANCE";
  const hasAccess = isAdmin || isFinance;

  const financeQueueQuery = useQuery({
    queryKey: ["reservations", "finance-queue"],
    queryFn: async () => {
      const response = await axiosInstance.get(RESERVATIONS_ENDPOINTS.adminFinanceQueue);
      return normalizeFinanceQueue(response.data);
    },
    enabled: hasAccess,
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Finance Queue</h2>
        <p className="mt-0.5 text-sm text-slate-500">Reservations currently locked with the Finance team.</p>
      </div>

      {isUserLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-xs text-slate-500 shadow-sm">
          Loading...
        </div>
      ) : !hasAccess ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm font-medium text-red-700 shadow-sm">
          Access denied
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto">
            <table className="min-w-[880px] text-left text-xs">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Reservation #</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Status</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Agency</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Created At</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Tourists</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Assigned To</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {financeQueueQuery.isLoading ? (
                  <tr>
                    <td className="px-3 py-5 text-xs text-slate-500" colSpan={7}>
                      Loading reservations...
                    </td>
                  </tr>
                ) : (financeQueueQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-xs text-slate-500" colSpan={7}>
                      No reservations currently with Finance.
                    </td>
                  </tr>
                ) : (
                  (financeQueueQuery.data ?? []).map((row, index) => (
                    <tr
                      key={row.id}
                      className={index % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 hover:bg-slate-100/80"}
                    >
                      <td className="border-b border-slate-100 px-3 py-2 align-middle font-semibold text-slate-700">
                        {row.reservation_number}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClassName(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">{agencyLabel(row.agency)}</td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        {String(row.created_at ?? "").slice(0, 10)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        {Array.isArray(row.tourists) ? row.tourists.length : 0}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        {row.assigned_to_email || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-middle">
                        <Link
                          href={`/reservations?search=${encodeURIComponent(row.reservation_number)}`}
                          className="inline-flex h-7 items-center rounded border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
