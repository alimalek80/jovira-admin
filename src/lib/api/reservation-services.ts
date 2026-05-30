import axiosInstance from "@/lib/axios";
import { API_V1, RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";
import type { ApiScope } from "@/lib/api/tourists";
import type { AxiosError } from "axios";

export type HotelBooking = {
  id: number;
  reservation: number;
  hotelId: string;
  hotelName: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  paid: boolean;
  isPaidCancelation: boolean;
};

export type HotelBookingInput = {
  reservation: number;
  hotel: number;
  check_in_date: string;
  check_out_date: string;
  paid: boolean;
  is_paid?: boolean;
  is_paid_cancelation?: boolean;
  is_paid_cancellation?: boolean;
};

export type TransferService = {
  id: number;
  reservation: number;
  tourPackageId: string;
  transferCatalogId: string;
  serviceName: string;
  serviceDate: string | null;
  onArrival: boolean;
  onDeparture: boolean;
  fromLocationType: string;
  fromLocationName: string;
  toLocationType: string;
  toLocationName: string;
  price: string;
  currencyId: string;
  passengers: number[];
  externalNote: string;
  driverNote: string;
};

export type TransferServiceInput = {
  reservation: number;
  tour_package?: number | null;
  transfer?: number | null;
  service_name: string;
  service_date: string;
  on_arrival: boolean;
  on_departure: boolean;
  from_location_type: string;
  from_location_name: string;
  to_location_type: string;
  to_location_name: string;
  price: string;
  currency: number;
  passengers: number[];
  external_note?: string;
  driver_note?: string;
};

type Row = Record<string, unknown>;

type TransferServiceInputBuilderArgs = {
  reservationId: number;
  tourPackageId?: string;
  values: {
    transfer_catalog?: string;
    service_name: string;
    service_date: string;
    on_arrival: boolean;
    on_departure: boolean;
    from_location_type: string;
    from_location_name: string;
    to_location_type: string;
    to_location_name: string;
    price: string;
    currency: string;
    passengers: number[];
    external_note: string;
    driver_note: string;
  };
};

export function buildTransferServiceInput({ reservationId, tourPackageId, values }: TransferServiceInputBuilderArgs): TransferServiceInput {
  const parsedTourPackage = typeof tourPackageId === "string" && tourPackageId.trim().length > 0
    ? Number(tourPackageId)
    : null;

  const parsedTransfer =
    typeof values.transfer_catalog === "string" && values.transfer_catalog.trim().length > 0
      ? Number(values.transfer_catalog)
      : null;

  return {
    reservation: reservationId,
    tour_package: Number.isFinite(parsedTourPackage) ? parsedTourPackage : null,
    transfer: Number.isFinite(parsedTransfer) ? parsedTransfer : null,
    service_name: values.service_name,
    service_date: values.service_date,
    on_arrival: values.on_arrival,
    on_departure: values.on_departure,
    from_location_type: values.from_location_type,
    from_location_name: values.from_location_name,
    to_location_type: values.to_location_type,
    to_location_name: values.to_location_name,
    price: values.price,
    currency: Number(values.currency),
    passengers: values.passengers,
    external_note: values.external_note,
    driver_note: values.driver_note,
  };
}

function resolveReservationEndpoint(scope: ApiScope) {
  if (scope === "admin") {
    return RESERVATIONS_ENDPOINTS.adminReservations;
  }

  return `${API_V1}/reservations/client/reservations/`;
}

function resolveHotelBookingsEndpoint(scope: ApiScope) {
  if (scope === "admin") {
    return RESERVATIONS_ENDPOINTS.adminHotelBookings;
  }

  return `${API_V1}/reservations/client/hotel-bookings/`;
}

function resolveTransferServicesEndpoint(scope: ApiScope) {
  if (scope === "admin") {
    return RESERVATIONS_ENDPOINTS.adminTransferServices;
  }

  return `${API_V1}/reservations/client/transfer-services/`;
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: T[] }).results;
  }

  return [];
}

function getId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    return getId((value as { id?: unknown }).id);
  }

  return null;
}

function relationLabel(value: unknown, fallback = ""): { id: string; label: string } {
  if (typeof value === "number") {
    return { id: String(value), label: String(value) };
  }

  if (typeof value === "string") {
    return { id: value, label: value };
  }

  if (value && typeof value === "object") {
    const row = value as Row;
    const id = getId(row.id);
    const label =
      (typeof row.name === "string" && row.name) ||
      (typeof row.title === "string" && row.title) ||
      (typeof row.label === "string" && row.label) ||
      (typeof row.code === "string" && row.code) ||
      fallback;

    return {
      id: id ? String(id) : label,
      label,
    };
  }

  return { id: fallback, label: fallback };
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }

    return Boolean(normalized);
  }

  return false;
}

