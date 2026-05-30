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
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

type InventoryItem = {
  id: number | string;
  [key: string]: unknown;
};

type FormFieldType = "text" | "number" | "date" | "datetime-local" | "textarea" | "select" | "file";

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
  multi?: boolean;
  note?: string;
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

function toPayload(formState: Record<string, any>, fields: FormField[]) {
  // Only use FormData when at least one file field actually has a file selected
  const hasActualFile = fields.some(
    (field) =>
      field.type === "file" &&
      (formState[field.key] instanceof File ||
        (Array.isArray(formState[field.key]) && (formState[field.key] as File[]).length > 0))
  );

  if (hasActualFile) {
    const formData = new FormData();
    for (const field of fields) {
      const value = formState[field.key];

      if (field.type === "file") {
        if (field.multi && Array.isArray(value) && value.length > 0) {
          // Use repeated keys for multi-file (DRF expects this)
          (value as File[]).forEach((file: File) => formData.append(field.key, file));
        } else if (value instanceof File) {
          formData.append(field.key, value);
        }
        continue;
      }

      // Skip empty values
      if (value == null || value === "") continue;

      if (field.multi && Array.isArray(value) && value.length > 0) {
        (value as string[]).forEach((v) => formData.append(field.key, v));
        continue;
      }

      if (field.type === "number") {
        formData.append(field.key, String(value));
        continue;
      }

      if (field.type === "datetime-local") {
        const str = String(value);
        formData.append(field.key, str.length === 16 ? `${str}:00` : str);
        continue;
      }

      formData.append(field.key, String(value));
    }
    return formData;
  }

  // Plain JSON object (no actual files selected)
  const payload: Record<string, string | number> = {};
  for (const field of fields) {
    if (field.type === "file") continue; // skip file fields when no file chosen
    const rawValue = formState[field.key]?.trim?.() ?? formState[field.key] ?? "";
    if (rawValue === "" || rawValue == null) continue;
    if (field.type === "number") {
      const numberValue = Number(rawValue);
      payload[field.key] = Number.isNaN(numberValue) ? 0 : numberValue;
      continue;
    }
    if (field.type === "datetime-local") {
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
  const isExcursionEndpoint = endpoint.includes("/inventory/admin/excursions/");

  if (!isHotelEndpoint && !isFlightEndpoint && !isExcursionEndpoint) {
    return payload;
  }

  const nextPayload: Record<string, string | number> = { ...payload };

  const sourcePairs: Array<[string, string[]]> = isHotelEndpoint || isExcursionEndpoint
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
  const [previewUrls, setPreviewUrls] = useState<Record<string, string[]>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
        const [currenciesResponse, ratesPayload] = await Promise.all([
          axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies).then((r) => r.data as unknown).catch(() => null),
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
          setCurrencyError("No currencies available. Ensure currencies are configured in Finance.");
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
    // Revoke only object URLs created by us (blob:), not backend media URLs
    Object.values(previewUrls).flat().filter((url) => url.startsWith("blob:")).forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls({});
    setLightboxUrl(null);
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
    Object.values(previewUrls).flat().filter((url) => url.startsWith("blob:")).forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls({});
    setLightboxUrl(null);
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

    // Seed preview thumbnails from existing backend image URLs
    const initialPreviews: Record<string, string[]> = {};
    for (const field of config.formFields) {
      if (field.type !== "file") continue;
      const raw = item[field.key];
      if (!raw) continue;
      if (typeof raw === "string" && raw.trim()) {
        initialPreviews[field.key] = [raw.trim()];
      } else if (Array.isArray(raw)) {
        // gallery_images: array of objects {image: url, ...} or plain strings
        const urls = (raw as unknown[]).flatMap((entry) => {
          if (typeof entry === "string" && entry.trim()) return [entry.trim()];
          if (entry && typeof entry === "object") {
            const img = (entry as Record<string, unknown>).image;
            if (typeof img === "string" && img.trim()) return [img.trim()];
          }
          return [];
        });
        if (urls.length > 0) initialPreviews[field.key] = urls;
      }
    }
    Object.values(previewUrls).flat().filter((url) => url.startsWith("blob:")).forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls(initialPreviews);
    setLightboxUrl(null);

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

      if (rawPayload instanceof FormData) {
        // For FormData (file uploads): enrich translations by appending to FormData directly
        if (isHotelEndpoint) {
          const name = (submitState.name ?? "").trim();
          const city = (submitState.city ?? "").trim();
          if (!(submitState.name_en ?? "").trim() && name) rawPayload.append("name_en", name);
          if (!(submitState.name_tr ?? "").trim() && name) rawPayload.append("name_tr", name);
          if (!(submitState.name_ru ?? "").trim() && name) rawPayload.append("name_ru", name);
          if (!(submitState.city_en ?? "").trim() && city) rawPayload.append("city_en", city);
          if (!(submitState.city_tr ?? "").trim() && city) rawPayload.append("city_tr", city);
          if (!(submitState.city_ru ?? "").trim() && city) rawPayload.append("city_ru", city);
        }
        if (isFlightEndpoint) {
          const origin = (submitState.origin ?? "").trim();
          const destination = (submitState.destination ?? "").trim();
          if (!(submitState.origin_en ?? "").trim() && origin) rawPayload.append("origin_en", origin);
          if (!(submitState.origin_tr ?? "").trim() && origin) rawPayload.append("origin_tr", origin);
          if (!(submitState.origin_ru ?? "").trim() && origin) rawPayload.append("origin_ru", origin);
          if (!(submitState.destination_en ?? "").trim() && destination) rawPayload.append("destination_en", destination);
          if (!(submitState.destination_tr ?? "").trim() && destination) rawPayload.append("destination_tr", destination);
          if (!(submitState.destination_ru ?? "").trim() && destination) rawPayload.append("destination_ru", destination);
        }
      } else {
        // Plain JSON: use existing translation enrichment logic
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
          const baseDestination = typeof rawPayload.destination === "string" ? rawPayload.destination.trim() : "";
          rawPayload.origin_en = flightLocationTranslations.origin_en.trim() || baseOrigin;
          rawPayload.origin_tr = flightLocationTranslations.origin_tr.trim() || baseOrigin;
          rawPayload.origin_ru = flightLocationTranslations.origin_ru.trim() || baseOrigin;
          rawPayload.destination_en = flightLocationTranslations.destination_en.trim() || baseDestination;
          rawPayload.destination_tr = flightLocationTranslations.destination_tr.trim() || baseDestination;
          rawPayload.destination_ru = flightLocationTranslations.destination_ru.trim() || baseDestination;
        }
        enrichLocationTranslations(config.endpoint, rawPayload as Record<string, string | number>);
      }

      const payload = rawPayload;

      // Extract gallery images before sending to hotel endpoint — they go to /hotel-images/ separately.
      let pendingGalleryFiles: File[] = [];
      if (isHotelEndpoint && payload instanceof FormData) {
        const raw = formState.gallery_images;
        if (Array.isArray(raw) && raw.length > 0) {
          pendingGalleryFiles = raw as File[];
        } else if (raw instanceof File) {
          pendingGalleryFiles = [raw];
        }
        payload.delete("gallery_images");
      }

      // PATCH for FormData updates (DRF supports PATCH with multipart), PUT for JSON
      let hotelId: number | string | null = editingItem ? editingItem.id : null;
      if (editingItem) {
        if (payload instanceof FormData) {
          await axiosInstance.patch(endpointById(config.endpoint, editingItem.id), payload);
        } else {
          await axiosInstance.put(endpointById(config.endpoint, editingItem.id), payload);
        }
      } else {
        const createResponse = await axiosInstance.post(config.endpoint, payload);
        hotelId = (createResponse.data as { id?: number | string })?.id ?? null;
      }

      // Upload each gallery image to /hotel-images/ after the hotel is saved.
      if (isHotelEndpoint && hotelId != null && pendingGalleryFiles.length > 0) {
        await Promise.all(
          pendingGalleryFiles.map((file, index) => {
            const imgForm = new FormData();
            imgForm.append("hotel", String(hotelId));
            imgForm.append("image", file);
            imgForm.append("order", String(index + 1));
            return axiosInstance.post(INVENTORY_ENDPOINTS.adminHotelImages, imgForm);
          })
        );
      }

      resetModal();
      await fetchItems();
    } catch (err: unknown) {
      // Show the actual backend error message if available
      const axiosErr = err as { response?: { data?: unknown } };
      const data = axiosErr?.response?.data;
      let message = `${editingItem ? "Update" : "Create"} failed. Verify required fields and try again.`;
      if (data && typeof data === "object") {
        const msgs = Object.entries(data as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join(" | ");
        if (msgs) message = msgs;
      } else if (typeof data === "string" && data.trim()) {
        message = data.trim();
      }
      setError(message);
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

            <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
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
                          value={formState[field.key] ?? (field.multi ? [] : "")}
                          onChange={(event) => {
                            if (field.multi) {
                              const options = Array.from(event.target.selectedOptions).map((o) => o.value);
                              setFormState((previous) => ({ ...previous, [field.key]: options }));
                            } else {
                              setFormState((previous) => ({ ...previous, [field.key]: event.target.value }));
                            }
                          }}
                          required={field.required}
                          multiple={!!field.multi}
                          disabled={field.source === "currencies" && currenciesLoading}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
                        >
                          {field.source === "currencies" && currenciesLoading ? (
                            <option value="">Loading currencies...</option>
                          ) : (
                            <>
                              {!field.required && !field.multi ? <option value="">Select...</option> : null}
                              {(field.options || getFieldOptions(field)).map((option) => (
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
                    ) : field.type === "file" ? (
                      <>
                        <input
                          id={field.key}
                          type="file"
                          multiple={!!field.multi}
                          onChange={(event) => {
                            const files = event.target.files;
                            if (files) {
                              const fileArray = Array.from(files);
                              // Revoke previous URLs for this field before creating new ones
                              (previewUrls[field.key] ?? []).forEach((url) => URL.revokeObjectURL(url));
                              const newUrls = fileArray.map((f) => URL.createObjectURL(f));
                              setPreviewUrls((previous) => ({ ...previous, [field.key]: newUrls }));
                              setFormState((previous) => ({
                                ...previous,
                                [field.key]: field.multi ? fileArray : fileArray[0],
                              }));
                            }
                          }}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                        {(previewUrls[field.key] ?? []).length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(previewUrls[field.key] ?? []).map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                title="Click to preview"
                                onClick={() => setLightboxUrl(url)}
                                className="h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-slate-200 hover:border-slate-500 transition focus:outline-none focus:ring-2 focus:ring-slate-400"
                              >
                                <img
                                  src={url}
                                  alt={`preview ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
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
                    {field.note ? (
                      <p className="mt-1 text-[11px] text-slate-500 italic">{field.note}</p>
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
        </div>
      ) : null}

      {/* Image lightbox */}
      {lightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition"
          >
            ✕
          </button>
          <img
            src={lightboxUrl}
            alt="Full preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
