"use client";

import { useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import {
  createTransferInventoryItem,
  deleteTransferInventoryItem,
  listTransferInventory,
  updateTransferInventoryItem,
  type TransferInventoryInput,
  type TransferInventoryItem,
  type TransferInventoryListParams,
} from "@/lib/api/transfers";
import { listTransferProviders } from "@/lib/api/transfer-providers";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";

const PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

type SelectOption = { id: string; label: string };

const transferSchema = z.object({
  provider: z.string().min(1, "Provider is required."),
  name: z.string().min(1, "Name is required."),
  name_en: z.string(),
  name_tr: z.string(),
  name_ru: z.string(),
  from_location: z.string().min(1, "From location is required."),
  from_location_en: z.string(),
  from_location_tr: z.string(),
  from_location_ru: z.string(),
  to_location: z.string().min(1, "To location is required."),
  to_location_en: z.string(),
  to_location_tr: z.string(),
  to_location_ru: z.string(),
  vehicle_type: z.string(),
  vehicle_type_en: z.string(),
  vehicle_type_tr: z.string(),
  vehicle_type_ru: z.string(),
  capacity: z.string(),
  currency: z.string(),
  public_price: z.string(),
  agency_price: z.string(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

const emptyForm = (): TransferFormValues => ({
  provider: "",
  name: "",
  name_en: "",
  name_tr: "",
  name_ru: "",
  from_location: "",
  from_location_en: "",
  from_location_tr: "",
  from_location_ru: "",
  to_location: "",
  to_location_en: "",
  to_location_tr: "",
  to_location_ru: "",
  vehicle_type: "",
  vehicle_type_en: "",
  vehicle_type_tr: "",
  vehicle_type_ru: "",
  capacity: "",
  currency: "",
  public_price: "",
  agency_price: "",
});

function itemToForm(item: TransferInventoryItem): TransferFormValues {
  return {
    provider: String(item.provider),
    name: item.name,
    name_en: item.name_en ?? "",
    name_tr: item.name_tr ?? "",
    name_ru: item.name_ru ?? "",
    from_location: item.from_location,
    from_location_en: item.from_location_en ?? "",
    from_location_tr: item.from_location_tr ?? "",
    from_location_ru: item.from_location_ru ?? "",
    to_location: item.to_location,
    to_location_en: item.to_location_en ?? "",
    to_location_tr: item.to_location_tr ?? "",
    to_location_ru: item.to_location_ru ?? "",
    vehicle_type: item.vehicle_type,
    vehicle_type_en: item.vehicle_type_en ?? "",
    vehicle_type_tr: item.vehicle_type_tr ?? "",
    vehicle_type_ru: item.vehicle_type_ru ?? "",
    capacity: item.capacity != null ? String(item.capacity) : "",
    currency: item.currency != null ? String(item.currency) : "",
    public_price: item.public_price ?? "",
    agency_price: item.agency_price ?? "",
  };
}

function formToPayload(values: TransferFormValues): TransferInventoryInput {
  function autofill(base: string, en: string, tr: string, ru: string) {
    return {
      base,
      en: en.trim() || base || null,
      tr: tr.trim() || base || null,
      ru: ru.trim() || base || null,
    };
  }
  const n = autofill(values.name, values.name_en, values.name_tr, values.name_ru);
  const f = autofill(values.from_location, values.from_location_en, values.from_location_tr, values.from_location_ru);
  const t = autofill(values.to_location, values.to_location_en, values.to_location_tr, values.to_location_ru);
  const v = autofill(values.vehicle_type, values.vehicle_type_en, values.vehicle_type_tr, values.vehicle_type_ru);

  return {
    provider: Number(values.provider),
    name: n.base,
    name_en: n.en,
    name_tr: n.tr,
    name_ru: n.ru,
    from_location: f.base,
    from_location_en: f.en,
    from_location_tr: f.tr,
    from_location_ru: f.ru,
    to_location: t.base,
    to_location_en: t.en,
    to_location_tr: t.tr,
    to_location_ru: t.ru,
    vehicle_type: v.base,
    vehicle_type_en: v.en,
    vehicle_type_tr: v.tr,
    vehicle_type_ru: v.ru,
    capacity: values.capacity ? Number(values.capacity) : null,
    currency: values.currency ? Number(values.currency) : null,
    public_price: values.public_price.trim() || null,
    agency_price: values.agency_price.trim() || null,
  };
}

function normalizeCurrencyOptions(payload: unknown): SelectOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];
  return (rows as Record<string, unknown>[])
    .filter((r) => r.is_active !== false)
    .map((r) => {
      const id = String(r.id ?? "");
      const code =
        (typeof r.code === "string" && r.code.trim().toUpperCase()) ||
        (typeof r.iso_code === "string" && r.iso_code.trim().toUpperCase()) ||
        id;
      const name =
        (typeof r.name_en === "string" && r.name_en) || (typeof r.name === "string" && r.name) || "";
      return { id, label: name ? `${code} - ${name}` : code };
    })
    .filter((o) => o.id.length > 0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Multi-language field group
function LangGroup({
  label,
  baseKey,
  values,
  set,
  inputCls,
  required,
  fieldErrors,
}: {
  label: string;
  baseKey: "name" | "from_location" | "to_location" | "vehicle_type";
  values: TransferFormValues;
  set: <K extends keyof TransferFormValues>(key: K, value: string) => void;
  inputCls: string;
  required?: boolean;
  fieldErrors: FieldErrorMap;
}) {
  const enKey = `${baseKey}_en` as keyof TransferFormValues;
  const trKey = `${baseKey}_tr` as keyof TransferFormValues;
  const ruKey = `${baseKey}_ru` as keyof TransferFormValues;
  return (
    <div className="sm:col-span-2 rounded-md border border-slate-200 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-700">
        {label}{required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">Default</label>
          <input
            value={String(values[baseKey])}
            onChange={(e) => set(baseKey, e.target.value)}
            className={inputCls}
            placeholder={`${label} (default)`}
          />
          {fieldErrors[baseKey] ? (
            <p className="mt-1 text-[11px] text-red-600">{fieldErrors[baseKey]}</p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">English (EN)</label>
          <input
            value={String(values[enKey])}
            onChange={(e) => set(enKey, e.target.value)}
            className={inputCls}
            placeholder={`${label} (EN)`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">Turkish (TR)</label>
          <input
            value={String(values[trKey])}
            onChange={(e) => set(trKey, e.target.value)}
            className={inputCls}
            placeholder={`${label} (TR)`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">Russian (RU)</label>
          <input
            value={String(values[ruKey])}
            onChange={(e) => set(ruKey, e.target.value)}
            className={inputCls}
            placeholder={`${label} (RU)`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function TransferForm({
  initial,
  providerOptions,
  currencyOptions,
  onSuccess,
  onCancel,
}: {
  initial?: TransferInventoryItem;
  providerOptions: SelectOption[];
  currencyOptions: SelectOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<TransferFormValues>(initial ? itemToForm(initial) : emptyForm());
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: TransferInventoryInput) => {
      if (initial?.id) return updateTransferInventoryItem(initial.id, payload);
      return createTransferInventoryItem(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfer-inventory"] });
      onSuccess();
    },
  });

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  function set<K extends keyof TransferFormValues>(key: K, value: string) {
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
    const validation = transferSchema.safeParse(values);
    if (!validation.success) {
      const errs: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    try {
      await mutation.mutateAsync(formToPayload(validation.data));
    } catch (error) {
      const mapped = mapBackendValidationErrors((error as AxiosError)?.response?.data);
      if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
      else setFormError("Unable to save transfer.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      {/* Provider */}
      <div className="sm:col-span-2">
        <label htmlFor="tr_provider" className="mb-1 block text-[11px] font-medium text-slate-600">
          Provider <span className="text-red-500">*</span>
        </label>
        <select
          id="tr_provider"
          value={values.provider}
          onChange={(e) => set("provider", e.target.value)}
          className={inputCls}
        >
          <option value="">Select provider…</option>
          {providerOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {fieldErrors.provider ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.provider}</p>
        ) : null}
      </div>

      {/* Multi-lang field groups */}
      <LangGroup label="Name" baseKey="name" values={values} set={set} inputCls={inputCls} required fieldErrors={fieldErrors} />
      <LangGroup label="From Location" baseKey="from_location" values={values} set={set} inputCls={inputCls} required fieldErrors={fieldErrors} />
      <LangGroup label="To Location" baseKey="to_location" values={values} set={set} inputCls={inputCls} required fieldErrors={fieldErrors} />
      <LangGroup label="Vehicle Type" baseKey="vehicle_type" values={values} set={set} inputCls={inputCls} fieldErrors={fieldErrors} />

      {/* Capacity */}
      <div>
        <label htmlFor="tr_capacity" className="mb-1 block text-[11px] font-medium text-slate-600">
          Capacity (passengers)
        </label>
        <input
          id="tr_capacity"
          type="number"
          min="1"
          step="1"
          value={values.capacity}
          onChange={(e) => set("capacity", e.target.value)}
          className={inputCls}
          placeholder="e.g. 8"
        />
      </div>

      {/* Currency */}
      <div>
        <label htmlFor="tr_currency" className="mb-1 block text-[11px] font-medium text-slate-600">
          Currency
        </label>
        <select
          id="tr_currency"
          value={values.currency}
          onChange={(e) => set("currency", e.target.value)}
          className={inputCls}
        >
          <option value="">Select currency…</option>
          {currencyOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Prices */}
      <div>
        <label htmlFor="tr_public_price" className="mb-1 block text-[11px] font-medium text-slate-600">
          Public Price
        </label>
        <input
          id="tr_public_price"
          type="number"
          step="0.01"
          min="0"
          value={values.public_price}
          onChange={(e) => set("public_price", e.target.value)}
          className={inputCls}
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="tr_agency_price" className="mb-1 block text-[11px] font-medium text-slate-600">
          Agency Price
        </label>
        <input
          id="tr_agency_price"
          type="number"
          step="0.01"
          min="0"
          value={values.agency_price}
          onChange={(e) => set("agency_price", e.target.value)}
          className={inputCls}
          placeholder="0.00"
        />
        <p className="mt-1 text-[11px] text-slate-500 italic">Shown to AGENCY &amp; STAFF users</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransfersPage() {
  const queryClient = useQueryClient();

  const [filterProvider, setFilterProvider] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [page, setPage] = useState(1);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<TransferInventoryItem | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  function showToast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(""), 2400);
  }

  // Providers for filter + form
  const providersQuery = useQuery({
    queryKey: ["transfer-providers", "all"],
    queryFn: () => listTransferProviders({ page_size: 200 }),
  });
  const providerOptions: SelectOption[] = (providersQuery.data?.results ?? []).map((p) => ({
    id: String(p.id),
    label: p.name,
  }));

  // Currencies for form
  const currenciesQuery = useQuery({
    queryKey: ["finance-currencies", "admin"],
    queryFn: async () => {
      const res = await axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies, {
        params: { is_active: true },
      });
      return normalizeCurrencyOptions(res.data);
    },
  });
  const currencyOptions = currenciesQuery.data ?? [];

  const params: TransferInventoryListParams = {
    page,
    page_size: PAGE_SIZE,
    ...(filterProvider ? { provider: filterProvider } : {}),
    ...(filterCurrency ? { currency: filterCurrency } : {}),
  };

  const query = useQuery({
    queryKey: ["transfer-inventory", params],
    queryFn: () => listTransferInventory(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTransferInventoryItem(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfer-inventory"] });
      showToast("Transfer deleted.");
    },
    onError: () => showToast("Failed to delete transfer."),
  });

  function handleDelete(item: TransferInventoryItem) {
    const label = `${item.from_location} → ${item.to_location}`;
    if (!window.confirm(`Delete transfer "${label}"?`)) return;
    void deleteMutation.mutateAsync(item.id);
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
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Transfers</h1>
          <p className="mt-0.5 text-xs text-slate-500">Transfer route catalog with pricing</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#0f2347] bg-[#0f2347] px-4 text-xs font-semibold text-white hover:bg-[#0b1b38]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Transfer
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
            <label htmlFor="fil_provider" className="mb-1 block text-[11px] font-medium text-slate-600">
              Provider
            </label>
            <select
              id="fil_provider"
              value={filterProvider}
              onChange={(e) => { setFilterProvider(e.target.value); setPage(1); }}
              className={inputCls}
            >
              <option value="">All providers</option>
              {providerOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fil_currency" className="mb-1 block text-[11px] font-medium text-slate-600">
              Currency
            </label>
            <select
              id="fil_currency"
              value={filterCurrency}
              onChange={(e) => { setFilterCurrency(e.target.value); setPage(1); }}
              className={inputCls}
            >
              <option value="">All currencies</option>
              {currencyOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => { setFilterProvider(""); setFilterCurrency(""); setPage(1); }}
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Transfers</span>
          <span className="text-xs text-slate-500">
            {query.data ? `${query.data.count} record${query.data.count !== 1 ? "s" : ""}` : ""}
          </span>
        </div>

        {query.isLoading ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">Loading…</p>
        ) : query.isError ? (
          <p className="px-4 py-8 text-center text-xs text-red-600">Failed to load transfers.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">No transfers found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Name</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Provider</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">From → To</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Vehicle</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Cap.</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">CCY</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Public Price</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Agency Price</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600">{row.providerName || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.from_location} <span className="text-slate-400">→</span> {row.to_location}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.vehicle_type || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{row.capacity ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{row.currencyCode || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.public_price ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.agency_price ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditItem(row)}
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
        <ModalShell title="Add Transfer" onClose={() => setIsAddOpen(false)}>
          <TransferForm
            providerOptions={providerOptions}
            currencyOptions={currencyOptions}
            onSuccess={() => setIsAddOpen(false)}
            onCancel={() => setIsAddOpen(false)}
          />
        </ModalShell>
      ) : null}

      {/* Edit modal */}
      {editItem ? (
        <ModalShell title="Edit Transfer" onClose={() => setEditItem(null)}>
          <TransferForm
            initial={editItem}
            providerOptions={providerOptions}
            currencyOptions={currencyOptions}
            onSuccess={() => setEditItem(null)}
            onCancel={() => setEditItem(null)}
          />
        </ModalShell>
      ) : null}
    </div>
  );
}
