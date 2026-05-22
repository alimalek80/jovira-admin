"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS } from "@/lib/api-endpoints";

type InventoryItem = {
  id: number | string;
  [key: string]: unknown;
};

type FormFieldType = "text" | "number" | "date" | "datetime-local" | "textarea" | "select";

type SelectOption = {
  label: string;
  value: string;
  code?: string;
};

type SelectSource = "currencies";

type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  step?: string;
  options?: SelectOption[];
  source?: SelectSource;
};

type TableField = {
  key: string;
  label: string;
};

export type InventoryPageConfig = {
  title: string;
  description: string;
  endpoint: string;
  tableFields: TableField[];
  formFields: FormField[];
};

const columnHelper = createColumnHelper<InventoryItem>();

type ExchangeRateRecord = {
  base: string;
  target: string;
  rate: number;
};

type CityTranslations = {
  city_en: string;
  city_tr: string;
  city_ru: string;
};

type FlightLocationTranslations = {
  origin_en: string;
  origin_tr: string;
  origin_ru: string;
  destination_en: string;
  destination_tr: string;
  destination_ru: string;
};

const EMPTY_CITY_TRANSLATIONS: CityTranslations = {
  city_en: "",
  city_tr: "",
  city_ru: "",
};

const EMPTY_FLIGHT_LOCATION_TRANSLATIONS: FlightLocationTranslations = {
  origin_en: "",
  origin_tr: "",
  origin_ru: "",
  destination_en: "",
  destination_tr: "",
  destination_ru: "",
};

function normalizeGenericList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: unknown[] }).results.filter(
      (item) => item && typeof item === "object"
    ) as Record<string, unknown>[];
  }

  return [];
}

function normalizeCurrencyOptions(payload: unknown): SelectOption[] {
  const rows = normalizeGenericList(payload);
  const optionsMap = new Map<string, SelectOption>();

  for (const row of rows) {
    const code =
      (row.code as string | undefined) ??
      (row.currency as string | undefined) ??
      (row.currency_code as string | undefined) ??
      (row.iso_code as string | undefined);

    if (!code || typeof code !== "string") {
      continue;
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      continue;
    }

    // Prefer name_en (actual API field), then name, then other fallbacks
    const name =
      (row.name_en as string | undefined) ??
      (row.name as string | undefined) ??
      (row.currency_name as string | undefined) ??
      (row.title as string | undefined);

    const symbol = row.symbol as string | undefined;

    const labelSuffix = name && typeof name === "string" ? name : undefined;
    const symbolPart = symbol && typeof symbol === "string" ? ` (${symbol})` : "";
    const currencyId =
      typeof row.id === "number" || typeof row.id === "string" ? String(row.id).trim() : "";

    optionsMap.set(normalizedCode, {
      value: currencyId || normalizedCode,
      code: normalizedCode,
      label: labelSuffix ? `${normalizedCode} - ${labelSuffix}${symbolPart}` : normalizedCode,
    });
  }

  return [...optionsMap.values()].sort((a, b) => (a.code ?? a.value).localeCompare(b.code ?? b.value));
}

function normalizeExchangeRates(payload: unknown): ExchangeRateRecord[] {
  const rows = normalizeGenericList(payload);

  return rows
    .map((row) => {
      const base =
        (row.base_currency as string | undefined) ??
        (row.from_currency as string | undefined) ??
        (row.source_currency as string | undefined) ??
        (row.base as string | undefined);

      const target =
        (row.quote_currency as string | undefined) ??
        (row.to_currency as string | undefined) ??
        (row.target_currency as string | undefined) ??
        (row.target as string | undefined);

      const rateRaw =
        row.rate ?? row.exchange_rate ?? row.conversion_rate ?? row.value ?? row.multiplier;

      const rate = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);

      if (!base || !target || Number.isNaN(rate)) {
        return null;
      }

      return {
        base: base.trim().toUpperCase(),
        target: target.trim().toUpperCase(),
        rate,
      };
    })
    .filter((entry): entry is ExchangeRateRecord => entry !== null);
}

