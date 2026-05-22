import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

export type TourPackagePayload = {
  name: string;
  destination: string;
  days: number;
  nights: number;
  public_price: string;
  agency_price: string;
  name_en?: string;
  name_tr?: string;
  name_ru?: string;
  destination_en?: string;
  destination_tr?: string;
  destination_ru?: string;
};

export type TourPackageResponse = {
  id: number;
  name: string;
  destination: string;
  days: number;
  nights: number;
  public_price: string;
  agency_price: string;
  name_en?: string;
  name_tr?: string;
  name_ru?: string;
  destination_en?: string;
  destination_tr?: string;
  destination_ru?: string;
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

export async function createTourPackage(payload: TourPackagePayload): Promise<TourPackageResponse> {
  const response = await axiosInstance.post(INVENTORY_ENDPOINTS.adminTourPackages, payload, {
    headers: authHeaders(),
  });

  return response.data as TourPackageResponse;
}

export async function updateTourPackage(
  id: number,
  payload: Partial<TourPackagePayload>
): Promise<TourPackageResponse> {
  const response = await axiosInstance.patch(`${INVENTORY_ENDPOINTS.adminTourPackages}${id}/`, payload, {
    headers: authHeaders(),
  });

  return response.data as TourPackageResponse;
}

export async function listAdminTourPackages(): Promise<TourPackageResponse[]> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTourPackages, {
    headers: authHeaders(),
  });

  return normalizeList(response.data);
}

