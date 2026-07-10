"use client";

import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import { useTourists } from "@/hooks/use-tourists";
import {
  buildTransferServiceInput,
  createTransferService,
  type TransferService,
  updateTransferService,
} from "@/lib/api/reservation-services";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";

const locationTypeOptions = ["AIRPORT", "HOTEL", "CITY", "OTHER"] as const;

const transferServiceSchema = z.object({
  transfer_catalog: z.string(),
  service_name: z.string().min(1, "Service name is required."),
  service_date: z.string().min(1, "Service date is required."),
  on_arrival: z.boolean(),
  on_departure: z.boolean(),
  from_location_type: z.string().min(1, "From location type is required."),
  from_location_name: z.string().min(1, "From location name is required."),
  to_location_type: z.string().min(1, "To location type is required."),
  to_location_name: z.string().min(1, "To location name is required."),
  price: z.string().min(1, "Price is required."),
  currency: z.string().min(1, "Currency is required."),
  passengers: z.array(z.number()),
  external_note: z.string(),
  driver_note: z.string(),
});

type TransferServiceFormValues = z.infer<typeof transferServiceSchema>;

function fieldError(errors: FieldErrorMap, key: keyof TransferServiceFormValues) {
  return errors[key] ?? "";
}

type TransferServiceMode = "ALL" | "ARRIVAL" | "DEPARTURE";

