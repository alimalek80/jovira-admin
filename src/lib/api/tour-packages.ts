import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

export type TourPackagePayload = {
  name: string;
  destination: string;
  days: number;
  nights: number;
  currency: number;
  flights: number[];
  hotels: number[];
  transfers: number[];
  excursions: number[];
  cost_price: string;
  agency_price: string;
  public_price: string;
};

export type TourPackageResponse = {
  id: number;
  name: string;
  destination: string;
  days: number;
  nights: number;
  currency: number | string | Record<string, unknown> | null;
  flights?: unknown[];
  hotels?: unknown[];
  transfers?: unknown[];
  excursions?: unknown[];
  minimum_cost_floor?: string | number | null;
  cost_price?: string | number | null;
  agency_price?: string | number | null;
  public_price: string;
};

export type AdminTourPackage = {
  id: number;
  name: string;
  destination: string;
  days: number;
  nights: number;
  currency: number;
  flights: number[];
  hotels: number[];
  transfers: number[];
  excursions: number[];
  cost_price: string;
  agency_price: string;
  public_price: string;
  minimum_cost_floor: string;
};

export type SelectOption = {
  id: string;
  label: string;
};

export type CurrencyOption = SelectOption & {
  code: string;
};

export type ComponentOption = SelectOption & {
  costPrice: number;
  currencyId: string;
  publicPrice?: number;
  agencyPrice?: number;
  departureDate?: string;
  arrivalDate?: string;
};

function getAccessTokenFromCookie() {
  if (typeof document === "undefined") {
    return "";
  }

  const pair = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("access="));

  if (!pair) {
    return "";
  }

  return decodeURIComponent(pair.split("=")[1] ?? "").replace(/^Bearer\s+/i, "").trim();
}

function authHeaders() {
  const token = getAccessTokenFromCookie();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeList(payload: unknown): TourPackageResponse[] {
  if (Array.isArray(payload)) {
    return payload as TourPackageResponse[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: TourPackageResponse[] }).results;
  }

  return [];
}

function normalizeRows(payload: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const nested = (value as Record<string, unknown>).id;
    return parseNumericId(nested);
  }

  return null;
}

function parseDecimalString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "0";
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .map((item) => parseNumericId(item))
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item));

  return [...new Set(ids)];
}

function normalizeTourPackage(response: TourPackageResponse): AdminTourPackage {
  const currencyId = parseNumericId(response.currency);

  return {
    id: Number(response.id),
    name: response.name ?? "",
    destination: response.destination ?? "",
    days: Number(response.days ?? 0),
    nights: Number(response.nights ?? 0),
    currency: currencyId ?? 0,
    flights: parseIdArray(response.flights),
    hotels: parseIdArray(response.hotels),
    transfers: parseIdArray(response.transfers),
    excursions: parseIdArray(response.excursions),
    cost_price: parseDecimalString(response.cost_price),
    agency_price: parseDecimalString(response.agency_price),
    public_price: parseDecimalString(response.public_price),
    minimum_cost_floor: parseDecimalString(response.minimum_cost_floor),
  };
}

function normalizeOptionLabel(row: Record<string, unknown>, fallbackId: string) {
  const labelCandidates = ["name", "title", "name_en", "destination", "code", "flight_number"];

  for (const key of labelCandidates) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallbackId;
}

function toCurrencyId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed;
  }

  if (value && typeof value === "object") {
    const nestedId = (value as Record<string, unknown>).id;
    return toCurrencyId(nestedId);
  }

  return "";
}

