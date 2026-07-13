"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";

type FinancialSummaryBreakdownRow = {
  currency: string;
  total_selling: string | number;
  total_cost: string | number;
  margin: string | number;
};

type FinancialSummaryResponse = {
  reservation_id: number;
  reservation_number: string;
  breakdown: FinancialSummaryBreakdownRow[];
};

function marginClassName(margin: string | number) {
  const value = Number(margin);
  if (!Number.isFinite(value) || value === 0) {
    return "text-slate-600";
  }
  return value > 0 ? "text-emerald-600" : "text-red-600";
}

export default function FinancialSummaryPanel({ reservationId }: { reservationId: number }) {
  const financialSummaryQuery = useQuery({
    queryKey: ["reservation-financial-summary", reservationId],
    queryFn: async () => {
      const response = await axiosInstance.get<FinancialSummaryResponse>(
        RESERVATIONS_ENDPOINTS.adminReservationFinancialSummary(reservationId)
      );
      return response.data;
    },
    enabled: Boolean(reservationId),
  });

  const breakdown = financialSummaryQuery.data?.breakdown ?? [];

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Financial Summary</h3>
      </div>

      <div className="min-h-0 overflow-auto">
        {financialSummaryQuery.isLoading ? (
          <div className="px-4 py-5 text-xs text-slate-500">Loading financial summary...</div>
        ) : breakdown.length === 0 ? (
          <div className="px-4 py-5 text-xs text-slate-500">
            No financial data available for this reservation.
          </div>
        ) : (
          <table className="min-w-[480px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Currency</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Total Selling</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Total Cost</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, index) => (
                <tr
                  key={`${row.currency}-${index}`}
                  className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                >
                  <td className="border-b border-slate-100 px-3 py-2 align-middle font-semibold text-slate-700">
                    {row.currency}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle">{row.total_selling}</td>
                  <td className="border-b border-slate-100 px-3 py-2 align-middle">{row.total_cost}</td>
                  <td className={`border-b border-slate-100 px-3 py-2 align-middle font-semibold ${marginClassName(row.margin)}`}>
                    {row.margin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