export default function TransferServiceForm({
  reservationId,
  tourPackageId,
  currencyOptions,
  service,
  mode = "ALL",
  onSuccess,
  onCancel,
}: {
  reservationId: number;
  tourPackageId?: string;
  currencyOptions: Array<{ id: string; label: string }>;
  service?: TransferService;
  mode?: TransferServiceMode;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const touristsQuery = useTourists("admin", reservationId, { enabled: reservationId > 0 });
  const [values, setValues] = useState<TransferServiceFormValues>({
    transfer_catalog: service?.transferCatalogId ?? "",
    service_name: service?.serviceName ?? "",
    service_date: service?.serviceDate?.slice(0, 10) ?? "",
    on_arrival: service?.onArrival ?? mode === "ARRIVAL",
    on_departure: service?.onDeparture ?? mode === "DEPARTURE",
    from_location_type: service?.fromLocationType || "AIRPORT",
    from_location_name: service?.fromLocationName ?? "",
    to_location_type: service?.toLocationType || "HOTEL",
    to_location_name: service?.toLocationName ?? "",
    price: service?.price ?? "",
    currency: service?.currencyId || currencyOptions[0]?.id || "",
    passengers: service?.passengers ?? [],
    external_note: service?.externalNote ?? "",
    driver_note: service?.driverNote ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Catalog transfer options
  const catalogQuery = useQuery({
    queryKey: ["transfer-catalog", "admin"],
    queryFn: async () => {
      const res = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTransfers, { params: { page_size: 200 } });
      const data = res.data as Record<string, unknown>;
      const rows = Array.isArray(data.results) ? data.results : Array.isArray(res.data) ? res.data : [];
      return (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ""),
        label: `${String(r.from_location ?? "")} → ${String(r.to_location ?? "")}${
          r.name ? ` (${String(r.name)})` : ""
        }`,
      })).filter((o) => o.id.length > 0);
    },
  });
  const catalogOptions = catalogQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: TransferServiceFormValues) => {
      const requestPayload = buildTransferServiceInput({
        reservationId,
        tourPackageId,
        values: payload,
      });

      if (service?.id) {
        return updateTransferService("admin", service.id, requestPayload);
      }

      return createTransferService("admin", requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "transfer", reservationId] });
      onSuccess?.();
    },
  });

  const inputClassName = useMemo(
    () =>
      "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
    []
  );

  const update = <K extends keyof TransferServiceFormValues>(key: K, value: TransferServiceFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  async function handleCatalogChange(catalogId: string) {
    update("transfer_catalog", catalogId);
    if (!catalogId) return;

    try {
      setIsLoadingCatalog(true);
      const res = await axiosInstance.get(`${INVENTORY_ENDPOINTS.adminTransfers}${catalogId}/`);
      const d = res.data as Record<string, unknown>;

      const autoPrice = String(d.agency_price ?? d.public_price ?? "");
      const autoCurrency = d.currency != null ? String(d.currency) : "";

      setValues((prev) => ({
        ...prev,
        transfer_catalog: catalogId,
        service_name: prev.service_name || String(d.name ?? ""),
        from_location_name: prev.from_location_name || String(d.from_location ?? ""),
        to_location_name: prev.to_location_name || String(d.to_location ?? ""),
        price: prev.price || autoPrice,
        currency: prev.currency || autoCurrency,
      }));
    } catch {
      // best-effort prefill
    } finally {
      setIsLoadingCatalog(false);
    }
  }

  const togglePassenger = (touristId: number) => {
    setValues((previous) => ({
      ...previous,
      passengers: previous.passengers.includes(touristId)
        ? previous.passengers.filter((id) => id !== touristId)
        : [...previous.passengers, touristId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = transferServiceSchema.safeParse(values);
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
        setFormError("Unable to save transfer service.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-2.5 sm:grid-cols-2">
      {/* Catalog Transfer select — optional pre-fill */}
      <div className="sm:col-span-2">
        <label htmlFor="transfer_catalog" className="mb-1 block text-[11px] font-medium text-slate-600">
          Transfer (Catalog)
        </label>
        <div className="relative">
          <select
            id="transfer_catalog"
            value={values.transfer_catalog}
            onChange={(e) => { void handleCatalogChange(e.target.value); }}
            disabled={catalogQuery.isLoading || isLoadingCatalog}
            className={inputClassName}
          >
            <option value="">
              {catalogQuery.isLoading ? "Loading catalog…" : "None (manual entry)"}
            </option>
            {catalogOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {isLoadingCatalog ? (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">
              Loading…
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 italic">Selecting a catalog route pre-fills the fields below.</p>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="service_name" className="mb-1 block text-[11px] font-medium text-slate-600">Service Name</label>
        <input id="service_name" value={values.service_name} onChange={(event) => update("service_name", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "service_name") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.service_name}</p> : null}
      </div>

      <div>
        <label htmlFor="service_date" className="mb-1 block text-[11px] font-medium text-slate-600">Service Date</label>
        <input id="service_date" type="date" value={values.service_date} onChange={(event) => update("service_date", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "service_date") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.service_date}</p> : null}
      </div>

      <div>
        <label htmlFor="currency" className="mb-1 block text-[11px] font-medium text-slate-600">Currency</label>
        <select id="currency" value={values.currency} onChange={(event) => update("currency", event.target.value)} className={inputClassName}>
          <option value="">Select currency</option>
          {currencyOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        {fieldError(fieldErrors, "currency") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.currency}</p> : null}
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={values.on_arrival}
          disabled={mode === "ARRIVAL" || mode === "DEPARTURE"}
          onChange={(event) => update("on_arrival", event.target.checked)}
        />
        On Arrival
      </label>

      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={values.on_departure}
          disabled={mode === "ARRIVAL" || mode === "DEPARTURE"}
          onChange={(event) => update("on_departure", event.target.checked)}
        />
        On Departure
      </label>

      <div>
        <label htmlFor="from_location_type" className="mb-1 block text-[11px] font-medium text-slate-600">From Location Type</label>
        <select id="from_location_type" value={values.from_location_type} onChange={(event) => update("from_location_type", event.target.value)} className={inputClassName}>
          {locationTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="from_location_name" className="mb-1 block text-[11px] font-medium text-slate-600">From Location Name</label>
        <input id="from_location_name" value={values.from_location_name} onChange={(event) => update("from_location_name", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "from_location_name") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.from_location_name}</p> : null}
      </div>

      <div>
        <label htmlFor="to_location_type" className="mb-1 block text-[11px] font-medium text-slate-600">To Location Type</label>
        <select id="to_location_type" value={values.to_location_type} onChange={(event) => update("to_location_type", event.target.value)} className={inputClassName}>
          {locationTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="to_location_name" className="mb-1 block text-[11px] font-medium text-slate-600">To Location Name</label>
        <input id="to_location_name" value={values.to_location_name} onChange={(event) => update("to_location_name", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "to_location_name") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.to_location_name}</p> : null}
      </div>

      <div>
        <label htmlFor="price" className="mb-1 block text-[11px] font-medium text-slate-600">Price</label>
        <input id="price" value={values.price} onChange={(event) => update("price", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "price") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.price}</p> : null}
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-[11px] font-medium text-slate-600">Passengers</label>
        <div className="max-h-28 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
          {(touristsQuery.data ?? []).length === 0 ? (
            <p className="text-[11px] text-slate-500">No tourists available for this reservation.</p>
          ) : (
            (touristsQuery.data ?? []).map((tourist) => (
              <label key={tourist.id} className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={values.passengers.includes(tourist.id)} onChange={() => togglePassenger(tourist.id)} />
                {tourist.first_name} {tourist.last_name}
              </label>
            ))
          )}
        </div>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="external_note" className="mb-1 block text-[11px] font-medium text-slate-600">External Note</label>
        <textarea id="external_note" value={values.external_note} onChange={(event) => update("external_note", event.target.value)} className={`${inputClassName} min-h-16`} />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="driver_note" className="mb-1 block text-[11px] font-medium text-slate-600">Driver Note</label>
        <textarea id="driver_note" value={values.driver_note} onChange={(event) => update("driver_note", event.target.value)} className={`${inputClassName} min-h-16`} />
      </div>

      {formError ? <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p> : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        {onCancel ? <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancel</button> : null}
        <button type="submit" disabled={mutation.isPending} className="rounded-md border border-[#0f2347] bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60">
          {mutation.isPending ? "Saving..." : service ? "Update Transfer" : "Save Transfer"}
        </button>
      </div>
    </form>
  );
}