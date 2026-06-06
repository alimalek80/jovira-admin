"use client";

import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useCreateTourist, useUpdateTourist } from "@/hooks/use-tourists";
import type { Tourist } from "@/lib/api/tourists";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import {
  sanitizeTouristInput,
  touristAgeTypeOptions,
  touristSchema,
  touristSexOptions,
  type TouristFormValues,
} from "@/lib/validation/tourist";

const INITIAL_VALUES = (reservationId: number, tourist?: Tourist): TouristFormValues => ({
  reservation: reservationId,
  first_name: tourist?.first_name ?? "",
  last_name: tourist?.last_name ?? "",
  sex: tourist?.sex ?? "MALE",
  age_type: tourist?.age_type ?? "ADULT",
  passport_number: tourist?.passport_number ?? "",
  nationality: tourist?.nationality ?? "",
  birth_date: tourist?.birth_date ?? "",
  passport_expiry_date: tourist?.passport_expiry_date ?? "",
});

function fieldError(errors: FieldErrorMap, key: keyof TouristFormValues) {
  return errors[key] ?? "";
}

export default function TouristForm({
  reservationId,
  tourist,
  scope = "admin",
  onSuccess,
  onCancel,
}: {
  reservationId: number;
  tourist?: Tourist;
  scope?: "admin" | "client";
  onSuccess?: (tourist: Tourist) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<TouristFormValues>(() => INITIAL_VALUES(reservationId, tourist));
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");
  const isEditMode = Boolean(tourist?.id);

  const createMutation = useCreateTourist(scope, reservationId, {
    onSuccess: (savedTourist) => {
      setValues(INITIAL_VALUES(reservationId));
      setFieldErrors({});
      setFormError("");
      onSuccess?.(savedTourist);
    },
  });

  const updateMutation = useUpdateTourist(scope, reservationId, {
    onSuccess: (savedTourist) => {
      setFieldErrors({});
      setFormError("");
      onSuccess?.(savedTourist);
    },
  });

  const selectOptions = useMemo(
    () => ({
      sex: touristSexOptions,
      ageType: touristAgeTypeOptions,
    }),
    []
  );

  const handleChange = <K extends keyof TouristFormValues>(key: K, value: TouristFormValues[K]) => {
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
    setFormError("");
    setFieldErrors({});

    const result = touristSchema.safeParse(values);

    if (!result.success) {
      const nextErrors: FieldErrorMap = {};

      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      return;
    }

    try {
      const sanitized = sanitizeTouristInput(result.data);

      if (isEditMode && tourist?.id) {
        await updateMutation.mutateAsync({
          touristId: tourist.id,
          payload: sanitized,
        });
      } else {
        await createMutation.mutateAsync(sanitized);
      }
    } catch (error) {
      const responseBody = (error as AxiosError)?.response?.data;
      const mappedErrors = mapBackendValidationErrors(responseBody);

      if (Object.keys(mappedErrors).length > 0) {
        setFieldErrors(mappedErrors);
      } else {
        setFormError("Unable to save tourist.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="first_name" className="mb-1 block text-[11px] font-medium text-slate-600">
          First Name
        </label>
        <input
          id="first_name"
          value={values.first_name}
          onChange={(event) => handleChange("first_name", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "first_name") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.first_name}</p> : null}
      </div>

      <div>
        <label htmlFor="last_name" className="mb-1 block text-[11px] font-medium text-slate-600">
          Last Name
        </label>
        <input
          id="last_name"
          value={values.last_name}
          onChange={(event) => handleChange("last_name", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "last_name") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.last_name}</p> : null}
      </div>

      <div>
        <label htmlFor="sex" className="mb-1 block text-[11px] font-medium text-slate-600">
          Sex
        </label>
        <select
          id="sex"
          value={values.sex}
          onChange={(event) => handleChange("sex", event.target.value as TouristFormValues["sex"])}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          {selectOptions.sex.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {fieldError(fieldErrors, "sex") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.sex}</p> : null}
      </div>

      <div>
        <label htmlFor="age_type" className="mb-1 block text-[11px] font-medium text-slate-600">
          Age Type
        </label>
        <select
          id="age_type"
          value={values.age_type}
          onChange={(event) => handleChange("age_type", event.target.value as TouristFormValues["age_type"])}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          {selectOptions.ageType.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {fieldError(fieldErrors, "age_type") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.age_type}</p> : null}
      </div>

      <div>
        <label htmlFor="passport_number" className="mb-1 block text-[11px] font-medium text-slate-600">
          Passport Number
        </label>
        <input
          id="passport_number"
          value={values.passport_number}
          onChange={(event) => handleChange("passport_number", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "passport_number") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.passport_number}</p> : null}
      </div>

      <div>
        <label htmlFor="nationality" className="mb-1 block text-[11px] font-medium text-slate-600">
          Nationality
        </label>
        <input
          id="nationality"
          value={values.nationality}
          onChange={(event) => handleChange("nationality", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "nationality") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.nationality}</p> : null}
      </div>

      <div>
        <label htmlFor="birth_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Birth Date
        </label>
        <input
          id="birth_date"
          type="date"
          value={values.birth_date}
          onChange={(event) => handleChange("birth_date", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "birth_date") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.birth_date}</p> : null}
      </div>

      <div>
        <label htmlFor="passport_expiry_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Passport Expiry Date
        </label>
        <input
          id="passport_expiry_date"
          type="date"
          value={values.passport_expiry_date}
          onChange={(event) => handleChange("passport_expiry_date", event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        {fieldError(fieldErrors, "passport_expiry_date") ? (
          <p className="mt-1 text-[11px] text-red-600">{fieldErrors.passport_expiry_date}</p>
        ) : null}
      </div>

      {formError ? <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p> : null}

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
          disabled={createMutation.isPending || updateMutation.isPending}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : isEditMode
              ? "Save Changes"
              : "Save Tourist"}
        </button>
      </div>
    </form>
  );
}
