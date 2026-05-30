"use client";

import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import {
  createExcursionService,
  updateExcursionService,
  type ExcursionService,
} from "@/lib/api/reservation-services";

const excursionServiceSchema = z.object({
  excursion_date: z.string().min(1, "Excursion date is required."),
  is_paid: z.boolean(),
  excursion: z.string().min(1, "Excursion is required."),
  is_combo: z.boolean(),
  pickup_point: z.string(),
  price: z.string(),
  selling_currency: z.string(),
  cost: z.string().min(1, "Cost is required."),
  cost_currency: z.string().min(1, "Cost currency is required."),
  cross_currency_rate: z.string(),
  confirm_booking_number: z.string(),
  agent_confirmation_number: z.string(),
  note: z.string(),
});

type ExcursionServiceFormValues = z.infer<typeof excursionServiceSchema>;

function normalizeSelectOptions(payload: unknown): Array<{ id: string; label: string }> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((row) => {
      const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
      const label =
        (typeof row.name === "string" && row.name) ||
        (typeof row.title === "string" && row.title) ||
        (typeof row.name_en === "string" && row.name_en) ||
        id;
      return { id, label };
    })
    .filter((option) => option.id.length > 0);
}

function normalizeCurrencyOptions(payload: unknown): Array<{ id: string; label: string; code: string }> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
      const code =
        (typeof row.code === "string" && row.code.trim().toUpperCase()) ||
        (typeof row.iso_code === "string" && row.iso_code.trim().toUpperCase()) ||
        id;
      const name =
        (typeof row.name_en === "string" && row.name_en) ||
        (typeof row.name === "string" && row.name) ||
        "";
      const label = name ? `${code} - ${name}` : code;
      return { id, label, code };
    })
    .filter((option) => option.id.length > 0);
}

function fieldErr(errors: FieldErrorMap, key: keyof ExcursionServiceFormValues): string {
  return errors[key] ?? "";
}

