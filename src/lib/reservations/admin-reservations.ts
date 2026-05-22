import type { ReservationTouristPayload, ReservationWithTouristsInput } from "@/lib/api/tourists";

export type ReservationOwnerType = "AGENCY" | "NORMAL";
export type ReservationBookingMode = "WITH_TOUR_PACKAGE" | "STANDALONE_SERVICES";

export type ReservationFormState = {
  id: number | null;
  reservationNo: string;
  reservationDate: string;
  status: string;
  ownerType: ReservationOwnerType;
  agencyId: string;
  customerId: string;
  bookingMode: ReservationBookingMode;
  tourPackageId: string;
  currencyId: string;
};

function toNullableId(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveTourPackageId(form: Pick<ReservationFormState, "bookingMode" | "tourPackageId">): number | null {
  if (form.bookingMode === "STANDALONE_SERVICES") {
    return null;
  }

  return toNullableId(form.tourPackageId);
}

export function buildReservationPayload(
  form: ReservationFormState,
  tourists: ReservationTouristPayload[] = []
): ReservationWithTouristsInput {
  const currency = Number(form.currencyId);
  const tourPackage = resolveTourPackageId(form);

  const basePayload: ReservationWithTouristsInput = {
    reservation_number: form.reservationNo,
    currency,
    status: form.status,
    tour_package: tourPackage,
    tourists,
  };

  if (form.ownerType === "AGENCY") {
    return {
      ...basePayload,
      agency: toNullableId(form.agencyId),
      customer: null,
      user: null,
    };
  }

  const customerId = toNullableId(form.customerId);
  return {
    ...basePayload,
    agency: null,
    customer: customerId,
    user: customerId,
  };
}

export function resolveNoTourPackageLabel(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "No tour package";
}

export function mapReservationValidationError(errorBody: unknown): string {
  if (!errorBody || typeof errorBody !== "object") {
    return "Unable to save reservation. Check backend required fields.";
  }

  const data = errorBody as Record<string, unknown>;

  const preferredFields = ["tour_package", "agency", "customer", "user", "currency", "status"];
  for (const field of preferredFields) {
    const value = data[field];
    if (Array.isArray(value) && typeof value[0] === "string") {
      return `${field}: ${value[0]}`;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return `${field}: ${value}`;
    }
  }

  const detail = data.detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  const firstEntry = Object.entries(data).find(([, value]) => {
    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return Array.isArray(value) && typeof value[0] === "string";
  });

  if (!firstEntry) {
    return "Unable to save reservation. Check backend required fields.";
  }

  const [field, value] = firstEntry;
  if (Array.isArray(value)) {
    return `${field}: ${value[0]}`;
  }

  return `${field}: ${String(value)}`;
}
