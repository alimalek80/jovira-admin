"use client";

import type { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useTourPackageFormOptions } from "@/hooks/use-tour-packages";
import { convertCurrencyAmount } from "@/lib/api/tour-packages";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import {
  toTourPackageFormValues,
  toTourPackagePayload,
  tourPackagePayloadSchema,
  type TourPackageFormValues,
  validateTourPackagePricing,
} from "@/lib/validation/tour-package";

function toOptionMap(options: Array<{ id: string; costPrice: number; currencyId: string }>) {
  return options.reduce<Record<string, { costPrice: number; currencyId: string }>>((accumulator, option) => {
    accumulator[option.id] = {
      costPrice: option.costPrice,
      currencyId: option.currencyId,
    };
    return accumulator;
  }, {});
}

function MultiSelectField({
  label,
  options,
  selected,
  onToggle,
  loading,
  error,
  emptyText,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  loading: boolean;
  error: boolean;
  emptyText: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-600">{label}</label>
      <div className="max-h-32 overflow-auto rounded-md border border-slate-300 bg-white p-2">
        {loading ? <p className="text-[11px] text-slate-500">Loading options...</p> : null}
        {!loading && error ? <p className="text-[11px] text-red-600">Unable to load options.</p> : null}
        {!loading && !error && options.length === 0 ? <p className="text-[11px] text-slate-500">{emptyText}</p> : null}
        {!loading && !error && options.length > 0
          ? options.map((option) => (
              <label key={option.id} className="mb-1 flex items-center gap-2 text-xs text-slate-700 last:mb-0">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => onToggle(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))
          : null}
      </div>
    </div>
  );
}

export default function TourPackageForm({
  initialValues,
  minimumCostFloor,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initialValues?: Partial<TourPackageFormValues>;
  minimumCostFloor?: string;
  onSubmit: (values: TourPackageFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const {
    flightsQuery,
    hotelsQuery,
    transfersQuery,
    excursionsQuery,
    currenciesQuery,
  } = useTourPackageFormOptions();

  const [values, setValues] = useState<TourPackageFormValues>(() => ({
    ...toTourPackageFormValues(),
    ...initialValues,
  }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");
  const [convertedSuggestedFloor, setConvertedSuggestedFloor] = useState(0);
  const [isConvertingFloor, setIsConvertingFloor] = useState(false);
  const [conversionError, setConversionError] = useState("");

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    setValues({
      ...toTourPackageFormValues(),
      ...initialValues,
    });
    setFieldErrors({});
    setFormError("");
  }, [initialValues]);

  useEffect(() => {
    if (values.currency || !currenciesQuery.data || currenciesQuery.data.length === 0) {
      return;
    }

    setValues((previous) => ({ ...previous, currency: currenciesQuery.data?.[0]?.id ?? "" }));
  }, [currenciesQuery.data, values.currency]);

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

  const toggleMulti = (key: "flights" | "hotels" | "transfers" | "excursions", id: string) => {
    setValues((previous) => {
      const selected = previous[key];
      const nextValues = selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id];

      return {
        ...previous,
        [key]: nextValues,
      };
    });

    setFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const floorValue = useMemo(() => {
    const parsed = Number.parseFloat(minimumCostFloor ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  }, [minimumCostFloor]);

  const componentMaps = useMemo(
    () => ({
      flights: toOptionMap(flightsQuery.data ?? []),
      hotels: toOptionMap(hotelsQuery.data ?? []),
      transfers: toOptionMap(transfersQuery.data ?? []),
      excursions: toOptionMap(excursionsQuery.data ?? []),
    }),
    [excursionsQuery.data, flightsQuery.data, hotelsQuery.data, transfersQuery.data]
  );

  const selectedNights = useMemo(() => {
    const parsed = Number.parseInt(values.nights, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }, [values.nights]);

  const currencyCodeById = useMemo(
    () =>
      (currenciesQuery.data ?? []).reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.code;
        return accumulator;
      }, {}),
    [currenciesQuery.data]
  );

  const sourceTotalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};

    const addItems = (
      ids: string[],
      source: Record<string, { costPrice: number; currencyId: string }>,
      multiplier = 1
    ) => {
      for (const id of ids) {
        const option = source[id];
        if (!option) {
          continue;
        }

        const currencyId = option.currencyId;
        if (!currencyId) {
          continue;
        }

        totals[currencyId] = (totals[currencyId] ?? 0) + option.costPrice * multiplier;
      }
    };

    addItems(values.flights, componentMaps.flights);
    addItems(values.transfers, componentMaps.transfers);
    addItems(values.excursions, componentMaps.excursions);
    addItems(values.hotels, componentMaps.hotels, Math.max(selectedNights, 1));

    return totals;
  }, [
    componentMaps.excursions,
    componentMaps.flights,
    componentMaps.hotels,
    componentMaps.transfers,
    selectedNights,
    values.excursions,
    values.flights,
    values.hotels,
    values.transfers,
  ]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!values.currency) {
        setConvertedSuggestedFloor(0);
        setConversionError("");
        setIsConvertingFloor(false);
        return;
      }

      const targetCode = currencyCodeById[values.currency];

      if (!targetCode) {
        setConvertedSuggestedFloor(0);
        setConversionError("");
        setIsConvertingFloor(false);
        return;
      }

      const entries = Object.entries(sourceTotalsByCurrency).filter(([, amount]) => Number.isFinite(amount) && amount > 0);

      if (entries.length === 0) {
        setConvertedSuggestedFloor(0);
        setConversionError("");
        setIsConvertingFloor(false);
        return;
      }

      setIsConvertingFloor(true);
      setConversionError("");

      try {
        let total = 0;

        const conversions = await Promise.all(
          entries.map(async ([sourceCurrencyId, amount]) => {
            const sourceCode = currencyCodeById[sourceCurrencyId];
            if (!sourceCode) {
              return 0;
            }

            if (sourceCode === targetCode) {
              return amount;
            }

            return convertCurrencyAmount({
              from: sourceCode,
              to: targetCode,
              amount,
            });
          })
        );

        for (const value of conversions) {
          total += value;
        }

        if (!cancelled) {
          setConvertedSuggestedFloor(Number.isFinite(total) ? total : 0);
        }
      } catch {
        if (!cancelled) {
          setConversionError("Unable to convert component prices with current exchange rates.");
          setConvertedSuggestedFloor(0);
        }
      } finally {
        if (!cancelled) {
          setIsConvertingFloor(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [currencyCodeById, sourceTotalsByCurrency, values.currency]);

  const effectiveFloorValue = useMemo(
    () => Math.max(floorValue, convertedSuggestedFloor),
    [convertedSuggestedFloor, floorValue]
  );

  const livePricingErrors = useMemo(
    () => validateTourPackagePricing(values, String(effectiveFloorValue)),
    [effectiveFloorValue, values]
  );

  const liveErrorMessages = useMemo(() => Object.values(livePricingErrors), [livePricingErrors]);

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

    if (Object.keys(livePricingErrors).length > 0) {
      setFieldErrors((previous) => ({ ...previous, ...livePricingErrors }));
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

      <div className="sm:col-span-2">
        <label htmlFor="currency" className="mb-1 block text-[11px] font-medium text-slate-600">Currency</label>
        <select
          id="currency"
          value={values.currency}
          onChange={(event) => update("currency", event.target.value)}
          disabled={currenciesQuery.isLoading}
          className={inputClassName}
        >
          <option value="">
            {currenciesQuery.isLoading ? "Loading currencies..." : "Select currency"}
          </option>
          {(currenciesQuery.data ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {!currenciesQuery.isLoading && currenciesQuery.isError ? (
          <p className="mt-1 text-[11px] text-red-600">Unable to load currencies.</p>
        ) : null}
        {!currenciesQuery.isLoading && !currenciesQuery.isError && (currenciesQuery.data?.length ?? 0) === 0 ? (
          <p className="mt-1 text-[11px] text-slate-500">No active currencies available.</p>
        ) : null}
        {fieldErrors.currency ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.currency}</p> : null}
      </div>

      <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-medium text-slate-700">
          This tour price cannot be less than minimum cost floor. The floor is cost-only (no profit).
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Suggested minimum cost floor: <span className="font-semibold text-slate-800">{effectiveFloorValue.toFixed(2)}</span>
        </p>
        {isConvertingFloor ? <p className="mt-1 text-[11px] text-slate-500">Converting component prices...</p> : null}
        {conversionError ? <p className="mt-1 text-[11px] font-medium text-amber-700">{conversionError}</p> : null}
      </div>

      <div>
        <label htmlFor="cost_price" className="mb-1 block text-[11px] font-medium text-slate-600">Cost Price</label>
        <input id="cost_price" value={values.cost_price} onChange={(e) => update("cost_price", e.target.value)} className={inputClassName} />
        {fieldErrors.cost_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cost_price}</p> : null}
      </div>

      <div>
        <label htmlFor="agency_price" className="mb-1 block text-[11px] font-medium text-slate-600">Agency Price</label>
        <input id="agency_price" value={values.agency_price} onChange={(e) => update("agency_price", e.target.value)} className={inputClassName} />
        {fieldErrors.agency_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.agency_price}</p> : null}
      </div>

      <div>
        <label htmlFor="public_price" className="mb-1 block text-[11px] font-medium text-slate-600">Public Price</label>
        <input id="public_price" value={values.public_price} onChange={(e) => update("public_price", e.target.value)} className={inputClassName} />
        {fieldErrors.public_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.public_price}</p> : null}
      </div>

      {liveErrorMessages.length > 0 ? (
        <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          {liveErrorMessages.map((message) => (
            <p key={message} className="text-[11px] font-medium text-red-700">{message}</p>
          ))}
        </div>
      ) : null}

      <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
        <MultiSelectField
          label="Flights (optional)"
          options={flightsQuery.data ?? []}
          selected={values.flights}
          onToggle={(id) => toggleMulti("flights", id)}
          loading={flightsQuery.isLoading}
          error={flightsQuery.isError}
          emptyText="No flights available."
        />
        <MultiSelectField
          label="Hotels (optional)"
          options={hotelsQuery.data ?? []}
          selected={values.hotels}
          onToggle={(id) => toggleMulti("hotels", id)}
          loading={hotelsQuery.isLoading}
          error={hotelsQuery.isError}
          emptyText="No hotels available."
        />
        <MultiSelectField
          label="Transfers (optional)"
          options={transfersQuery.data ?? []}
          selected={values.transfers}
          onToggle={(id) => toggleMulti("transfers", id)}
          loading={transfersQuery.isLoading}
          error={transfersQuery.isError}
          emptyText="No transfers available."
        />
        <MultiSelectField
          label="Excursions (optional)"
          options={excursionsQuery.data ?? []}
          selected={values.excursions}
          onToggle={(id) => toggleMulti("excursions", id)}
          loading={excursionsQuery.isLoading}
          error={excursionsQuery.isError}
          emptyText="No excursions available."
        />
      </div>

      {(fieldErrors.flights || fieldErrors.hotels || fieldErrors.transfers || fieldErrors.excursions) ? (
        <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          {fieldErrors.flights ? <p className="text-[11px] font-medium text-red-700">Flights: {fieldErrors.flights}</p> : null}
          {fieldErrors.hotels ? <p className="text-[11px] font-medium text-red-700">Hotels: {fieldErrors.hotels}</p> : null}
          {fieldErrors.transfers ? <p className="text-[11px] font-medium text-red-700">Transfers: {fieldErrors.transfers}</p> : null}
          {fieldErrors.excursions ? <p className="text-[11px] font-medium text-red-700">Excursions: {fieldErrors.excursions}</p> : null}
        </div>
      ) : null}

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
