import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

export interface TransferInventoryItem {
  id: number;
  provider: number;
  providerName: string;
  name: string;
  name_en: string | null;
  name_tr: string | null;
  name_ru: string | null;
  from_location: string;
  from_location_en: string | null;
  from_location_tr: string | null;
  from_location_ru: string | null;
  to_location: string;
  to_location_en: string | null;
  to_location_tr: string | null;
  to_location_ru: string | null;
  vehicle_type: string;
  vehicle_type_en: string | null;
  vehicle_type_tr: string | null;
  vehicle_type_ru: string | null;
  capacity: number | null;
  currency: number | null;
  currencyCode: string;
  public_price: string | null;
  agency_price: string | null;
}

export interface TransferInventoryInput {
  provider: number;
  name: string;
  name_en?: string | null;
  name_tr?: string | null;
  name_ru?: string | null;
  from_location: string;
  from_location_en?: string | null;
  from_location_tr?: string | null;
  from_location_ru?: string | null;
  to_location: string;
  to_location_en?: string | null;
  to_location_tr?: string | null;
  to_location_ru?: string | null;
  vehicle_type: string;
  vehicle_type_en?: string | null;
  vehicle_type_tr?: string | null;
  vehicle_type_ru?: string | null;
  capacity?: number | null;
  currency?: number | null;
  public_price?: string | null;
  agency_price?: string | null;
}

export interface PaginatedTransferInventory {
  count: number;
  next: string | null;
  previous: string | null;
  results: TransferInventoryItem[];
}

export interface TransferInventoryListParams {
  provider?: number | string;
  currency?: number | string;
  page?: number;
  page_size?: number;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function extractId(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object") {
    const r = v as Record<string, unknown>;
    return extractId(r.id);
  }
  return null;
}

function extractLabel(v: unknown, fallback = ""): string {
  if (!v || typeof v !== "object") return fallback;
  const r = v as Record<string, unknown>;
  return String(r.name ?? r.name_en ?? r.title ?? fallback);
}

function extractCode(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const r = v as Record<string, unknown>;
  return String(r.code ?? r.iso_code ?? "");
}

function normalizeTransferItem(row: unknown): TransferInventoryItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "number" ? r.id : Number(r.id);
  if (!id) return null;

  const providerId = extractId(r.provider);
  const currencyId = extractId(r.currency);

  return {
    id,
    provider: providerId ?? 0,
    providerName: typeof r.provider === "object" ? extractLabel(r.provider) : String(r.provider ?? ""),
    name: String(r.name ?? ""),
    name_en: str(r.name_en),
    name_tr: str(r.name_tr),
    name_ru: str(r.name_ru),
    from_location: String(r.from_location ?? ""),
    from_location_en: str(r.from_location_en),
    from_location_tr: str(r.from_location_tr),
    from_location_ru: str(r.from_location_ru),
    to_location: String(r.to_location ?? ""),
    to_location_en: str(r.to_location_en),
    to_location_tr: str(r.to_location_tr),
    to_location_ru: str(r.to_location_ru),
    vehicle_type: String(r.vehicle_type ?? ""),
    vehicle_type_en: str(r.vehicle_type_en),
    vehicle_type_tr: str(r.vehicle_type_tr),
    vehicle_type_ru: str(r.vehicle_type_ru),
    capacity: typeof r.capacity === "number" ? r.capacity : r.capacity != null ? Number(r.capacity) : null,
    currency: currencyId,
    currencyCode: typeof r.currency === "object" ? extractCode(r.currency) : "",
    public_price: str(r.public_price),
    agency_price: str(r.agency_price),
  };
}

export async function listTransferInventory(
  params?: TransferInventoryListParams
): Promise<PaginatedTransferInventory> {
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminTransfers, { params });
  const data = response.data as Record<string, unknown>;

  if (data && typeof data === "object" && Array.isArray(data.results)) {
    return {
      count: typeof data.count === "number" ? data.count : 0,
      next: typeof data.next === "string" ? data.next : null,
      previous: typeof data.previous === "string" ? data.previous : null,
      results: (data.results as unknown[])
        .map(normalizeTransferItem)
        .filter((r): r is TransferInventoryItem => r !== null),
    };
  }

  const rows = Array.isArray(response.data) ? (response.data as unknown[]) : [];
  return {
    count: rows.length,
    next: null,
    previous: null,
    results: rows.map(normalizeTransferItem).filter((r): r is TransferInventoryItem => r !== null),
  };
}

export async function getTransferInventoryItem(id: number): Promise<TransferInventoryItem> {
  const response = await axiosInstance.get(`${INVENTORY_ENDPOINTS.adminTransfers}${id}/`);
  const normalized = normalizeTransferItem(response.data);
  if (!normalized) throw new Error("Unable to normalize transfer response.");
  return normalized;
}

export async function createTransferInventoryItem(
  payload: TransferInventoryInput
): Promise<TransferInventoryItem> {
  const response = await axiosInstance.post(INVENTORY_ENDPOINTS.adminTransfers, payload);
  const normalized = normalizeTransferItem(response.data);
  if (!normalized) throw new Error("Unable to normalize transfer response.");
  return normalized;
}

export async function updateTransferInventoryItem(
  id: number,
  payload: Partial<TransferInventoryInput>
): Promise<TransferInventoryItem> {
  const response = await axiosInstance.patch(`${INVENTORY_ENDPOINTS.adminTransfers}${id}/`, payload);
  const normalized = normalizeTransferItem(response.data);
  if (!normalized) throw new Error("Unable to normalize transfer response.");
  return normalized;
}

export async function deleteTransferInventoryItem(id: number): Promise<void> {
  await axiosInstance.delete(`${INVENTORY_ENDPOINTS.adminTransfers}${id}/`);
}