function normalizeHotelBooking(row: unknown, reservationId?: number): HotelBooking | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Row;
  const id = getId(value.id);
  const resolvedReservation = getId(value.reservation) ?? reservationId ?? null;
  if (!id || !resolvedReservation) {
    return null;
  }

  const hotel = relationLabel(value.hotel, "-");

  return {
    id,
    reservation: resolvedReservation,
    hotelId: hotel.id,
    hotelName: hotel.label,
    checkInDate:
      typeof value.check_in_date === "string"
        ? value.check_in_date
        : typeof value.checkin_date === "string"
          ? value.checkin_date
          : null,
    checkOutDate:
      typeof value.check_out_date === "string"
        ? value.check_out_date
        : typeof value.checkout_date === "string"
          ? value.checkout_date
          : null,
    paid: toBoolean(value.paid ?? value.is_paid),
    isPaidCancelation: toBoolean(
      value.is_paid_cancelation ?? value.is_paid_cancellation ?? value.paid_cancelation ?? value.paid_cancellation
    ),
  };
}

function normalizeTransferService(row: unknown, reservationId?: number): TransferService | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Row;
  const id = getId(value.id);
  const resolvedReservation = getId(value.reservation) ?? reservationId ?? null;
  if (!id || !resolvedReservation) {
    return null;
  }

  return {
    id,
    reservation: resolvedReservation,
    tourPackageId: String(getId(value.tour_package) ?? ""),
    transferCatalogId: String(getId(value.transfer) ?? ""),
    serviceName: String(value.service_name ?? ""),
    serviceDate: typeof value.service_date === "string" ? value.service_date : null,
    onArrival: Boolean(value.on_arrival),
    onDeparture: Boolean(value.on_departure),
    fromLocationType: String(value.from_location_type ?? ""),
    fromLocationName: String(value.from_location_name ?? ""),
    toLocationType: String(value.to_location_type ?? ""),
    toLocationName: String(value.to_location_name ?? ""),
    price: String(value.price ?? ""),
    currencyId: String(getId(value.currency) ?? relationLabel(value.currency).id ?? ""),
    passengers: normalizeList<unknown>(value.passengers).map((item) => getId(item)).filter((item): item is number => item !== null),
    externalNote: String(value.external_note ?? ""),
    driverNote: String(value.driver_note ?? ""),
  };
}

async function listByReservation<T>(
  endpoint: string,
  reservationId: number,
  normalize: (row: unknown, reservationId?: number) => T | null,
  reservationEndpoint: string,
  nestedKey?: string
) {
  const candidateParams: Array<Record<string, number>> = [
    { reservation: reservationId },
    { reservation_id: reservationId },
    { reservationId },
  ];

  for (const params of candidateParams) {
    try {
      const response = await axiosInstance.get(endpoint, { params });
      const related = normalizeList<unknown>(response.data)
        .map((row) => normalize(row, reservationId))
        .filter((row): row is T => row !== null)
        .filter((row) => (row as { reservation?: number }).reservation === reservationId);

      if (related.length > 0) {
        return related;
      }
    } catch {
      continue;
    }
  }

  try {
    const detail = await axiosInstance.get(`${reservationEndpoint}${reservationId}/`);
    const reservationPayload = detail.data as Row;
    const candidates = nestedKey ? [reservationPayload[nestedKey]] : [];

    return candidates
      .flatMap((candidate) => normalizeList<unknown>(candidate))
      .map((row) => normalize(row, reservationId))
      .filter((row): row is T => row !== null)
      .filter((row) => (row as { reservation?: number }).reservation === reservationId);
  } catch {
    return [];
  }
}

export async function listHotelBookings(scope: ApiScope, reservationId: number): Promise<HotelBooking[]> {
  return listByReservation(
    resolveHotelBookingsEndpoint(scope),
    reservationId,
    normalizeHotelBooking,
    resolveReservationEndpoint(scope),
    "hotel_bookings"
  );
}

