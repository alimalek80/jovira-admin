import { z } from "zod";
import type { TourPackagePayload } from "@/lib/api/tour-packages";

export const tourPackagePayloadSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  destination: z.string().trim().min(1, "Destination is required."),
  days: z.number().int().min(1, "Days must be at least 1."),
  nights: z.number().int().min(0, "Nights must be 0 or more."),
  public_price: z.string().trim().min(1, "Public price is required."),
  agency_price: z.string().trim().min(1, "Agency price is required."),
  name_en: z.string().trim().optional().or(z.literal("")),
  name_tr: z.string().trim().optional().or(z.literal("")),
  name_ru: z.string().trim().optional().or(z.literal("")),
  destination_en: z.string().trim().optional().or(z.literal("")),
  destination_tr: z.string().trim().optional().or(z.literal("")),
  destination_ru: z.string().trim().optional().or(z.literal("")),
});

export type TourPackageFormValues = {
  name: string;
  destination: string;
  days: string;
  nights: string;
  public_price: string;
  agency_price: string;
  name_en: string;
  name_tr: string;
  name_ru: string;
  destination_en: string;
  destination_tr: string;
  destination_ru: string;
};

export function toTourPackagePayload(values: TourPackageFormValues): TourPackagePayload {
  const parsedDays = Number.parseInt(values.days, 10);
  const safeDays = Number.isNaN(parsedDays) ? 0 : parsedDays;

  const parsedNights = Number.parseInt(values.nights, 10);
  const safeNights = Number.isNaN(parsedNights) ? Math.max(safeDays - 1, 0) : parsedNights;

  return {
    name: values.name.trim(),
    destination: values.destination.trim(),
    days: safeDays,
    nights: safeNights,
    public_price: values.public_price.trim(),
    agency_price: values.agency_price.trim(),
    name_en: values.name_en.trim(),
    name_tr: values.name_tr.trim(),
    name_ru: values.name_ru.trim(),
    destination_en: values.destination_en.trim(),
    destination_tr: values.destination_tr.trim(),
    destination_ru: values.destination_ru.trim(),
  };
}

export function toTourPackageFormValues(payload?: Partial<TourPackagePayload>): TourPackageFormValues {
  return {
    name: payload?.name ?? "",
    destination: payload?.destination ?? "",
    days: typeof payload?.days === "number" ? String(payload.days) : "",
    nights: typeof payload?.nights === "number" ? String(payload.nights) : "",
    public_price: payload?.public_price ?? "",
    agency_price: payload?.agency_price ?? "",
    name_en: payload?.name_en ?? "",
    name_tr: payload?.name_tr ?? "",
    name_ru: payload?.name_ru ?? "",
    destination_en: payload?.destination_en ?? "",
    destination_tr: payload?.destination_tr ?? "",
    destination_ru: payload?.destination_ru ?? "",
  };
}
