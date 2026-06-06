import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

export type HotelRoom = {
  id: number;
  hotel: number;
  room_type: "SINGLE" | "DOUBLE" | "TRIPLE" | "FAMILY" | "SUITE";
  board_type: "RO" | "BB" | "HB" | "FB" | "ALL" | "UALL";
  date_from: string;
  date_to: string;
  availability_count: number;
  currency: number;
  public_price: string;
  agency_price: string | null;
  cost_price: string | null;
  note: string;
};

export type HotelRoomInput = {
  hotel: number;
  room_type: HotelRoom["room_type"];
  board_type: HotelRoom["board_type"];
  date_from: string;
  date_to: string;
  availability_count: number;
  currency: number;
  public_price: string;
  agency_price?: string | null;
  cost_price?: string | null;
  note?: string;
};

function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: unknown[] }).results;
  }
  return [];
}

function normalizeHotelRoom(row: unknown): HotelRoom | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const id = typeof value.id === "number" ? value.id : Number(value.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const hotelRaw = value.hotel;
  const hotel =
    typeof hotelRaw === "number"
      ? hotelRaw
      : typeof hotelRaw === "object" && hotelRaw !== null
        ? Number((hotelRaw as Record<string, unknown>).id ?? 0)
        : Number(hotelRaw ?? 0);

  const currencyRaw = value.currency;
  const currency =
    typeof currencyRaw === "number"
      ? currencyRaw
      : typeof currencyRaw === "object" && currencyRaw !== null
        ? Number((currencyRaw as Record<string, unknown>).id ?? 0)
        : Number(currencyRaw ?? 0);

  return {
    id,
    hotel,
    room_type: String(value.room_type ?? "") as HotelRoom["room_type"],
    board_type: String(value.board_type ?? "") as HotelRoom["board_type"],
    date_from: String(value.date_from ?? ""),
    date_to: String(value.date_to ?? ""),
    availability_count: typeof value.availability_count === "number" ? value.availability_count : Number(value.availability_count ?? 0),
    currency,
    public_price: String(value.public_price ?? "0.00"),
    agency_price: value.agency_price != null ? String(value.agency_price) : null,
    cost_price: value.cost_price != null ? String(value.cost_price) : null,
    note: String(value.note ?? ""),
  };
}

export type RoomAvailability = {
  hotel_room: number;
  check_in: string;
  check_out: string;
  total_count: number;
  confirmed_count: number;
  pending_count: number;
  booked_count: number;
  available_count: number;
};

export async function fetchRoomAvailability(
  roomId: number,
  checkIn: string,
  checkOut: string
): Promise<RoomAvailability> {
  const response = await axiosInstance.get(
    INVENTORY_ENDPOINTS.adminHotelRoomAvailability(roomId, checkIn, checkOut)
  );
  return response.data as RoomAvailability;
}

export async function listHotelRooms(hotelId?: number): Promise<HotelRoom[]> {
  const params = hotelId != null ? { hotel: hotelId } : undefined;
  const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminHotelRooms, { params });
  return normalizeList(response.data)
    .map(normalizeHotelRoom)
    .filter((room): room is HotelRoom => room !== null);
}

export async function createHotelRoom(payload: HotelRoomInput): Promise<HotelRoom> {
  const response = await axiosInstance.post(INVENTORY_ENDPOINTS.adminHotelRooms, payload);
  const normalized = normalizeHotelRoom(response.data);
  if (!normalized) throw new Error("Unable to normalize hotel room response.");
  return normalized;
}

export async function updateHotelRoom(id: number, payload: Partial<HotelRoomInput>): Promise<HotelRoom> {
  const response = await axiosInstance.patch(`${INVENTORY_ENDPOINTS.adminHotelRooms}${id}/`, payload);
  const normalized = normalizeHotelRoom(response.data);
  if (!normalized) throw new Error("Unable to normalize hotel room response.");
  return normalized;
}

export async function deleteHotelRoom(id: number): Promise<void> {
  await axiosInstance.delete(`${INVENTORY_ENDPOINTS.adminHotelRooms}${id}/`);
}
