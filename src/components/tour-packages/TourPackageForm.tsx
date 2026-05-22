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

  const inputClassName =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
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
