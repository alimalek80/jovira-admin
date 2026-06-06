import { z } from "zod";
import type { FieldErrorMap } from "@/lib/forms/backend-errors";
import type { AdminTourPackage, TourPackagePayload } from "@/lib/api/tour-packages";

export const tourPackagePayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  destination: z.string().trim().min(1, "Destination is required."),
  days: z.number().int().min(1, "Days must be at least 1."),
  nights: z.number().int().min(0, "Nights must be 0 or more."),
  currency: z.number().int().min(1, "Currency is required."),
  flights: z.array(z.number().int().min(1)),
  hotels: z.array(z.number().int().min(1)),
  transfers: z.array(z.number().int().min(1)),
  excursions: z.array(z.number().int().min(1)),
  cost_price: z.string().trim().min(1, "Cost price is required."),
  agency_price: z.string().trim().min(1, "Agency price is required."),
  public_price: z.string().trim().min(1, "Public price is required."),
});

export type TourPackageFormValues = {
  name: string;
  destination: string;
  days: string;
  nights: string;
  currency: string;
  flights: string[];
  hotels: string[];
  transfers: string[];
  excursions: string[];
  cost_price: string;
  agency_price: string;
  public_price: string;
};

function toNumberList(values: string[]) {
  return values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function toNumericValue(raw: string) {
  const parsed = Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function toTourPackagePayload(values: TourPackageFormValues): TourPackagePayload {
  const parsedDays = Number.parseInt(values.days, 10);
  const safeDays = Number.isNaN(parsedDays) ? 0 : parsedDays;

  const parsedNights = Number.parseInt(values.nights, 10);
  const safeNights = Number.isNaN(parsedNights) ? Math.max(safeDays - 1, 0) : parsedNights;

  const parsedCurrency = Number.parseInt(values.currency, 10);
  const safeCurrency = Number.isNaN(parsedCurrency) ? 0 : parsedCurrency;

  return {
    name: values.name.trim(),
    destination: values.destination.trim(),
    days: safeDays,
    nights: safeNights,
    currency: safeCurrency,
    flights: toNumberList(values.flights),
    hotels: toNumberList(values.hotels),
    transfers: toNumberList(values.transfers),
    excursions: toNumberList(values.excursions),
    cost_price: values.cost_price.trim(),
    agency_price: values.agency_price.trim(),
    public_price: values.public_price.trim(),
  };
}

export function toTourPackageFormValues(payload?: Partial<AdminTourPackage>): TourPackageFormValues {
  return {
    name: payload?.name ?? "",
    destination: payload?.destination ?? "",
    days: typeof payload?.days === "number" ? String(payload.days) : "",
    nights: typeof payload?.nights === "number" ? String(payload.nights) : "",
    currency: typeof payload?.currency === "number" ? String(payload.currency) : "",
    flights: Array.isArray(payload?.flights) ? payload.flights.map((id) => String(id)) : [],
    hotels: Array.isArray(payload?.hotels) ? payload.hotels.map((id) => String(id)) : [],
    transfers: Array.isArray(payload?.transfers) ? payload.transfers.map((id) => String(id)) : [],
    excursions: Array.isArray(payload?.excursions) ? payload.excursions.map((id) => String(id)) : [],
    cost_price: payload?.cost_price ?? "",
    agency_price: payload?.agency_price ?? "",
    public_price: payload?.public_price ?? "",
  };
}

export function validateTourPackagePricing(values: TourPackageFormValues, minimumCostFloor: string): FieldErrorMap {
  const floor = toNumericValue(minimumCostFloor || "0");
  const normalizedFloor = Number.isFinite(floor) ? floor : 0;

  const cost = toNumericValue(values.cost_price);
  const agency = toNumericValue(values.agency_price);
  const pub = toNumericValue(values.public_price);

  const errors: FieldErrorMap = {};

  if (Number.isFinite(cost) && cost < normalizedFloor) {
    errors.cost_price = `Cost price must be >= minimum cost floor (${normalizedFloor}).`;
  }

  if (Number.isFinite(agency) && agency < normalizedFloor) {
    errors.agency_price = `Agency price must be >= minimum cost floor (${normalizedFloor}).`;
  }

  if (Number.isFinite(pub) && pub < normalizedFloor) {
    errors.public_price = `Public price must be >= minimum cost floor (${normalizedFloor}).`;
  }

  if (Number.isFinite(pub) && Number.isFinite(agency) && pub < agency) {
    errors.public_price = "Public price must be greater than or equal to agency price.";
  }

  return errors;
}