export default function ExcursionServiceForm({
  service,
  onSuccess,
  onCancel,
}: {
  service?: ExcursionService;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();

  const [values, setValues] = useState<ExcursionServiceFormValues>({
    excursion_date: service?.excursionDate?.slice(0, 10) ?? "",
    is_paid: service?.isPaid ?? false,
    excursion: service?.excursionId ?? "",
    is_combo: service?.isCombo ?? false,
    pickup_point: service?.pickupPoint ?? "",
    price: service?.price ?? "0.00",
    selling_currency: service?.sellingCurrencyId ?? "",
    cost: service?.cost ?? "0.00",
    cost_currency: service?.costCurrencyId ?? "",
    cross_currency_rate: service?.crossCurrencyRate ?? "1.0000000000",
    confirm_booking_number: service?.confirmBookingNumber ?? "",
    agent_confirmation_number: service?.agentConfirmationNumber ?? "",
    note: service?.note ?? "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");
  const [isLoadingExcursionDetail, setIsLoadingExcursionDetail] = useState(false);

  const excursionsQuery = useQuery({
    queryKey: ["inventory-excursions", "admin"],
    queryFn: async () => {
      const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminExcursions);
      return normalizeSelectOptions(response.data);
    },
  });

  const currenciesQuery = useQuery({
    queryKey: ["finance-currencies", "admin"],
    queryFn: async () => {
      const response = await axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies, {
        params: { is_active: true },
      });
      return normalizeCurrencyOptions(response.data);
    },
  });

  const excursionOptions = excursionsQuery.data ?? [];
  const currencyOptions = currenciesQuery.data ?? [];

  const sellingCurrencyCode = useMemo(() => {
    if (!values.selling_currency) return "—";
    return currencyOptions.find((c) => c.id === values.selling_currency)?.code ?? values.selling_currency;
  }, [values.selling_currency, currencyOptions]);

  const mutation = useMutation({
    mutationFn: async (payload: ExcursionServiceFormValues) => {
      const requestPayload = {
        excursion_date: payload.excursion_date,
        is_paid: payload.is_paid,
        excursion: Number(payload.excursion),
        is_combo: payload.is_combo,
        pickup_point: payload.pickup_point || undefined,
        price: payload.price || "0.00",
        selling_currency: payload.selling_currency ? Number(payload.selling_currency) : undefined,
        cost: payload.cost,
        cost_currency: Number(payload.cost_currency),
        cross_currency_rate: payload.cross_currency_rate || "1.0000000000",
        confirm_booking_number: payload.confirm_booking_number || undefined,
        agent_confirmation_number: payload.agent_confirmation_number || undefined,
        note: payload.note || undefined,
      };

      if (service?.id) {
        return updateExcursionService(service.id, requestPayload);
      }

      return createExcursionService(requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["excursion-services"] });
      onSuccess?.();
    },
  });

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  function update<K extends keyof ExcursionServiceFormValues>(key: K, value: ExcursionServiceFormValues[K]) {
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      // Auto-sync selling_currency when cost_currency changes
      if (key === "cost_currency") {
        next.selling_currency = value as string;
      }
      return next;
    });
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleExcursionChange(excursionId: string) {
    update("excursion", excursionId);
    if (!excursionId) return;

    try {
      setIsLoadingExcursionDetail(true);
      const response = await axiosInstance.get(`${INVENTORY_ENDPOINTS.adminExcursions}${excursionId}/`);
      const d = response.data as Record<string, unknown>;
      const autoPrice = String(d.agency_price ?? d.public_price ?? "0.00");
      const autoCurrencyId = d.currency != null ? String(d.currency) : "";

      setValues((prev) => ({
        ...prev,
        excursion: excursionId,
        price: autoPrice,
        cost: autoPrice,
        cost_currency: autoCurrencyId,
        selling_currency: autoCurrencyId,
      }));
    } catch {
      // prefill is best-effort, silently ignore
    } finally {
      setIsLoadingExcursionDetail(false);
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = excursionServiceSchema.safeParse(values);
    if (!validation.success) {
      const nextErrors: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    try {
      await mutation.mutateAsync(validation.data);
    } catch (error) {
      const mapped = mapBackendValidationErrors((error as AxiosError)?.response?.data);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      } else {
        setFormError("Unable to save excursion service.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      {/* System Date — read-only, only visible when editing */}
      {service?.systemDate ? (
        <div className="sm:col-span-2">
          <p className="mb-0.5 text-[11px] font-medium text-slate-600">System Date</p>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            {service.systemDate}
          </p>
        </div>
      ) : null}

      {/* Row: Choose Date + Paid */}
      <div>
        <label htmlFor="excursion_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Choose Date <span className="text-red-500">*</span>
        </label>
        <input
          id="excursion_date"
          type="date"
          value={values.excursion_date}
          onChange={(e) => update("excursion_date", e.target.value)}
          className={inputCls}
        />
        {fieldErr(fieldErrors, "excursion_date") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.excursion_date}</p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={values.is_paid}
          onChange={(e) => update("is_paid", e.target.checked)}
        />
        Paid
      </label>

      {/* Row: Excursion select + Combo inline */}
      <div className="sm:col-span-2 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="excursion" className="mb-1 block text-[11px] font-medium text-slate-600">
            Excursion <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="excursion"
              value={values.excursion}
              onChange={(e) => { void handleExcursionChange(e.target.value); }}
              disabled={excursionsQuery.isLoading || isLoadingExcursionDetail}
              className={inputCls}
            >
              <option value="">
                {excursionsQuery.isLoading ? "Loading excursions..." : "Select excursion"}
              </option>
              {excursionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {isLoadingExcursionDetail ? (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">
                Loading…
              </span>
            ) : null}
          </div>
          {fieldErr(fieldErrors, "excursion") ? (
            <p className="mt-1 text-[11px] text-red-600">{fieldErrors.excursion}</p>
          ) : null}
        </div>

        <label className="flex shrink-0 items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={values.is_combo}
            onChange={(e) => update("is_combo", e.target.checked)}
          />
          Combo
        </label>
      </div>

      {/* Row: Pick Up Point — full width */}
      <div className="sm:col-span-2">
        <label htmlFor="pickup_point" className="mb-1 block text-[11px] font-medium text-slate-600">
          Pick Up Point
        </label>
        <input
          id="pickup_point"
          value={values.pickup_point}
          onChange={(e) => update("pickup_point", e.target.value)}
          placeholder="Hotel lobby, port gate…"
          className={inputCls}
        />
      </div>

      {/* Row: Price + Selling Currency (read-only) */}
      <div>
        <label htmlFor="price" className="mb-1 block text-[11px] font-medium text-slate-600">
          Price
        </label>
        <input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={values.price}
          onChange={(e) => update("price", e.target.value)}
          className={inputCls}
        />
        {fieldErr(fieldErrors, "price") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.price}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-slate-600">Selling Currency</p>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
          {sellingCurrencyCode}
        </p>
      </div>

      {/* Row: Cost + Cost Currency */}
      <div>
        <label htmlFor="cost" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost <span className="text-red-500">*</span>
        </label>
        <input
          id="cost"
          type="number"
          step="0.01"
          min="0"
          value={values.cost}
          onChange={(e) => update("cost", e.target.value)}
          className={inputCls}
        />
        {fieldErr(fieldErrors, "cost") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cost}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="cost_currency" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost Currency <span className="text-red-500">*</span>
        </label>
        <select
          id="cost_currency"
          value={values.cost_currency}
          onChange={(e) => update("cost_currency", e.target.value)}
          disabled={currenciesQuery.isLoading}
          className={inputCls}
        >
          <option value="">
            {currenciesQuery.isLoading ? "Loading currencies..." : "Select currency"}
          </option>
          {currencyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldErr(fieldErrors, "cost_currency") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cost_currency}</p>
        ) : null}
      </div>

      {/* Row: Cross Currency Rate — full width */}
      <div className="sm:col-span-2">
        <label htmlFor="cross_currency_rate" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cross Currency Rate
        </label>
        <input
          id="cross_currency_rate"
          type="number"
          step="0.0000000001"
          min="0"
          value={values.cross_currency_rate}
          onChange={(e) => update("cross_currency_rate", e.target.value)}
          className={inputCls}
        />
        {fieldErr(fieldErrors, "cross_currency_rate") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cross_currency_rate}</p>
        ) : null}
      </div>

      {/* Row: Confirm Booking # + Agent Confirmation # */}
      <div>
        <label htmlFor="confirm_booking_number" className="mb-1 block text-[11px] font-medium text-slate-600">
          Confirm Booking Number
        </label>
        <input
          id="confirm_booking_number"
          value={values.confirm_booking_number}
          onChange={(e) => update("confirm_booking_number", e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="agent_confirmation_number" className="mb-1 block text-[11px] font-medium text-slate-600">
          Agent Confirmation Number
        </label>
        <input
          id="agent_confirmation_number"
          value={values.agent_confirmation_number}
          onChange={(e) => update("agent_confirmation_number", e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Row: Note — full width */}
      <div className="sm:col-span-2">
        <label htmlFor="note" className="mb-1 block text-[11px] font-medium text-slate-600">
          Note
        </label>
        <textarea
          id="note"
          value={values.note}
          onChange={(e) => update("note", e.target.value)}
          rows={3}
          className={inputCls}
        />
      </div>

      {formError ? (
        <p className="sm:col-span-2 text-xs text-red-600">{formError}</p>
      ) : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={mutation.isPending || isLoadingExcursionDetail}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-70"
        >
          {mutation.isPending ? "Saving..." : service?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