async function fetchFirstWorkingPayload(urls: string[]) {
  for (const url of urls) {
    try {
      const response = await axiosInstance.get(url);
      // If the endpoint returned 200 but an empty list, fall through to the next candidate
      const list = normalizeGenericList(response.data);
      if (list.length === 0) {
        continue;
      }
      return response.data;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeListPayload(payload: unknown): InventoryItem[] {
  if (Array.isArray(payload)) {
    return payload as InventoryItem[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: InventoryItem[] }).results;
  }

  return [];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const dictionary = value as Record<string, unknown>;

    if (typeof dictionary.en === "string") {
      return dictionary.en;
    }

    const firstPrimitive = Object.values(dictionary).find(
      (entry) => typeof entry === "string" || typeof entry === "number"
    );

    if (firstPrimitive !== undefined) {
      return String(firstPrimitive);
    }

    return JSON.stringify(value);
  }

  return "-";
}

function formatCurrencyValue(value: unknown, options: SelectOption[]): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return "-";
  }

  const byId = options.find((option) => option.value === normalized);
  if (byId) {
    return byId.label;
  }

  const byCode = options.find((option) => option.code === normalized.toUpperCase());
  if (byCode) {
    return byCode.label;
  }

  return normalized;
}

function toDateInputValue(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  // Accept full ISO or datetime strings and keep YYYY-MM-DD for date inputs.
  if (trimmed.includes("T") || trimmed.includes(" ")) {
    const normalized = trimmed.replace(" ", "T");
    return normalized.slice(0, 10);
  }

  return trimmed.slice(0, 10);
}

function toDatetimeLocalInputValue(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  // datetime-local expects YYYY-MM-DDTHH:MM (optionally :SS)
  // Backend may send "YYYY-MM-DD HH:MM:SS" or full ISO with timezone.
  const normalized = trimmed.replace(" ", "T");

  if (normalized.length >= 16 && normalized.includes("T")) {
    return normalized.slice(0, 16);
  }

  return normalized;
}

function toFormState(row: InventoryItem | null, fields: FormField[]) {
  return fields.reduce<Record<string, string>>((accumulator, field) => {
    const value = row?.[field.key];

    if (value === null || value === undefined) {
      accumulator[field.key] = "";
      return accumulator;
    }

    const normalizedValue = typeof value === "object" ? formatValue(value) : String(value);

    if (field.type === "date") {
      accumulator[field.key] = toDateInputValue(normalizedValue);
      return accumulator;
    }

    if (field.type === "datetime-local") {
      accumulator[field.key] = toDatetimeLocalInputValue(normalizedValue);
      return accumulator;
    }

    accumulator[field.key] = normalizedValue;
    return accumulator;
  }, {});
}

function toPayload(formState: Record<string, string>, fields: FormField[]) {
  const payload: Record<string, string | number> = {};

  for (const field of fields) {
    const rawValue = formState[field.key]?.trim() ?? "";

    if (rawValue === "") {
      continue;
    }

    if (field.type === "number") {
      const numberValue = Number(rawValue);
      payload[field.key] = Number.isNaN(numberValue) ? 0 : numberValue;
      continue;
    }

    if (field.type === "datetime-local") {
      // HTML datetime-local gives "YYYY-MM-DDTHH:MM" — Django requires seconds
      payload[field.key] = rawValue.length === 16 ? `${rawValue}:00` : rawValue;
      continue;
    }

    if (field.key === "currency") {
      const numberValue = Number(rawValue);
      payload[field.key] = Number.isNaN(numberValue) ? rawValue : numberValue;
      continue;
    }

    payload[field.key] = rawValue;
  }

  return payload;
}

