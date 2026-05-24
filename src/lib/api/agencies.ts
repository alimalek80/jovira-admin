import axios from "axios";
import axiosInstance from "@/lib/axios";
import { AGENCIES_ENDPOINTS } from "@/lib/api-endpoints";

export type Agency = {
  id: number;
  name: string;
  agency_type: string;
  contact_person: string;
  email: string;
  phone: string;
  mobile_phone: string;
  skype_id: string;
  icq: string;
  is_approved: boolean;
  approved_at: string | null;
};

export type AgencyUpdatePayload = {
  name: string;
  agency_type: string;
  contact_person: string;
  email: string;
  phone: string;
  mobile_phone: string;
  skype_id: string;
  icq: string;
};

function normalizeAgency(row: Record<string, unknown>): Agency | null {
  const id = row.id;

  if (typeof id !== "number") {
    return null;
  }

  return {
    id,
    name: typeof row.name === "string" ? row.name : "",
    agency_type: typeof row.agency_type === "string" ? row.agency_type : "",
    contact_person: typeof row.contact_person === "string" ? row.contact_person : "",
    email: typeof row.email === "string" ? row.email : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    mobile_phone: typeof row.mobile_phone === "string" ? row.mobile_phone : "",
    skype_id: typeof row.skype_id === "string" ? row.skype_id : "",
    icq: typeof row.icq === "string" ? row.icq : "",
    is_approved: row.is_approved === true,
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
  };
}

function normalizeAgencyList(payload: unknown): Agency[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map(normalizeAgency)
    .filter((row): row is Agency => row !== null);
}

function resolveApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const detail = record.detail;
      const message = record.message;

      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function listAdminAgencies(): Promise<Agency[]> {
  try {
    const response = await axiosInstance.get(AGENCIES_ENDPOINTS.adminAgencies);
    return normalizeAgencyList(response.data);
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, "Unable to load agencies."));
  }
}

export async function approveAgency(id: number): Promise<void> {
  try {
    await axiosInstance.post(`${AGENCIES_ENDPOINTS.adminAgencies}${id}/approve/`);
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, "Unable to approve agency."));
  }
}

export async function updateAgency(id: number, payload: AgencyUpdatePayload): Promise<Agency> {
  try {
    const response = await axiosInstance.patch(`${AGENCIES_ENDPOINTS.adminAgencies}${id}/`, payload);
    const normalized = normalizeAgency(response.data as Record<string, unknown>);

    if (!normalized) {
      throw new Error("Invalid agency response.");
    }

    return normalized;
  } catch (error) {
    throw new Error(resolveApiErrorMessage(error, "Unable to update agency."));
  }
}