export async function createHotelBooking(scope: ApiScope, payload: HotelBookingInput): Promise<HotelBooking> {
  const payloadWithAliases = {
    ...payload,
    is_paid: payload.paid,
    is_paid_cancelation: payload.is_paid_cancelation ?? payload.is_paid_cancellation ?? false,
    is_paid_cancellation: payload.is_paid_cancelation ?? payload.is_paid_cancellation ?? false,
  };

  let response;

  try {
    response = await axiosInstance.post(resolveHotelBookingsEndpoint(scope), payloadWithAliases);
  } catch (error) {
    const fallbackPayload: HotelBookingInput & {
      is_paid: boolean;
      is_paid_cancellation: boolean;
      is_paid_cancelation?: boolean;
    } = {
      ...payloadWithAliases,
      is_paid_cancellation: payload.is_paid_cancelation ?? payload.is_paid_cancellation ?? false,
    };
    delete fallbackPayload.is_paid_cancelation;

    const axiosError = error as AxiosError;
    const shouldRetry = typeof axiosError?.response?.status === "number" && axiosError.response.status >= 400;
    if (!shouldRetry) {
      throw error;
    }

    response = await axiosInstance.post(resolveHotelBookingsEndpoint(scope), fallbackPayload);
  }

  const normalized = normalizeHotelBooking(response.data, payload.reservation);
  if (!normalized) {
    throw new Error("Unable to normalize hotel booking response.");
  }
  return normalized;
}

export async function updateHotelBooking(
  scope: ApiScope,
  bookingId: number,
  payload: Partial<HotelBookingInput> & { reservation: number }
): Promise<HotelBooking> {
  const payloadWithAliases = {
    ...payload,
    is_paid: typeof payload.paid === "boolean" ? payload.paid : payload.is_paid,
    is_paid_cancelation: payload.is_paid_cancelation ?? payload.is_paid_cancellation,
    is_paid_cancellation: payload.is_paid_cancelation ?? payload.is_paid_cancellation,
  };

  let response;

  try {
    response = await axiosInstance.patch(`${resolveHotelBookingsEndpoint(scope)}${bookingId}/`, payloadWithAliases);
  } catch (error) {
    const fallbackPayload = {
      ...payloadWithAliases,
      is_paid_cancellation: payload.is_paid_cancelation ?? payload.is_paid_cancellation ?? false,
    };
    delete fallbackPayload.is_paid_cancelation;

    const axiosError = error as AxiosError;
    const shouldRetry = typeof axiosError?.response?.status === "number" && axiosError.response.status >= 400;
    if (!shouldRetry) {
      throw error;
    }

    response = await axiosInstance.patch(`${resolveHotelBookingsEndpoint(scope)}${bookingId}/`, fallbackPayload);
  }

  const normalized = normalizeHotelBooking(response.data, payload.reservation);
  if (!normalized) {
    throw new Error("Unable to normalize hotel booking response.");
  }
  return normalized;
}

export async function deleteHotelBooking(scope: ApiScope, bookingId: number): Promise<void> {
  await axiosInstance.delete(`${resolveHotelBookingsEndpoint(scope)}${bookingId}/`);
}

export async function listTransferServices(scope: ApiScope, reservationId: number): Promise<TransferService[]> {
  return listByReservation(
    resolveTransferServicesEndpoint(scope),
    reservationId,
    normalizeTransferService,
    resolveReservationEndpoint(scope),
    "transfer_services"
  );
}

export async function createTransferService(scope: ApiScope, payload: TransferServiceInput): Promise<TransferService> {
  const response = await axiosInstance.post(resolveTransferServicesEndpoint(scope), payload);
  const normalized = normalizeTransferService(response.data, payload.reservation);
  if (!normalized) {
    throw new Error("Unable to normalize transfer service response.");
  }
  return normalized;
}

export async function updateTransferService(
  scope: ApiScope,
  serviceId: number,
  payload: Partial<TransferServiceInput> & { reservation: number }
): Promise<TransferService> {
  const response = await axiosInstance.patch(`${resolveTransferServicesEndpoint(scope)}${serviceId}/`, payload);
  const normalized = normalizeTransferService(response.data, payload.reservation);
  if (!normalized) {
    throw new Error("Unable to normalize transfer service response.");
  }
  return normalized;
}

export async function deleteTransferService(scope: ApiScope, serviceId: number): Promise<void> {
  await axiosInstance.delete(`${resolveTransferServicesEndpoint(scope)}${serviceId}/`);
}

// ─── ExcursionService (standalone B2B, not tied to a reservation) ─────────────

export type ExcursionService = {
  id: number;
  systemDate: string | null;
  excursionDate: string | null;
  isPaid: boolean;
  excursionId: string;
  excursionName: string;
  isCombo: boolean;
  pickupPoint: string;
  price: string;
  sellingCurrencyId: string;
  sellingCurrencyCode: string;
  cost: string;
  costCurrencyId: string;
  costCurrencyCode: string;
  crossCurrencyRate: string;
  confirmBookingNumber: string;
  agentConfirmationNumber: string;
  note: string;
};

