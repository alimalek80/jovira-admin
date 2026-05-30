"use client";

import { useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ExcursionServiceForm from "@/components/reservations/ExcursionServiceForm";
import {
  deleteExcursionService,
  listExcursionServices,
  type ExcursionService,
  type ExcursionServiceListParams,
} from "@/lib/api/reservation-services";

const PAGE_SIZE = 20;

function toDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const trimmed = value.trim();
  if (!trimmed) return "-";
  return trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-medium text-slate-800">{value || "-"}</p>
    </div>
  );
}

function ExcursionServiceViewPanel({ service }: { service: ExcursionService }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <ViewField label="System Date" value={toDateLabel(service.systemDate)} />
      <ViewField label="Excursion Date" value={toDateLabel(service.excursionDate)} />
      <ViewField label="Excursion" value={service.excursionName} />
      <ViewField label="Combo" value={service.isCombo ? "Yes" : "No"} />
      <ViewField label="Pick Up Point" value={service.pickupPoint} />
      <ViewField
        label="Price"
        value={service.price ? `${service.price} ${service.sellingCurrencyCode}`.trim() : "-"}
      />
      <ViewField label="Selling Currency" value={service.sellingCurrencyCode} />
      <ViewField
        label="Cost"
        value={service.cost ? `${service.cost} ${service.costCurrencyCode}`.trim() : "-"}
      />
      <ViewField label="Cost Currency" value={service.costCurrencyCode} />
      <ViewField label="Cross Currency Rate" value={service.crossCurrencyRate} />
      <ViewField label="Paid" value={service.isPaid ? "Yes" : "No"} />
      <ViewField label="Confirm Booking #" value={service.confirmBookingNumber} />
      <ViewField label="Agent Confirmation #" value={service.agentConfirmationNumber} />
      <div className="sm:col-span-2">
        <ViewField label="Note" value={service.note} />
      </div>
    </div>
  );
}

export default function ExcursionServicesPage() {
  const queryClient = useQueryClient();

  // Filters
  const [filterDateAfter, setFilterDateAfter] = useState("");
  const [filterDateBefore, setFilterDateBefore] = useState("");
  const [filterPaid, setFilterPaid] = useState<"" | "true" | "false">("");
  const [filterCombo, setFilterCombo] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewService, setViewService] = useState<ExcursionService | null>(null);
  const [editService, setEditService] = useState<ExcursionService | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2400);
  };

  const params: ExcursionServiceListParams = {
    page,
    page_size: PAGE_SIZE,
    ...(filterDateAfter ? { excursion_date_after: filterDateAfter } : {}),
    ...(filterDateBefore ? { excursion_date_before: filterDateBefore } : {}),
    ...(filterPaid !== "" ? { is_paid: filterPaid === "true" } : {}),
    ...(filterCombo !== "" ? { is_combo: filterCombo === "true" } : {}),
  };

  const query = useQuery({
    queryKey: ["excursion-services", params],
    queryFn: () => listExcursionServices(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteExcursionService(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["excursion-services"] });
      showToast("Excursion service deleted.");
    },
    onError: (_error: unknown) => {
      showToast("Failed to delete excursion service.");
    },
  });

  const handleDelete = (service: ExcursionService) => {
    if (!window.confirm(`Delete excursion service for "${service.excursionName || "this record"}"?`)) return;
    void deleteMutation.mutateAsync(service.id);
  };

  const totalPages = query.data ? Math.ceil(query.data.count / PAGE_SIZE) : 1;
  const rows = query.data?.results ?? [];

  const applyFilters = () => {
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: ["excursion-services"] });
  };

  const clearFilters = () => {
    setFilterDateAfter("");
    setFilterDateBefore("");
    setFilterPaid("");
    setFilterCombo("");
    setPage(1);
  };

  const inputClass =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Excursion Services</h1>
          <p className="mt-0.5 text-xs text-slate-500">Standalone B2B excursion booking records</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#0f2347] bg-[#0f2347] px-4 text-xs font-semibold text-white hover:bg-[#0b1b38]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Excursion Service
        </button>
      </div>

      {toastMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filter_date_after" className="mb-1 block text-[11px] font-medium text-slate-600">
              Excursion Date From
            </label>
            <input
              id="filter_date_after"
              type="date"
              value={filterDateAfter}
              onChange={(e) => setFilterDateAfter(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="filter_date_before" className="mb-1 block text-[11px] font-medium text-slate-600">
              Excursion Date To
            </label>
            <input
              id="filter_date_before"
              type="date"
              value={filterDateBefore}
              onChange={(e) => setFilterDateBefore(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="filter_paid" className="mb-1 block text-[11px] font-medium text-slate-600">
              Paid
            </label>
            <select
              id="filter_paid"
              value={filterPaid}
              onChange={(e) => setFilterPaid(e.target.value as "" | "true" | "false")}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter_combo" className="mb-1 block text-[11px] font-medium text-slate-600">
              Combo
            </label>
            <select
              id="filter_combo"
              value={filterCombo}
              onChange={(e) => setFilterCombo(e.target.value as "" | "true" | "false")}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Filter
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Excursion Services
          </span>
          <span className="text-xs text-slate-500">
            {query.data ? `${query.data.count} record${query.data.count !== 1 ? "s" : ""}` : ""}
          </span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">System Date</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Excursion Date</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Excursion</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Combo</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Price</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Selling CCY</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Cost</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Cost CCY</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Paid</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Confirm #</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td className="px-3 py-5 text-xs text-slate-500" colSpan={11}>
                    Loading excursion services...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-xs text-slate-500" colSpan={11}>
                    No excursion services found.
                  </td>
                </tr>
              ) : (
                rows.map((service, index) => (
                  <tr
                    key={service.id}
                    className={index % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/70 hover:bg-slate-100/80"}
                  >
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {toDateLabel(service.systemDate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {toDateLabel(service.excursionDate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-800">
                      {service.excursionName || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {service.isCombo ? (
                        <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          Combo
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{service.price || "-"}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {service.sellingCurrencyCode || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{service.cost || "-"}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {service.costCurrencyCode || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      {service.isPaid ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Paid
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                      {service.confirmBookingNumber || "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewService(service)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditService(service)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(service)}
                          disabled={deleteMutation.isPending}
                          className="rounded border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Add Modal */}
      {isAddOpen ? (
        <ModalShell title="Add Excursion Service" onClose={() => setIsAddOpen(false)}>
          <ExcursionServiceForm
            onCancel={() => setIsAddOpen(false)}
            onSuccess={() => {
              setIsAddOpen(false);
              showToast("Excursion service created successfully.");
            }}
          />
        </ModalShell>
      ) : null}

      {/* View Modal */}
      {viewService ? (
        <ModalShell title="View Excursion Service" onClose={() => setViewService(null)}>
          <ExcursionServiceViewPanel service={viewService} />
        </ModalShell>
      ) : null}

      {/* Edit Modal */}
      {editService ? (
        <ModalShell title="Edit Excursion Service" onClose={() => setEditService(null)}>
          <ExcursionServiceForm
            key={`edit-${editService.id}`}
            service={editService}
            onCancel={() => setEditService(null)}
            onSuccess={() => {
              setEditService(null);
              showToast("Excursion service updated successfully.");
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
}
