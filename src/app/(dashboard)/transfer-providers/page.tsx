"use client";

import { useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  createTransferProvider,
  deleteTransferProvider,
  listTransferProviders,
  updateTransferProvider,
  type ProviderType,
  type TransferProvider,
  type TransferProviderInput,
} from "@/lib/api/transfer-providers";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";

const PAGE_SIZE = 20;

const providerSchema = z.object({
  name: z.string().min(1, "Name is required."),
  provider_type: z.enum(["COMPANY", "INDIVIDUAL"]),
  contact_person: z.string(),
  phone: z.string(),
  email: z.string(),
  notes: z.string(),
});

type ProviderFormValues = z.infer<typeof providerSchema>;

const emptyForm = (): ProviderFormValues => ({
  name: "",
  provider_type: "COMPANY",
  contact_person: "",
  phone: "",
  email: "",
  notes: "",
});

function providerToForm(p: TransferProvider): ProviderFormValues {
  return {
    name: p.name,
    provider_type: p.provider_type,
    contact_person: p.contact_person,
    phone: p.phone,
    email: p.email,
    notes: p.notes,
  };
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
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
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

function ProviderForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: TransferProvider;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ProviderFormValues>(initial ? providerToForm(initial) : emptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: TransferProviderInput) => {
      if (initial?.id) return updateTransferProvider(initial.id, payload);
      return createTransferProvider(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfer-providers"] });
      onSuccess();
    },
  });

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  function set<K extends keyof ProviderFormValues>(key: K, value: ProviderFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    const validation = providerSchema.safeParse(values);
    if (!validation.success) {
      const errs: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    const d = validation.data;
    try {
      await mutation.mutateAsync({
        name: d.name,
        provider_type: d.provider_type,
        contact_person: d.contact_person || undefined,
        phone: d.phone || undefined,
        email: d.email || undefined,
        notes: d.notes || undefined,
      });
    } catch (error) {
      const mapped = mapBackendValidationErrors((error as AxiosError)?.response?.data);
      if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
      else setFormError("Unable to save provider.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="tp_name" className="mb-1 block text-[11px] font-medium text-slate-600">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="tp_name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputCls}
          placeholder="Provider name"
        />
        {fieldErrors.name ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="tp_type" className="mb-1 block text-[11px] font-medium text-slate-600">
          Provider Type <span className="text-red-500">*</span>
        </label>
        <select
          id="tp_type"
          value={values.provider_type}
          onChange={(e) => set("provider_type", e.target.value as ProviderType)}
          className={inputCls}
        >
          <option value="COMPANY">Company</option>
          <option value="INDIVIDUAL">Individual</option>
        </select>
        {fieldErrors.provider_type ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.provider_type}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="tp_contact" className="mb-1 block text-[11px] font-medium text-slate-600">
          Contact Person
        </label>
        <input
          id="tp_contact"
          value={values.contact_person}
          onChange={(e) => set("contact_person", e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="tp_phone" className="mb-1 block text-[11px] font-medium text-slate-600">
          Phone
        </label>
        <input
          id="tp_phone"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="tp_email" className="mb-1 block text-[11px] font-medium text-slate-600">
          Email
        </label>
        <input
          id="tp_email"
          type="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputCls}
        />
        {fieldErrors.email ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.email}</p> : null}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="tp_notes" className="mb-1 block text-[11px] font-medium text-slate-600">
          Notes
        </label>
        <textarea
          id="tp_notes"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className={inputCls}
        />
      </div>

      {formError ? <p className="sm:col-span-2 text-xs text-red-600">{formError}</p> : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-70"
        >
          {mutation.isPending ? "Saving..." : initial ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

export default function TransferProvidersPage() {
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<"" | ProviderType>("");
  const [page, setPage] = useState(1);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<TransferProvider | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  function showToast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(""), 2400);
  }

  const params = {
    page,
    page_size: PAGE_SIZE,
    ...(filterType ? { provider_type: filterType } : {}),
  };

  const query = useQuery({
    queryKey: ["transfer-providers", params],
    queryFn: () => listTransferProviders(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransferProvider(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfer-providers"] });
      showToast("Provider deleted.");
    },
    onError: () => showToast("Failed to delete provider."),
  });

  function handleDelete(p: TransferProvider) {
    if (!window.confirm(`Delete provider "${p.name}"?`)) return;
    void deleteMutation.mutateAsync(p.id);
  }

  const totalPages = query.data ? Math.ceil(query.data.count / PAGE_SIZE) : 1;
  const rows = query.data?.results ?? [];

  const inputCls =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Transfer Providers</h1>
          <p className="mt-0.5 text-xs text-slate-500">Companies and individual drivers for transfers</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#0f2347] bg-[#0f2347] px-4 text-xs font-semibold text-white hover:bg-[#0b1b38]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Provider
        </button>
      </div>

      {toastMsg ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMsg}
        </div>
      ) : null}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="filter_type" className="mb-1 block text-[11px] font-medium text-slate-600">
              Provider Type
            </label>
            <select
              id="filter_type"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as "" | ProviderType);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="">All</option>
              <option value="COMPANY">Company</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setFilterType("");
              setPage(1);
            }}
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Providers</span>
          <span className="text-xs text-slate-500">
            {query.data ? `${query.data.count} record${query.data.count !== 1 ? "s" : ""}` : ""}
          </span>
        </div>

        {query.isLoading ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">Loading…</p>
        ) : query.isError ? (
          <p className="px-4 py-8 text-center text-xs text-red-600">Failed to load providers.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">No providers found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Name</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Type</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Contact Person</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Phone</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Email</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${row.provider_type === "COMPANY" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {row.provider_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.contact_person || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.phone || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.email || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditProvider(row)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          className="rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {/* Add modal */}
      {isAddOpen ? (
        <ModalShell title="Add Transfer Provider" onClose={() => setIsAddOpen(false)}>
          <ProviderForm
            onSuccess={() => setIsAddOpen(false)}
            onCancel={() => setIsAddOpen(false)}
          />
        </ModalShell>
      ) : null}

      {/* Edit modal */}
      {editProvider ? (
        <ModalShell title="Edit Transfer Provider" onClose={() => setEditProvider(null)}>
          <ProviderForm
            initial={editProvider}
            onSuccess={() => setEditProvider(null)}
            onCancel={() => setEditProvider(null)}
          />
        </ModalShell>
      ) : null}
    </div>
  );
}
