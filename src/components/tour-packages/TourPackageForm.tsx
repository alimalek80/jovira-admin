"use client";

import type { AxiosError } from "axios";
import { useState } from "react";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import {
  toTourPackageFormValues,
  toTourPackagePayload,
  tourPackagePayloadSchema,
  type TourPackageFormValues,
} from "@/lib/validation/tour-package";

export default function TourPackageForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initialValues?: Partial<TourPackageFormValues>;
  onSubmit: (values: TourPackageFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [values, setValues] = useState<TourPackageFormValues>(() => ({
    ...toTourPackageFormValues(),
    ...initialValues,
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  const update = <K extends keyof TourPackageFormValues>(key: K, value: TourPackageFormValues[K]) => {
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const payload = toTourPackagePayload(values);
    const validation = tourPackagePayloadSchema.safeParse(payload);

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

    // cost_price cross-field validation
    const costStr = values.cost_price.trim();
    if (costStr) {
      const cost = parseFloat(costStr);
      if (!Number.isNaN(cost)) {
        if (cost < 0) {
          setFieldErrors({ cost_price: "Cost price cannot be negative." });
          return;
        }
        const pub = parseFloat(values.public_price.trim());
        if (!Number.isNaN(pub) && pub > 0 && cost >= pub) {
          setFieldErrors({ cost_price: "Cost price must be lower than the public price to ensure a positive margin." });
          return;
        }
        const agency = parseFloat(values.agency_price.trim());
        if (!Number.isNaN(agency) && agency > 0 && cost >= agency) {
          setFieldErrors({ cost_price: "Cost price must be lower than the agency price to ensure a positive margin." });
          return;
        }
      }
    }

    try {
      await onSubmit(values);
    } catch (error) {
      const responseBody = (error as AxiosError)?.response?.data;
      const mapped = mapBackendValidationErrors(responseBody);

      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      } else {
        setFormError("Unable to save tour package.");
      }
    }
  };

  // Margin display — computed when cost_price + at least one price are set
  const costNum = parseFloat(values.cost_price);
  const pubNum = parseFloat(values.public_price);
  const agencyNum = parseFloat(values.agency_price);
  const marginItems: { label: string; margin: number }[] = [];
  if (!Number.isNaN(costNum) && !Number.isNaN(pubNum) && pubNum > 0)
    marginItems.push({ label: "Public", margin: pubNum - costNum });
  if (!Number.isNaN(costNum) && !Number.isNaN(agencyNum) && agencyNum > 0)
    marginItems.push({ label: "Agency", margin: agencyNum - costNum });

  const inputClassName =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      {/* Margin preview — top row */}
      {marginItems.length > 0 ? (
        <div className="sm:col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
          <span className="font-semibold text-slate-500">Margin Preview</span>
          {marginItems.map(({ label, margin }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="text-slate-400">{label}:</span>
              <span className={margin > 0 ? "font-semibold text-emerald-700" : margin < 0 ? "font-semibold text-red-600" : "text-slate-500"}>
                {margin.toFixed(2)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-[11px] font-medium text-slate-600">Name</label>
        <input id="name" value={values.name} onChange={(e) => update("name", e.target.value)} className={inputClassName} />
        {fieldErrors.name ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="destination" className="mb-1 block text-[11px] font-medium text-slate-600">Destination</label>
        <input id="destination" value={values.destination} onChange={(e) => update("destination", e.target.value)} className={inputClassName} />
        {fieldErrors.destination ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.destination}</p> : null}
      </div>

      <div>
        <label htmlFor="days" className="mb-1 block text-[11px] font-medium text-slate-600">Duration (days)</label>
        <input id="days" type="number" min="1" step="1" value={values.days} onChange={(e) => update("days", e.target.value)} className={inputClassName} />
        {fieldErrors.days ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.days}</p> : null}
      </div>

      <div>
        <label htmlFor="nights" className="mb-1 block text-[11px] font-medium text-slate-600">Nights</label>
        <input id="nights" type="number" min="0" step="1" value={values.nights} onChange={(e) => update("nights", e.target.value)} className={inputClassName} placeholder="Auto: days - 1" />
        {fieldErrors.nights ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.nights}</p> : null}
      </div>

      <div>
        <label htmlFor="public_price" className="mb-1 block text-[11px] font-medium text-slate-600">Public Price</label>
        <input id="public_price" value={values.public_price} onChange={(e) => update("public_price", e.target.value)} className={inputClassName} />
        {fieldErrors.public_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.public_price}</p> : null}
      </div>

      <div>
        <label htmlFor="agency_price" className="mb-1 block text-[11px] font-medium text-slate-600">Agency Price</label>
        <input id="agency_price" value={values.agency_price} onChange={(e) => update("agency_price", e.target.value)} className={inputClassName} />
        {fieldErrors.agency_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.agency_price}</p> : null}
      </div>

      {/* Cost Price — Internal only */}
      <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50/50 p-2">
        <label htmlFor="cost_price" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost Price (Internal)
          <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
            🔒 Internal
          </span>
        </label>
        <input
          id="cost_price"
          type="number"
          step="0.01"
          min="0"
          value={values.cost_price}
          onChange={(e) => update("cost_price", e.target.value)}
          className={inputClassName}
          placeholder="0.00"
        />
        {fieldErrors.cost_price ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cost_price}</p>
        ) : null}
        <p className="mt-1 text-[11px] italic text-amber-700">
          Internal supplier cost paid by Jovira. Used for profit margin calculation. Never shown to agencies or clients.
        </p>
      </div>

      <div>
        <label htmlFor="name_en" className="mb-1 block text-[11px] font-medium text-slate-600">Name [en]</label>
        <input id="name_en" value={values.name_en} onChange={(e) => update("name_en", e.target.value)} className={inputClassName} />
      </div>

      <div>
        <label htmlFor="name_tr" className="mb-1 block text-[11px] font-medium text-slate-600">Name [tr]</label>
        <input id="name_tr" value={values.name_tr} onChange={(e) => update("name_tr", e.target.value)} className={inputClassName} />
      </div>

      <div>
        <label htmlFor="name_ru" className="mb-1 block text-[11px] font-medium text-slate-600">Name [ru]</label>
        <input id="name_ru" value={values.name_ru} onChange={(e) => update("name_ru", e.target.value)} className={inputClassName} />
      </div>

      <div>
        <label htmlFor="destination_en" className="mb-1 block text-[11px] font-medium text-slate-600">Destination [en]</label>
        <input id="destination_en" value={values.destination_en} onChange={(e) => update("destination_en", e.target.value)} className={inputClassName} />
      </div>

      <div>
        <label htmlFor="destination_tr" className="mb-1 block text-[11px] font-medium text-slate-600">Destination [tr]</label>
        <input id="destination_tr" value={values.destination_tr} onChange={(e) => update("destination_tr", e.target.value)} className={inputClassName} />
      </div>

      <div>
        <label htmlFor="destination_ru" className="mb-1 block text-[11px] font-medium text-slate-600">Destination [ru]</label>
        <input id="destination_ru" value={values.destination_ru} onChange={(e) => update("destination_ru", e.target.value)} className={inputClassName} />
      </div>

      {formError ? <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p> : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