function toCostPrice(row: Record<string, unknown>): number {
  const candidates = [row.cost_price, row.agency_price, row.public_price, row.price];

  for (const candidate of candidates) {
    const parsed = Number.parseFloat(parseDecimalString(candidate));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toPriceNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(parseDecimalString(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOptions(payload: unknown, labelBuilder?: (row: Record<string, unknown>, fallbackId: string) => string): SelectOption[] {
  return normalizeRows(payload)
    .map((row) => {
      const idValue = parseNumericId(row.id);
      if (idValue === null) {
        return null;
      }

      const id = String(idValue);
      const label = labelBuilder?.(row, id) ?? normalizeOptionLabel(row, id);
      return { id, label };
    })
    .filter((option): option is SelectOption => Boolean(option))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeComponentOptions(
  payload: unknown,
  labelBuilder?: (row: Record<string, unknown>, fallbackId: string) => string
): ComponentOption[] {
  const options: ComponentOption[] = [];

  for (const row of normalizeRows(payload)) {
    const idValue = parseNumericId(row.id);

    if (idValue === null) {
      continue;
    }

    const id = String(idValue);
    const label = labelBuilder?.(row, id) ?? normalizeOptionLabel(row, id);

    const option: ComponentOption = {
      id,
      label,
      costPrice: toCostPrice(row),
      currencyId: toCurrencyId(row.currency),
    };

    const publicPrice = toPriceNumber(row.public_price ?? row.price);
    if (publicPrice !== null) {
      option.publicPrice = publicPrice;
    }

    const agencyPrice = toPriceNumber(row.agency_price);
    if (agencyPrice !== null) {
      option.agencyPrice = agencyPrice;
    }

    if (typeof row.departure_time === "string") {
      option.departureDate = row.departure_time;
    }

    if (typeof row.arrival_time === "string") {
      option.arrivalDate = row.arrival_time;
    }

    options.push(option);
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export async function createTourPackage(payload: TourPackagePayload): Promise<AdminTourPackage> {
  const response = await axiosInstance.post(INVENTORY_ENDPOINTS.adminTourPackages, payload, {
    headers: authHeaders(),
  });

  return normalizeTourPackage(response.data as TourPackageResponse);
}

export async function updateTourPackage(
  id: number,
  payload: Partial<TourPackagePayload>
): Promise<AdminTourPackage> {
  const response = await axiosInstance.patch(`${INVENTORY_ENDPOINTS.adminTourPackages}${id}/`, payload, {
    headers: authHeaders(),
  });

  return normalizeTourPackage(response.data as TourPackageResponse);
}

export async function listAdminTourPackages(): Promise<AdminTourPackage[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTourPackages, {
    headers: authHeaders(),
  });

  return normalizeList(response.data).map((row) => normalizeTourPackage(row));
}

export async function getAdminTourPackage(id: number): Promise<AdminTourPackage> {
  const response = await axiosInstance.get(`${INVENTORY_ENDPOINTS.adminTourPackages}${id}/`, {
    headers: authHeaders(),
  });

  return normalizeTourPackage(response.data as TourPackageResponse);
}

export async function listAdminFlightOptions(): Promise<ComponentOption[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminFlights, {
    headers: authHeaders(),
  });

  return normalizeComponentOptions(response.data, (row, fallbackId) => {
    const flightNumber = typeof row.flight_number === "string" ? row.flight_number.trim() : "";
    const origin = typeof row.origin === "string" ? row.origin.trim() : "";
    const destination = typeof row.destination === "string" ? row.destination.trim() : "";
    const route = [origin, destination].filter((part) => part.length > 0).join(" -> ");
    const headline = flightNumber || fallbackId;
    return route ? `${headline} (${route})` : headline;
  });
}

export async function listAdminHotelOptions(): Promise<ComponentOption[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminHotels, {
    headers: authHeaders(),
  });

  return normalizeComponentOptions(response.data, (row, fallbackId) => {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const city = typeof row.city === "string" ? row.city.trim() : "";
    if (name && city) {
      return `${name} (${city})`;
    }

    return name || fallbackId;
  });
}

export async function listAdminTransferOptions(): Promise<ComponentOption[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTransfers, {
    headers: authHeaders(),
  });

  return normalizeComponentOptions(response.data, (row, fallbackId) => {
    const fromLocation = typeof row.from_location === "string" ? row.from_location.trim() : "";
    const toLocation = typeof row.to_location === "string" ? row.to_location.trim() : "";
    const title = typeof row.name === "string" ? row.name.trim() : "";
    const route = [fromLocation, toLocation].filter((part) => part.length > 0).join(" -> ");
    if (title && route) {
      return `${title} (${route})`;
    }

    return route || title || fallbackId;
  });
}

export async function listAdminExcursionOptions(): Promise<ComponentOption[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminExcursions, {
    headers: authHeaders(),
  });

  return normalizeComponentOptions(response.data);
}

export async function listAdminCurrencyOptions(): Promise<CurrencyOption[]> {
  const response = await axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies, {
    headers: authHeaders(),
    params: { is_active: true },
  });

  return normalizeRows(response.data)
    .map((row) => {
      const idValue = parseNumericId(row.id);
      if (idValue === null) {
        return null;
      }

      const id = String(idValue);
      const code = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
      const name = typeof row.name_en === "string" ? row.name_en.trim() : "";
      const fallback = code || name || id;

      return {
        id,
        label: code && name ? `${code} - ${name}` : fallback,
        code: code || fallback,
      };
    })
    .filter((option): option is CurrencyOption => Boolean(option))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function convertCurrencyAmount(params: {
  from: string;
  to: string;
  amount: number;
}): Promise<number> {
  const response = await axiosInstance.get(FINANCE_ENDPOINTS.clientConvert, {
    headers: authHeaders(),
    params: {
      from: params.from,
      to: params.to,
      amount: params.amount,
    },
  });

  const payload = response.data as
    | number
    | string
    | {
        converted_amount?: unknown;
        convertedAmount?: unknown;
        amount?: unknown;
        result?: unknown;
        value?: unknown;
      };

  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

    if (typeof payload === "string") {
    const parsed = Number.parseFloat(payload);
    return Number.isFinite(parsed) ? parsed : params.amount;
  }

  if (typeof payload === "number") {
    return Number.isFinite(payload) ? payload : params.amount;
  }

  if (!payload || typeof payload !== "object") {
    return params.amount;
  }

  const conversionPayload = payload as {
    converted_amount?: unknown;
    convertedAmount?: unknown;
    amount?: unknown;
    result?: unknown;
    value?: unknown;
  };

  const candidate =
    conversionPayload.converted_amount ??
    conversionPayload.convertedAmount ??
    conversionPayload.amount ??
    conversionPayload.result ??
    conversionPayload.value;

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = Number.parseFloat(candidate);
    return Number.isFinite(parsed) ? parsed : params.amount;
  }

  return params.amount;
}

