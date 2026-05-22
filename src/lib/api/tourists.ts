import axiosInstance from "@/lib/axios";
import { API_V1 } from "@/lib/api-endpoints";

export type ApiScope = "admin" | "client";

export type TouristSex = "MALE" | "FEMALE";
export type TouristAgeType = "ADULT" | "CHILD" | "INFANT";

export type Tourist = {
  id: number;
  reservation: number;
  first_name: string;
  last_name: string;
  sex: TouristSex;
  age_type: TouristAgeType;
  passport_number: string;
  nationality: string;
  birth_date: string | null;
  passport_expiry_date: string | null;
};

export type TouristInput = {
  id?: number;
  reservation: number;
  first_name: string;
  last_name: string;
  sex: TouristSex;
  age_type: TouristAgeType;
  passport_number?: string;
  nationality?: string;
  birth_date?: string;
  passport_expiry_date?: string;
};

export type ReservationTouristPayload = {
  id?: number;
  first_name: string;
  last_name: string;
  sex: TouristSex;
  age_type: TouristAgeType;
  passport_number?: string;
  nationality?: string;
  birth_date?: string;
  passport_expiry_date?: string;
};

export type ReservationWithTouristsInput = {
  reservation_number: string;
  currency: number;
  status: string;
  agency?: number | null;
  customer?: number | null;
  user?: number | null;
  tour_package?: number | null;
  tourists: ReservationTouristPayload[];
};

export type TouristListParams = {
  reservationId?: number;
};

type TouristRecord = Record<string, unknown>;

function touristsEndpoint(scope: ApiScope) {
  return `${API_V1}/reservations/${scope}/tourists/`;
}

function touristDetailEndpoint(scope: ApiScope, touristId: number) {
  return `${touristsEndpoint(scope)}${touristId}/`;
}

function reservationsEndpoint(scope: ApiScope) {
  return `${API_V1}/reservations/${scope}/reservations/`;
}

function reservationDetailEndpoint(scope: ApiScope, reservationId: number) {
  return `${reservationsEndpoint(scope)}${reservationId}/`;
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

function getReservationId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const nestedId = (value as { id?: unknown }).id;
    return getReservationId(nestedId);
  }

  return null;
}

function normalizeTouristRecord(item: unknown, reservationId?: number): Tourist | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const row = item as TouristRecord;
  const id = getReservationId(row.id);
  const resolvedReservation = getReservationId(row.reservation) ?? reservationId ?? null;

  if (!id || !resolvedReservation) {
    return null;
  }

  return {
    id,
    reservation: resolvedReservation,
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    sex: (row.sex === "FEMALE" ? "FEMALE" : "MALE") as TouristSex,
    age_type:
      row.age_type === "CHILD" ? "CHILD" : row.age_type === "INFANT" ? "INFANT" : "ADULT",
    passport_number: String(row.passport_number ?? ""),
    nationality: String(row.nationality ?? ""),
    birth_date: typeof row.birth_date === "string" ? row.birth_date : null,
    passport_expiry_date:
      typeof row.passport_expiry_date === "string" ? row.passport_expiry_date : null,
  };
}

function normalizeTouristArray(payload: unknown, reservationId?: number): Tourist[] {
  return normalizeList<unknown>(payload)
    .map((item) => normalizeTouristRecord(item, reservationId))
    .filter((item): item is Tourist => item !== null);
}

function readTouristsFromReservation(payload: unknown, reservationId: number): Tourist[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const row = payload as TouristRecord;
  const candidates = [row.tourists, row.tourist_list, row.reservation_tourists, row.data];

  for (const candidate of candidates) {
    const normalized = normalizeTouristArray(candidate, reservationId);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

export async function listTourists(scope: ApiScope, params: TouristListParams = {}): Promise<Tourist[]> {
  const reservationId = params.reservationId;

  if (!reservationId) {
    const response = await axiosInstance.get(touristsEndpoint(scope));
    return normalizeTouristArray(response.data);
  }

  const filterParamCandidates: Array<Record<string, number>> = [
    { reservation: reservationId },
    { reservation_id: reservationId },
    { reservationId },
  ];

  for (const candidateParams of filterParamCandidates) {
    try {
      const response = await axiosInstance.get(touristsEndpoint(scope), {
        params: candidateParams,
      });

      const rows = normalizeTouristArray(response.data, reservationId);
      const related = rows.filter((row) => row.reservation === reservationId);

      if (related.length > 0) {
        return related;
      }
    } catch {
      continue;
    }
  }

  try {
    const detailResponse = await axiosInstance.get(reservationDetailEndpoint(scope, reservationId));
    return readTouristsFromReservation(detailResponse.data, reservationId);
  } catch {
    return [];
  }
}

export async function getTourist(scope: ApiScope, touristId: number): Promise<Tourist> {
  const response = await axiosInstance.get(touristDetailEndpoint(scope, touristId));
  return response.data as Tourist;
}

export async function createTourist(scope: ApiScope, payload: TouristInput): Promise<Tourist> {
  const response = await axiosInstance.post(touristsEndpoint(scope), payload);
  return response.data as Tourist;
}

export async function updateTourist(
  scope: ApiScope,
  touristId: number,
  payload: Partial<TouristInput>
): Promise<Tourist> {
  const response = await axiosInstance.patch(touristDetailEndpoint(scope, touristId), payload);
  return response.data as Tourist;
}

export async function deleteTourist(scope: ApiScope, touristId: number): Promise<void> {
  await axiosInstance.delete(touristDetailEndpoint(scope, touristId));
}

export async function createReservationWithTourists(
  scope: ApiScope,
  payload: ReservationWithTouristsInput
) {
  const response = await axiosInstance.post(reservationsEndpoint(scope), payload);
  return response.data;
}

export async function updateReservationWithTourists(
  scope: ApiScope,
  reservationId: number,
  payload: Partial<ReservationWithTouristsInput>
) {
  const response = await axiosInstance.patch(reservationDetailEndpoint(scope, reservationId), payload);
  return response.data;
}
