"use client";

import { useQuery } from "@tanstack/react-query";
import { listReservationActivity, type ReservationActivityEntry } from "@/lib/api/reservation-services";

const ACTION_LABELS: Record<ReservationActivityEntry["action"], string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  STATUS_CHANGED: "Status Changed",
  FINANCE_LOCKED: "Finance Locked",
  FINANCE_UNLOCKED: "Finance Unlocked",
  TOURIST_ADDED: "Tourist Added",
  HOTEL_BOOKING_ADDED: "Hotel Booking Added",
  HOTEL_BOOKING_UPDATED: "Hotel Booking Updated",
  FLIGHT_TICKET_ADDED: "Flight Ticket Added",
  TRANSFER_SERVICE_ADDED: "Transfer Service Added",
  EXCURSION_BOOKING_ADDED: "Excursion Booking Added",
  EXCURSION_SERVICE_ADDED: "Excursion Service Added",
};

function formatTimestamp(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type ActivityTimelineProps = {
  reservationId: number;
};

export default function ActivityTimeline({ reservationId }: ActivityTimelineProps) {
  const query = useQuery({
    queryKey: ["reservation-service", "activity", reservationId],
    queryFn: () => listReservationActivity(reservationId),
    enabled: typeof reservationId === "number" && reservationId > 0,
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {typeof reservationId !== "number" || reservationId <= 0 ? (
        <p className="text-xs text-slate-500">Save or select a reservation to view activity history.</p>
      ) : query.isLoading ? (
        <p className="text-xs text-slate-500">Loading activity history...</p>
      ) : query.isError ? (
        <p className="text-xs text-red-600">Failed to load activity history.</p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-slate-500">No activity recorded yet.</p>
      ) : (
        <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Action</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Message</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Actor</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((entry, index) => (
              <tr
                key={entry.id}
                className={index % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50 hover:bg-slate-100"}
              >
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800 max-w-[140px] truncate">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700 max-w-[260px] truncate">
                  {entry.message || "-"}
                </td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                  {entry.actorEmail ?? "System"}
                  {entry.actorRole ? (
                    <span className="ml-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      {entry.actorRole}
                    </span>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-500">
                  {formatTimestamp(entry.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}