function enrichLocationTranslations(
  endpoint: string,
  payload: Record<string, string | number>
): Record<string, string | number> {
  const isHotelEndpoint = endpoint.includes("/inventory/admin/hotels/");
  const isFlightEndpoint = endpoint.includes("/inventory/admin/flights/");

  if (!isHotelEndpoint && !isFlightEndpoint) {
    return payload;
  }

  const nextPayload: Record<string, string | number> = { ...payload };

  const sourcePairs: Array<[string, string[]]> = isHotelEndpoint
    ? [
        ["name", ["name_en", "name_tr", "name_ru"]],
        ["city", ["city_en", "city_tr", "city_ru"]],
      ]
    : [
        ["origin", ["origin_en", "origin_tr", "origin_ru"]],
        ["destination", ["destination_en", "destination_tr", "destination_ru"]],
      ];

  for (const [sourceKey, targetKeys] of sourcePairs) {
    const value = typeof nextPayload[sourceKey] === "string" ? nextPayload[sourceKey].trim() : "";

    if (!value) {
      continue;
    }

    for (const targetKey of targetKeys) {
      const existingValue =
        typeof nextPayload[targetKey] === "string" ? nextPayload[targetKey].trim() : "";

      if (existingValue) {
        continue;
      }

      nextPayload[targetKey] = value;
    }
  }

  return nextPayload;
}

function endpointById(endpoint: string, id: number | string) {
  return `${endpoint}${id}/`;
}

