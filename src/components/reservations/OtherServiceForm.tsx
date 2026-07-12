"use client";

import { useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  createOtherService,
  updateOtherService,
  type OtherService,
} from "@/lib/api/reservation-services";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";

const schema = z.object({
  service_date: z.string().min(1, "Service date is required."),
  service_name: z.string().min(1, "Service name is required."),
  selling_currency: z.string(),
  cost_currency: z.string(),
  cross_currency_rate: z.string(),
  price: z.string(),
  cost: z.string(),
  is_paid: z.boolean(),
  note: z.string(),
});

type FormValues = z.infer<typeof schema>;

function emptyValues(): FormValues {
  return {
    service_date: "",
    service_name: "",
    selling_currency: "",
    cost_currency: "",
    cross_currency_rate: "1.0000000000",
    price: "",
    cost: "",
    is_paid: false,
    note: "",
  };
}

function serviceToValues(service: OtherService): FormValues {
  return {
    service_date: service.serviceDate?.slice(0, 10) ?? "",
    service_name: service.serviceName,
    selling_currency: service.sellingCurrencyId ?? "",
    cost_currency: service.costCurrencyId ?? "",
    cross_currency_rate: service.crossCurrencyRate ?? "1.0000000000",
    price: service.price ?? "",
    cost: service.cost ?? "",
    is_paid: service.isPaid,
    note: service.note ?? "",
  };
}

export default function OtherServiceForm({
  reservationId,
  currencyOptions,
  service,
  onSuccess,
  onCancel,
}: {
  reservationId: number;
  currencyOptions: Array<{ id: string; label: string }>;
  service?: OtherService;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(
    service ? serviceToValues(service) : emptyValues()
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const numOrNull = (v: string) => {
        const n = Number(v);
        return v.trim() && Number.isFinite(n) ? n : null;
      };

      const requestPayload = {
        reservation: reservationId,
        service_date: payload.service_date,
        service_name: payload.service_name,
        selling_currency: numOrNull(payload.selling_currency),
        cost_currency: numOrNull(payload.cost_currency),
        cross_currency_rate: payload.cross_currency_rate || "1.0000000000",
        price: payload.price.trim() || null,
        cost: payload.cost.trim() || null,
        is_paid: payload.is_paid,
        note: payload.note,
      };

      if (service?.id) {
        return updateOtherService(service.id, { ...requestPayload, reservation: reservationId });
      }
      return createOtherService(requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["reservation-service", "other", reservationId],
      });
      onSuccess?.();
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = schema.safeParse(values);
    if (!validation.success) {
      const nextErrors: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) nextErrors[key] = issue.message;
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
        setFormError("Unable to save other service.");
      }
    }
  };

  function SectionHeading({ title }: { title: string }) {
    return (
      <div className="sm:col-span-2 border-b border-slate-200 pb-1 mt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">

      <SectionHeading title="Service Info" />

      <div>
        <label htmlFor="service_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Service Date
        </label>
        <input
          id="service_date"
          type="date"
          value={values.service_date}
          onChange={(e) => update("service_date", e.target.value)}
          className={inputCls}
        />
        {fieldErrors.service_date ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.service_date}</p>
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

      <div className="sm:col-span-2">
        <label htmlFor="service_name" className="mb-1 block text-[11px] font-medium text-slate-600">
          Service Name
        </label>
        <input
          id="service_name"
          type="text"
          value={values.service_name}
          onChange={(e) => update("service_name", e.target.value)}
          className={inputCls}
          placeholder="e.g. Visa, Restaurant, Gift, UFC ticket"
        />
        {fieldErrors.service_name ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.service_name}</p>
        ) : null}
      </div>

      <SectionHeading title="Financials" />

      <div>
        <label htmlFor="selling_currency" className="mb-1 block text-[11px] font-medium text-slate-600">
          Selling Currency
        </label>
        <select
          id="selling_currency"
          value={values.selling_currency}
          onChange={(e) => update("selling_currency", e.target.value)}
          className={inputCls}
        >
          <option value="">Select currency</option>
          {currencyOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="price" className="mb-1 block text-[11px] font-medium text-slate-600">
          Price
        </label>
        <input
          id="price"
          type="number"
          min="0"
          step="0.01"
          value={values.price}
          onChange={(e) => update("price", e.target.value)}
          className={inputCls}
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="cost_currency" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost Currency
        </label>
        <select
          id="cost_currency"
          value={values.cost_currency}
          onChange={(e) => update("cost_currency", e.target.value)}
          className={inputCls}
        >
          <option value="">Select currency</option>
          {currencyOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
        <label htmlFor="cost" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost{" "}
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
            Internal
          </span>
        </label>
        <input
          id="cost"
          type="number"
          min="0"
          step="0.01"
          value={values.cost}
          onChange={(e) => update("cost", e.target.value)}
          className={inputCls}
          placeholder="0.00"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="cross_currency_rate" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cross-Currency Rate
        </label>
        <input
          id="cross_currency_rate"
          type="number"
          min="0"
          step="0.0000000001"
          value={values.cross_currency_rate}
          onChange={(e) => update("cross_currency_rate", e.target.value)}
          className={inputCls}
          placeholder="1.0000000000"
        />
      </div>

      <SectionHeading title="Notes" />

      <div className="sm:col-span-2">
        <label htmlFor="note" className="mb-1 block text-[11px] font-medium text-slate-600">Note</label>
        <textarea
          id="note"
          rows={3}
          value={values.note}
          onChange={(e) => update("note", e.target.value)}
          className={inputCls}
          placeholder="Additional details about this service"
        />
      </div>

      {formError ? (
        <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p>
      ) : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md border border-[#0f2347] bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Saving..." : service ? "Update Service" : "Save Service"}
        </button>
      </div>
    </form>
  );
}