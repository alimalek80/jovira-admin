"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import TouristForm from "@/components/reservations/TouristForm";
import { useDeleteTourist, useTourists } from "@/hooks/use-tourists";
import type { Tourist } from "@/lib/api/tourists";

type TouristManagerProps = {
  reservationId: number | null;
  scope?: "admin" | "client";
  onTouristAdded?: (tourist: Tourist) => void;
  /** When set, only tourists whose IDs are in this array are shown (room selection filter). */
  filterTouristIds?: number[] | null;
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
  return normalized.slice(0, 10);
}

export default function TouristManager({ reservationId, scope = "admin", onTouristAdded, filterTouristIds }: TouristManagerProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTourist, setEditingTourist] = useState<Tourist | null>(null);
  const [selectedTouristId, setSelectedTouristId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const currentReservationId = typeof reservationId === "number" ? reservationId : null;
  const touristsQuery = useTourists(scope, reservationId ?? undefined, {
    enabled: typeof reservationId === "number" && reservationId > 0,
  });
  const deleteMutation = useDeleteTourist(scope, reservationId ?? undefined, {
    onSuccess: () => {
      setToastMessage("Tourist deleted successfully.");
      if (typeof reservationId === "number" && reservationId > 0) {
        queryClient.invalidateQueries({ queryKey: ["reservation-service", "flight-ticket", reservationId] });
      }
    },
  });

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastMessage("");
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toastMessage]);

  const isFiltered = Array.isArray(filterTouristIds);

  // When a room is selected, show only tourists assigned to that room.
  // Otherwise show all tourists for the reservation.
  const displayedTourists = isFiltered
    ? (touristsQuery.data ?? []).filter((t) => (filterTouristIds as number[]).includes(t.id))
    : (touristsQuery.data ?? []);

  const touristCountLabel = useMemo(() => {
    if (isFiltered) {
      const total = touristsQuery.data?.length ?? 0;
      const count = displayedTourists.length;
      return `${count} of ${total} tourist${total === 1 ? "" : "s"} (room filter active)`;
    }
    const count = touristsQuery.data?.length ?? 0;
    return `${count} tourist${count === 1 ? "" : "s"}`;
  }, [touristsQuery.data, displayedTourists.length, isFiltered]);

  const selectedTourist = useMemo(
    () => touristsQuery.data?.find((tourist) => tourist.id === selectedTouristId) ?? null,
    [selectedTouristId, touristsQuery.data]
  );
  const activeSelectedTouristId = selectedTourist?.id ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-4 py-2.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Tourists</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{touristCountLabel}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Table settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Filter"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
            </svg>
          </button>

          <button
            type="button"
            disabled={typeof reservationId !== "number" || reservationId <= 0}
            onClick={() => {
              setEditingTourist(null);
              setIsModalOpen(true);
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-800 bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>

          <button
            type="button"
            disabled={!selectedTourist}
            onClick={() => {
              if (!selectedTourist) {
                return;
              }

              setEditingTourist(selectedTourist);
              setIsModalOpen(true);
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-300 bg-slate-100 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
            Edit
          </button>

          <button
            type="button"
            disabled={!selectedTourist || deleteMutation.isPending}
            onClick={() => {
              if (!selectedTourist) {
                return;
              }

              const confirmed = window.confirm(
                `Delete tourist ${selectedTourist.first_name} ${selectedTourist.last_name}?`
              );

              if (!confirmed) {
                return;
              }

              void deleteMutation.mutateAsync(selectedTourist.id);
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-300 bg-slate-100 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {toastMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {isFiltered ? (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
          </svg>
          <span className="text-[11px] font-medium text-blue-800">
            Showing tourists assigned to selected room
          </span>
          {filterTouristIds?.length === 0 && (
            <span className="ml-1 text-[11px] text-blue-600">(none assigned yet)</span>
          )}
        </div>
      ) : null}

      {touristsQuery.error ? (
        <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Unable to load tourists.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {typeof reservationId !== "number" || reservationId <= 0 ? (
          <p className="text-xs text-slate-500">Save or select a reservation to manage tourists.</p>
        ) : touristsQuery.isLoading ? (
          <p className="text-xs text-slate-500">Loading tourists...</p>
        ) : !touristsQuery.data || touristsQuery.data.length === 0 ? (
          <p className="text-xs text-slate-500">No tourists added yet.</p>
        ) : displayedTourists.length === 0 ? (
          <p className="text-xs text-slate-500">No tourists are assigned to this room yet.</p>
        ) : (
          <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Name</th>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Passport</th>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Nationality</th>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Birth</th>
                <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {displayedTourists.map((tourist, index) => (
              <tr
                  key={tourist.id}
                  onClick={() => setSelectedTouristId(tourist.id)}
                  className={`cursor-pointer ${
                    activeSelectedTouristId === tourist.id
                      ? "bg-amber-200/80 hover:bg-amber-200"
                      : index % 2 === 0
                        ? "bg-white hover:bg-slate-50"
                        : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">
                    {tourist.first_name.trim()} {tourist.last_name.trim()}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                    {tourist.passport_number || "-"}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                    {tourist.nationality || "-"}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">
                    {toDateInputValue(tourist.birth_date) || "-"}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-slate-600">
                    {toDateInputValue(tourist.passport_expiry_date) || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h4 className="text-sm font-semibold text-slate-900">
                {editingTourist ? "Edit Tourist" : "Add Tourist"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTourist(null);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              {currentReservationId ? (
                <TouristForm
                  reservationId={currentReservationId}
                  tourist={editingTourist ?? undefined}
                  scope={scope}
                  onCancel={() => {
                    setIsModalOpen(false);
                    setEditingTourist(null);
                  }}
                  onSuccess={(savedTourist) => {
                    setIsModalOpen(false);
                    setToastMessage(editingTourist ? "Tourist updated successfully." : "Tourist added successfully.");
                    if (!editingTourist) {
                      onTouristAdded?.(savedTourist);
                    }
                    setEditingTourist(null);
                  }}
                />
              ) : (
                <p className="text-sm text-slate-500">Select or save a reservation first.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