export default function InventoryManagementPage({ config }: { config: InventoryPageConfig }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string>>(() =>
    toFormState(null, config.formFields)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<SelectOption[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateRecord[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState("");
  const [showHotelCityTranslations, setShowHotelCityTranslations] = useState(false);
  const [hotelCityTranslations, setHotelCityTranslations] =
    useState<CityTranslations>(EMPTY_CITY_TRANSLATIONS);
  const [showFlightLocationTranslations, setShowFlightLocationTranslations] = useState(false);
  const [flightLocationTranslations, setFlightLocationTranslations] =
    useState<FlightLocationTranslations>(EMPTY_FLIGHT_LOCATION_TRANSLATIONS);

  const isHotelEndpoint = useMemo(
    () => config.endpoint.includes("/inventory/admin/hotels/"),
    [config.endpoint]
  );
  const isFlightEndpoint = useMemo(
    () => config.endpoint.includes("/inventory/admin/flights/"),
    [config.endpoint]
  );

  const hasCurrencySourceField = useMemo(
    () => config.formFields.some((field) => field.source === "currencies"),
    [config.formFields]
  );

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.get(config.endpoint);
      setItems(normalizeListPayload(response.data));
    } catch {
      setError(`Unable to load ${config.title.toLowerCase()}.`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.title]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!hasCurrencySourceField) {
      return;
    }

    const fetchCurrencyMetadata = async () => {
      setCurrenciesLoading(true);
      setCurrencyError("");

      try {
        // Currencies are fetched via the internal Next.js proxy (/api/finance/currencies/)
        // so the request is server-to-server — no browser CORS restrictions.
        const [currenciesResponse, ratesPayload] = await Promise.all([
          fetch("/api/finance/currencies/").then((r) => r.json() as Promise<unknown>).catch(() => null),
          fetchFirstWorkingPayload([FINANCE_ENDPOINTS.adminExchangeRates]),
        ]);

        const resolvedCurrencyOptions = normalizeCurrencyOptions(currenciesResponse);
        setCurrencyOptions(resolvedCurrencyOptions);

        if (ratesPayload) {
          setExchangeRates(normalizeExchangeRates(ratesPayload));
        } else {
          setExchangeRates([]);
        }

        if (resolvedCurrencyOptions.length === 0) {
          setCurrencyError("No currencies returned. Check /api/finance/currencies/.");
        }
      } finally {
        setCurrenciesLoading(false);
      }
    };

    void fetchCurrencyMetadata();
  }, [hasCurrencySourceField]);

  useEffect(() => {
    if (!hasCurrencySourceField || currencyOptions.length === 0) {
      return;
    }

    setFormState((previous) => {
      if (previous.currency && previous.currency.trim().length > 0) {
        return previous;
      }

      return { ...previous, currency: currencyOptions[0].value };
    });
  }, [currencyOptions, hasCurrencySourceField]);

  const resetModal = () => {
    setEditingItem(null);
    setShowHotelCityTranslations(false);
    setHotelCityTranslations(EMPTY_CITY_TRANSLATIONS);
    setShowFlightLocationTranslations(false);
    setFlightLocationTranslations(EMPTY_FLIGHT_LOCATION_TRANSLATIONS);
    setFormState((previous) => {
      const nextState = toFormState(null, config.formFields);

      if (!hasCurrencySourceField || currencyOptions.length === 0) {
        return nextState;
      }

      return {
        ...nextState,
        currency: previous.currency?.trim() ? previous.currency : currencyOptions[0].value,
      };
    });
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setShowHotelCityTranslations(false);
    setHotelCityTranslations(EMPTY_CITY_TRANSLATIONS);
    setShowFlightLocationTranslations(false);
    setFlightLocationTranslations(EMPTY_FLIGHT_LOCATION_TRANSLATIONS);
    setFormState(() => {
      const nextState = toFormState(null, config.formFields);

      if (!hasCurrencySourceField || currencyOptions.length === 0) {
        return nextState;
      }

      return {
        ...nextState,
        currency: currencyOptions[0].value,
      };
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    if (isHotelEndpoint) {
      const city = typeof item.city === "string" ? item.city.trim() : "";
      const cityEn = typeof item.city_en === "string" ? item.city_en.trim() : "";
      const cityTr = typeof item.city_tr === "string" ? item.city_tr.trim() : "";
      const cityRu = typeof item.city_ru === "string" ? item.city_ru.trim() : "";

      setHotelCityTranslations({
        city_en: cityEn,
        city_tr: cityTr,
        city_ru: cityRu,
      });

      setShowHotelCityTranslations(
        [cityEn, cityTr, cityRu].some((value) => value.length > 0 && value !== city)
      );
    } else {
      setShowHotelCityTranslations(false);
      setHotelCityTranslations(EMPTY_CITY_TRANSLATIONS);
    }

    if (isFlightEndpoint) {
      const origin = typeof item.origin === "string" ? item.origin.trim() : "";
      const destination = typeof item.destination === "string" ? item.destination.trim() : "";
      const originEn = typeof item.origin_en === "string" ? item.origin_en.trim() : "";
      const originTr = typeof item.origin_tr === "string" ? item.origin_tr.trim() : "";
      const originRu = typeof item.origin_ru === "string" ? item.origin_ru.trim() : "";
      const destinationEn = typeof item.destination_en === "string" ? item.destination_en.trim() : "";
      const destinationTr = typeof item.destination_tr === "string" ? item.destination_tr.trim() : "";
      const destinationRu = typeof item.destination_ru === "string" ? item.destination_ru.trim() : "";

      setFlightLocationTranslations({
        origin_en: originEn,
        origin_tr: originTr,
        origin_ru: originRu,
        destination_en: destinationEn,
        destination_tr: destinationTr,
        destination_ru: destinationRu,
      });

      setShowFlightLocationTranslations(
        [originEn, originTr, originRu].some((value) => value.length > 0 && value !== origin) ||
          [destinationEn, destinationTr, destinationRu].some(
            (value) => value.length > 0 && value !== destination
          )
      );
    } else {
      setShowFlightLocationTranslations(false);
      setFlightLocationTranslations(EMPTY_FLIGHT_LOCATION_TRANSLATIONS);
    }

    setFormState(toFormState(item, config.formFields));
    setIsModalOpen(true);
  };

  const handleDelete = async (item: InventoryItem) => {
    const confirmed = window.confirm("Delete this record?");

    if (!confirmed) {
      return;
    }

    try {
      await axiosInstance.delete(endpointById(config.endpoint, item.id));
      await fetchItems();
    } catch {
      setError("Delete failed. Please try again.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");
      const submitState =
        hasCurrencySourceField &&
        currencyOptions.length > 0 &&
        !(formState.currency ?? "").trim()
          ? { ...formState, currency: currencyOptions[0].value }
          : formState;

      const rawPayload = toPayload(submitState, config.formFields);
      if (isHotelEndpoint) {
        const baseCity = typeof rawPayload.city === "string" ? rawPayload.city.trim() : "";

        if (showHotelCityTranslations) {
          rawPayload.city_en = hotelCityTranslations.city_en.trim() || baseCity;
          rawPayload.city_tr = hotelCityTranslations.city_tr.trim() || baseCity;
          rawPayload.city_ru = hotelCityTranslations.city_ru.trim() || baseCity;
        }
      }

      if (isFlightEndpoint && showFlightLocationTranslations) {
        const baseOrigin = typeof rawPayload.origin === "string" ? rawPayload.origin.trim() : "";
        const baseDestination =
          typeof rawPayload.destination === "string" ? rawPayload.destination.trim() : "";

        rawPayload.origin_en = flightLocationTranslations.origin_en.trim() || baseOrigin;
        rawPayload.origin_tr = flightLocationTranslations.origin_tr.trim() || baseOrigin;
        rawPayload.origin_ru = flightLocationTranslations.origin_ru.trim() || baseOrigin;
        rawPayload.destination_en =
          flightLocationTranslations.destination_en.trim() || baseDestination;
        rawPayload.destination_tr =
          flightLocationTranslations.destination_tr.trim() || baseDestination;
        rawPayload.destination_ru =
          flightLocationTranslations.destination_ru.trim() || baseDestination;
      }

      const payload = enrichLocationTranslations(config.endpoint, rawPayload);

      if (editingItem) {
        await axiosInstance.put(endpointById(config.endpoint, editingItem.id), payload);
      } else {
        await axiosInstance.post(config.endpoint, payload);
      }

      resetModal();
      await fetchItems();
    } catch {
      setError(`${editingItem ? "Update" : "Create"} failed. Verify required fields and try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      ...config.tableFields.map((field) =>
        columnHelper.accessor((row) => row[field.key], {
          id: field.key,
          header: field.label,
          cell: (info) => (
            <span className="text-xs text-slate-700">
              {field.key === "currency"
                ? formatCurrencyValue(info.getValue(), currencyOptions)
                : formatValue(info.getValue())}
            </span>
          ),
        })
      ),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openEditModal(info.row.original)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(info.row.original)}
              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        ),
      }),
    ],
    [config.tableFields, currencyOptions]
  );

  const selectedCurrencyValue = formState.currency?.trim() ?? "";
  const selectedCurrency = useMemo(() => {
    const option = currencyOptions.find((item) => item.value === selectedCurrencyValue);

    if (option?.code) {
      return option.code;
    }

    return selectedCurrencyValue.toUpperCase();
  }, [currencyOptions, selectedCurrencyValue]);
  const conversionPreview = useMemo(() => {
    if (!selectedCurrency || exchangeRates.length === 0) {
      return [] as ExchangeRateRecord[];
    }

    return exchangeRates
      .filter((entry) => entry.base === selectedCurrency)
      .slice(0, 4);
  }, [exchangeRates, selectedCurrency]);

  const getFieldOptions = (field: FormField): SelectOption[] => {
    if (field.options && field.options.length > 0) {
      return field.options;
    }

    if (field.source === "currencies") {
      return currencyOptions;
    }

    return [];
  };

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{config.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{config.description}</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Create New
        </button>
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="border-b border-slate-200 px-3 py-2 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-5 text-xs text-slate-500" colSpan={columns.length}>
                    Loading...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-xs text-slate-500" colSpan={columns.length}>
                    No records found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-b border-slate-100 px-3 py-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingItem ? `Edit ${config.title.slice(0, -1)}` : `Create ${config.title.slice(0, -1)}`}
              </h3>
              <button
                type="button"
                onClick={resetModal}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3 p-4 sm:grid-cols-2">
              {config.formFields.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label htmlFor={field.key} className="mb-1 block text-xs font-medium text-slate-600">
                    {field.label}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      id={field.key}
                      value={formState[field.key] ?? ""}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, [field.key]: event.target.value }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={3}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  ) : field.type === "select" ? (
                    <>
                      <select
                        id={field.key}
                        value={formState[field.key] ?? ""}
                        onChange={(event) =>
                          setFormState((previous) => ({ ...previous, [field.key]: event.target.value }))
                        }
                        required={field.required}
                        disabled={field.source === "currencies" && currenciesLoading}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
                      >
                        {field.source === "currencies" && currenciesLoading ? (
                          <option value="">Loading currencies...</option>
                        ) : (
                          <>
                            {!field.required ? <option value="">Select...</option> : null}
                            {getFieldOptions(field).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {field.source === "currencies" && currencyError ? (
                        <p className="mt-1 text-[11px] text-red-500">{currencyError}</p>
                      ) : null}
                    </>
                  ) : (
                    <input
                      id={field.key}
                      type={field.type}
                      step={field.step}
                      value={formState[field.key] ?? ""}
                      onChange={(event) =>
                        setFormState((previous) => ({ ...previous, [field.key]: event.target.value }))
                      }
                      placeholder={field.placeholder}
                      required={field.required}
                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  )}

                  {isHotelEndpoint && field.key === "city" ? (
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowHotelCityTranslations((previous) => !previous)}
                        className="text-[11px] font-semibold text-slate-700 underline decoration-dotted underline-offset-2 hover:text-slate-900"
                      >
                        {showHotelCityTranslations
                          ? "Use single city value for all languages"
                          : "Set city for each language (optional)"}
                      </button>

                      {showHotelCityTranslations ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <input
                            type="text"
                            value={hotelCityTranslations.city_en}
                            onChange={(event) =>
                              setHotelCityTranslations((previous) => ({
                                ...previous,
                                city_en: event.target.value,
                              }))
                            }
                            placeholder="City [en]"
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                          <input
                            type="text"
                            value={hotelCityTranslations.city_tr}
                            onChange={(event) =>
                              setHotelCityTranslations((previous) => ({
                                ...previous,
                                city_tr: event.target.value,
                              }))
                            }
                            placeholder="City [tr]"
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                          <input
                            type="text"
                            value={hotelCityTranslations.city_ru}
                            onChange={(event) =>
                              setHotelCityTranslations((previous) => ({
                                ...previous,
                                city_ru: event.target.value,
                              }))
                            }
                            placeholder="City [ru]"
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isFlightEndpoint && field.key === "origin" ? (
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowFlightLocationTranslations((previous) => !previous)}
                        className="text-[11px] font-semibold text-slate-700 underline decoration-dotted underline-offset-2 hover:text-slate-900"
                      >
                        {showFlightLocationTranslations
                          ? "Use single origin/destination values for all languages"
                          : "Set origin and destination for each language (optional)"}
                      </button>

                      {showFlightLocationTranslations ? (
                        <div className="space-y-2">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              value={flightLocationTranslations.origin_en}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  origin_en: event.target.value,
                                }))
                              }
                              placeholder="Origin [en]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                            <input
                              type="text"
                              value={flightLocationTranslations.origin_tr}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  origin_tr: event.target.value,
                                }))
                              }
                              placeholder="Origin [tr]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                            <input
                              type="text"
                              value={flightLocationTranslations.origin_ru}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  origin_ru: event.target.value,
                                }))
                              }
                              placeholder="Origin [ru]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              value={flightLocationTranslations.destination_en}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  destination_en: event.target.value,
                                }))
                              }
                              placeholder="Destination [en]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                            <input
                              type="text"
                              value={flightLocationTranslations.destination_tr}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  destination_tr: event.target.value,
                                }))
                              }
                              placeholder="Destination [tr]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                            <input
                              type="text"
                              value={flightLocationTranslations.destination_ru}
                              onChange={(event) =>
                                setFlightLocationTranslations((previous) => ({
                                  ...previous,
                                  destination_ru: event.target.value,
                                }))
                              }
                              placeholder="Destination [ru]"
                              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {field.key === "currency" && conversionPreview.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {conversionPreview
                        .map((entry) => `1 ${entry.base} = ${entry.rate.toFixed(4)} ${entry.target}`)
                        .join(" | ")}
                    </p>
                  ) : null}
                </div>
              ))}

              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