export type ExcursionServiceInput = {
  excursion_date: string;
  is_paid: boolean;
  excursion: number;
  is_combo: boolean;
  pickup_point?: string;
  price?: string;
  selling_currency?: number | null;
  cost: string;
  cost_currency: number;
  cross_currency_rate?: string;
  confirm_booking_number?: string;
  agent_confirmation_number?: string;
  note?: string;
};

export type ExcursionServiceListParams = {
  excursion_date_after?: string;
  excursion_date_before?: string;
  is_paid?: boolean;
  is_combo?: boolean;
  page?: number;
  page_size?: number;
};

export type PaginatedExcursionServices = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExcursionService[];
};

function normalizeExcursionService(row: unknown): ExcursionService | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Row;
  const id = getId(value.id);
  if (!id) return null;

  const excursion = relationLabel(value.excursion, "");
  const costCurrency = relationLabel(value.cost_currency, "");
  const sellingCurrency = relationLabel(value.selling_currency, "");

  const costCurrencyCode =
    (value.cost_currency && typeof value.cost_currency === "object"
      ? (value.cost_currency as Row).code ?? (value.cost_currency as Row).iso_code
      : null) ??
    costCurrency.label;

  const sellingCurrencyCode =
    (value.selling_currency && typeof value.selling_currency === "object"
      ? (value.selling_currency as Row).code ?? (value.selling_currency as Row).iso_code
      : null) ??
    sellingCurrency.label;

  return {
    id,
    systemDate: typeof value.system_date === "string" ? value.system_date : null,
    excursionDate: typeof value.excursion_date === "string" ? value.excursion_date : null,
    isPaid: toBoolean(value.is_paid),
    excursionId: excursion.id,
    excursionName: excursion.label,
    isCombo: toBoolean(value.is_combo),
    pickupPoint: String(value.pickup_point ?? ""),
    price: String(value.price ?? "0.00"),
    sellingCurrencyId: sellingCurrency.id,
    sellingCurrencyCode: String(sellingCurrencyCode ?? ""),
    cost: String(value.cost ?? "0.00"),
    costCurrencyId: costCurrency.id,
    costCurrencyCode: String(costCurrencyCode ?? ""),
    crossCurrencyRate: String(value.cross_currency_rate ?? "1.0000000000"),
    confirmBookingNumber: String(value.confirm_booking_number ?? ""),
    agentConfirmationNumber: String(value.agent_confirmation_number ?? ""),
    note: String(value.note ?? ""),
  };
}

export async function listExcursionServices(params?: ExcursionServiceListParams): Promise<PaginatedExcursionServices> {
  const response = await axiosInstance.get(RESERVATIONS_ENDPOINTS.adminExcursionServices, { params });
  const data = response.data as Record<string, unknown>;

  if (data && typeof data === "object" && Array.isArray(data.results)) {
    return {
      count: typeof data.count === "number" ? data.count : 0,
      next: typeof data.next === "string" ? data.next : null,
      previous: typeof data.previous === "string" ? data.previous : null,
      results: (data.results as unknown[])
        .map(normalizeExcursionService)
        .filter((row): row is ExcursionService => row !== null),
    };
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  return {
    count: rows.length,
    next: null,
    previous: null,
    results: rows.map(normalizeExcursionService).filter((row): row is ExcursionService => row !== null),
  };
}

export async function getExcursionService(id: number): Promise<ExcursionService> {
  const response = await axiosInstance.get(`${RESERVATIONS_ENDPOINTS.adminExcursionServices}${id}/`);
  const normalized = normalizeExcursionService(response.data);
  if (!normalized) throw new Error("Unable to normalize excursion service response.");
  return normalized;
}

export async function createExcursionService(payload: ExcursionServiceInput): Promise<ExcursionService> {
  const response = await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminExcursionServices, payload);
  const normalized = normalizeExcursionService(response.data);
  if (!normalized) throw new Error("Unable to normalize excursion service response.");
  return normalized;
}

export async function updateExcursionService(id: number, payload: Partial<ExcursionServiceInput>): Promise<ExcursionService> {
  const response = await axiosInstance.patch(`${RESERVATIONS_ENDPOINTS.adminExcursionServices}${id}/`, payload);
  const normalized = normalizeExcursionService(response.data);
  if (!normalized) throw new Error("Unable to normalize excursion service response.");
  return normalized;
}

export async function deleteExcursionService(id: number): Promise<void> {
  await axiosInstance.delete(`${RESERVATIONS_ENDPOINTS.adminExcursionServices}${id}/`);
}