import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

export type ProviderType = "COMPANY" | "INDIVIDUAL";

export interface TransferProvider {
  id: number;
  name: string;
  provider_type: ProviderType;
  contact_person: string;
  phone: string;
  email: string;
  notes: string;
}

export interface TransferProviderInput {
  name: string;
  provider_type: ProviderType;
  contact_person?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface PaginatedTransferProviders {
  count: number;
  next: string | null;
  previous: string | null;
  results: TransferProvider[];
}

export interface TransferProviderListParams {
  provider_type?: ProviderType | "";
  page?: number;
  page_size?: number;
}

function normalizeTransferProvider(row: unknown): TransferProvider | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "number" ? r.id : typeof r.id === "string" ? Number(r.id) : 0;
  if (!id) return null;
  return {
    id,
    name: String(r.name ?? ""),
    provider_type: (r.provider_type as ProviderType) ?? "COMPANY",
    contact_person: String(r.contact_person ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function listTransferProviders(
  params?: TransferProviderListParams
): Promise<PaginatedTransferProviders> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTransferProviders, { params });
  const data = response.data as Record<string, unknown>;

  if (data && typeof data === "object" && Array.isArray(data.results)) {
    return {
      count: typeof data.count === "number" ? data.count : 0,
      next: typeof data.next === "string" ? data.next : null,
      previous: typeof data.previous === "string" ? data.previous : null,
      results: (data.results as unknown[])
        .map(normalizeTransferProvider)
        .filter((r): r is TransferProvider => r !== null),
    };
  }

  const rows = Array.isArray(response.data) ? (response.data as unknown[]) : [];
  return {
    count: rows.length,
    next: null,
    previous: null,
    results: rows.map(normalizeTransferProvider).filter((r): r is TransferProvider => r !== null),
  };
}

export async function createTransferProvider(payload: TransferProviderInput): Promise<TransferProvider> {
  const response = await axiosInstance.post(INVENTORY_ENDPOINTS.adminTransferProviders, payload);
  const normalized = normalizeTransferProvider(response.data);
  if (!normalized) throw new Error("Unable to normalize transfer provider response.");
  return normalized;
}

export async function updateTransferProvider(
  id: number,
  payload: Partial<TransferProviderInput>
): Promise<TransferProvider> {
  const response = await axiosInstance.patch(
    `${INVENTORY_ENDPOINTS.adminTransferProviders}${id}/`,
    payload
  );
  const normalized = normalizeTransferProvider(response.data);
  if (!normalized) throw new Error("Unable to normalize transfer provider response.");
  return normalized;
}

export async function deleteTransferProvider(id: number): Promise<void> {
  await axiosInstance.delete(`${INVENTORY_ENDPOINTS.adminTransferProviders}${id}/`);
}
