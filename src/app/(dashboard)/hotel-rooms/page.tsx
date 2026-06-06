"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AxiosError } from "axios";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import {
  createHotelRoom,
  deleteHotelRoom,
  listHotelRooms,
  updateHotelRoom,
  type HotelRoom,
} from "@/lib/api/hotel-rooms";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";

// ─── Types ───────────────────────────────────────────────────────────────────

type HotelOption = { id: string; label: string };
type CurrencyOption = { id: string; label: string };

const ROOM_TYPES = ["SINGLE", "DOUBLE", "TRIPLE", "FAMILY", "SUITE"] as const;
const BOARD_TYPES = ["RO", "BB", "HB", "FB", "ALL", "UALL"] as const;

const ROOM_TYPE_LABELS: Record<string, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TRIPLE: "Triple",
  FAMILY: "Family",
  SUITE: "Suite",
};

const BOARD_TYPE_LABELS: Record<string, string> = {
  RO: "RO – Room Only",
  BB: "BB – Bed & Breakfast",
  HB: "HB – Half Board",
  FB: "FB – Full Board",
  ALL: "All Inclusive",
  UALL: "Ultra All Inclusive",
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const roomSchema = z.object({
  room_type: z.string().min(1, "Room type is required."),
  board_type: z.string().min(1, "Board type is required."),
  date_from: z.string().min(1, "Date from is required."),
  date_to: z.string().min(1, "Date to is required."),
  availability_count: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, "Must be a non-negative integer."),
  currency: z.string().min(1, "Currency is required."),
  public_price: z.string().min(1, "Public price is required."),
  agency_price: z.string(),
  cost_price: z.string(),
  note: z.string(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeHotelList(payload: unknown): HotelOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return (rows as Record<string, unknown>[])
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      label:
        (typeof row.name === "string" && row.name) ||
        (typeof row.name_en === "string" && row.name_en) ||
        String(row.id ?? ""),
    }))
    .filter((opt) => opt.id.length > 0);
}

function normalizeCurrencyList(payload: unknown): CurrencyOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return (rows as Record<string, unknown>[])
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const code =
        (typeof row.code === "string" && row.code) ||
        (typeof row.iso_code === "string" && row.iso_code) ||
        "";
      const name = (typeof row.name_en === "string" && row.name_en) || (typeof row.name === "string" && row.name) || "";
      return {
        id: String(row.id ?? ""),
        label: code && name ? `${code} – ${name}` : code || String(row.id ?? ""),
      };
    })
    .filter((opt) => opt.id.length > 0);
}

function emptyForm(): RoomFormValues {
  return {
    room_type: "",
    board_type: "",
    date_from: "",
    date_to: "",
    availability_count: "1",
    currency: "",
    public_price: "",
    agency_price: "",
    cost_price: "",
    note: "",
  };
}

function roomToForm(room: HotelRoom): RoomFormValues {
  return {
    room_type: room.room_type,
    board_type: room.board_type,
    date_from: room.date_from,
    date_to: room.date_to,
    availability_count: String(room.availability_count),
    currency: String(room.currency),
    public_price: room.public_price,
    agency_price: room.agency_price ?? "",
    cost_price: room.cost_price ?? "",
    note: room.note,
  };
}

// ─── Room Form Modal ──────────────────────────────────────────────────────────

function RoomFormModal({
  hotelId,
  editingRoom,
  currencyOptions,
  defaultCurrencyId,
  onSuccess,
  onClose,
}: {
  hotelId: string;
  editingRoom: HotelRoom | null;
  currencyOptions: CurrencyOption[];
  defaultCurrencyId: string;
  onSuccess: (room: HotelRoom) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<RoomFormValues>(() =>
    editingRoom
      ? roomToForm(editingRoom)
      : { ...emptyForm(), currency: defaultCurrencyId }
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const update = <K extends keyof RoomFormValues>(key: K, value: RoomFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = roomSchema.safeParse(values);
    if (!validation.success) {
      const nextErrors: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        hotel: Number(hotelId),
        room_type: validation.data.room_type as HotelRoom["room_type"],
        board_type: validation.data.board_type as HotelRoom["board_type"],
        date_from: validation.data.date_from,
        date_to: validation.data.date_to,
        availability_count: Number(validation.data.availability_count),
        currency: Number(validation.data.currency),
        public_price: validation.data.public_price,
        agency_price: validation.data.agency_price.trim() || null,
        cost_price: validation.data.cost_price.trim() || null,
        note: validation.data.note,
      };

      const result = editingRoom
        ? await updateHotelRoom(editingRoom.id, payload)
        : await createHotelRoom(payload);

      onSuccess(result);
    } catch (error) {
      const mapped = mapBackendValidationErrors((error as AxiosError)?.response?.data);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      } else {
        setFormError("Unable to save room. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingRoom ? "Edit Room" : "Add Room"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <form id="room-form" onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="room_type" className="mb-1 block text-[11px] font-medium text-slate-600">
                Room Type
              </label>
              <select
                id="room_type"
                value={values.room_type}
                onChange={(e) => update("room_type", e.target.value)}
                className={inputCls}
              >
                <option value="">Select type</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ROOM_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
              {fieldErrors.room_type ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.room_type}</p> : null}
            </div>

            <div>
              <label htmlFor="board_type" className="mb-1 block text-[11px] font-medium text-slate-600">
                Board Type
              </label>
              <select
                id="board_type"
                value={values.board_type}
                onChange={(e) => update("board_type", e.target.value)}
                className={inputCls}
              >
                <option value="">Select board</option>
                {BOARD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BOARD_TYPE_LABELS[b] ?? b}
                  </option>
                ))}
              </select>
              {fieldErrors.board_type ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.board_type}</p> : null}
            </div>

            <div>
              <label htmlFor="date_from" className="mb-1 block text-[11px] font-medium text-slate-600">
                Date From
              </label>
              <input
                id="date_from"
                type="date"
                value={values.date_from}
                onChange={(e) => update("date_from", e.target.value)}
                className={inputCls}
              />
              {fieldErrors.date_from ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.date_from}</p> : null}
            </div>

            <div>
              <label htmlFor="date_to" className="mb-1 block text-[11px] font-medium text-slate-600">
                Date To
              </label>
              <input
                id="date_to"
                type="date"
                value={values.date_to}
                onChange={(e) => update("date_to", e.target.value)}
                className={inputCls}
              />
              {fieldErrors.date_to ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.date_to}</p> : null}
            </div>

            <div>
              <label htmlFor="availability_count" className="mb-1 block text-[11px] font-medium text-slate-600">
                Availability Count
              </label>
              <input
                id="availability_count"
                type="number"
                min="0"
                step="1"
                value={values.availability_count}
                onChange={(e) => update("availability_count", e.target.value)}
                className={inputCls}
              />
              {fieldErrors.availability_count ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.availability_count}</p> : null}
            </div>

            <div>
              <label htmlFor="currency" className="mb-1 block text-[11px] font-medium text-slate-600">
                Currency
              </label>
              <select
                id="currency"
                value={values.currency}
                onChange={(e) => update("currency", e.target.value)}
                className={inputCls}
              >
                <option value="">Select currency</option>
                {currencyOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fieldErrors.currency ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.currency}</p> : null}
            </div>

            <div>
              <label htmlFor="public_price" className="mb-1 block text-[11px] font-medium text-slate-600">
                Public Price
              </label>
              <input
                id="public_price"
                type="number"
                min="0"
                step="0.01"
                value={values.public_price}
                onChange={(e) => update("public_price", e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
              {fieldErrors.public_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.public_price}</p> : null}
            </div>

            <div>
              <label htmlFor="agency_price" className="mb-1 block text-[11px] font-medium text-slate-600">
                Agency Price <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="agency_price"
                type="number"
                min="0"
                step="0.01"
                value={values.agency_price}
                onChange={(e) => update("agency_price", e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
              {fieldErrors.agency_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.agency_price}</p> : null}
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
              <label htmlFor="cost_price" className="mb-1 block text-[11px] font-medium text-slate-600">
                Cost Price{" "}
                <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                  🔒 Internal
                </span>
              </label>
              <input
                id="cost_price"
                type="number"
                min="0"
                step="0.01"
                value={values.cost_price}
                onChange={(e) => update("cost_price", e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
              {fieldErrors.cost_price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.cost_price}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="note" className="mb-1 block text-[11px] font-medium text-slate-600">
                Note <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="note"
                rows={2}
                value={values.note}
                onChange={(e) => update("note", e.target.value)}
                className={inputCls}
                placeholder="Internal notes about this room..."
              />
              {fieldErrors.note ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.note}</p> : null}
            </div>

            {formError ? (
              <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p>
            ) : null}
          </form>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="room-form"
            disabled={isSubmitting}
            className="rounded-md border border-[#0f2347] bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : editingRoom ? "Update Room" : "Add Room"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function HotelRoomsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialHotelId = searchParams.get("hotel") ?? "";

  const [selectedHotelId, setSelectedHotelId] = useState(initialHotelId);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HotelRoom | null>(null);

  // Fetch hotels and currencies once on mount
  useEffect(() => {
    void (async () => {
      try {
        const [hotelsRes, currenciesRes] = await Promise.all([
          axiosInstance.get(INVENTORY_ENDPOINTS.adminHotels),
          axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies),
        ]);
        setHotels(normalizeHotelList(hotelsRes.data));
        setCurrencyOptions(normalizeCurrencyList(currenciesRes.data));
      } catch {
        setPageError("Failed to load hotels or currencies.");
      }
    })();
  }, []);

  const fetchRooms = useCallback(async (hotelId: string) => {
    if (!hotelId) {
      setRooms([]);
      return;
    }
    setLoading(true);
    setPageError("");
    try {
      const data = await listHotelRooms(Number(hotelId));
      setRooms(data);
    } catch {
      setPageError("Failed to load rooms.");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms(selectedHotelId);
  }, [selectedHotelId, fetchRooms]);

  const handleHotelChange = (hotelId: string) => {
    setSelectedHotelId(hotelId);
    router.replace(hotelId ? `/hotel-rooms?hotel=${hotelId}` : "/hotel-rooms", { scroll: false });
  };

  const handleDelete = async (room: HotelRoom) => {
    if (!window.confirm(`Delete this ${room.room_type}/${room.board_type} room?`)) return;
    try {
      await deleteHotelRoom(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch {
      setPageError("Failed to delete room.");
    }
  };

  const openAdd = () => {
    setEditingRoom(null);
    setIsModalOpen(true);
  };

  const openEdit = (room: HotelRoom) => {
    setEditingRoom(room);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (room: HotelRoom) => {
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.id === room.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = room;
        return next;
      }
      return [...prev, room];
    });
    setIsModalOpen(false);
  };

  const selectedHotelLabel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId)?.label ?? "",
    [hotels, selectedHotelId]
  );

  const defaultCurrencyId = currencyOptions[0]?.id ?? "";

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Hotel Rooms</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage room types, board types, pricing and availability per hotel.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={!selectedHotelId}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add Room
        </button>
      </div>

      {/* Hotel filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="hotel-filter" className="shrink-0 text-xs font-medium text-slate-600">
          Hotel
        </label>
        <select
          id="hotel-filter"
          value={selectedHotelId}
          onChange={(e) => handleHotelChange(e.target.value)}
          className="w-64 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Select hotel to view rooms</option>
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
        {selectedHotelLabel ? (
          <span className="text-xs text-slate-500">
            {rooms.length} room{rooms.length !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {pageError ? <p className="text-xs font-medium text-red-600">{pageError}</p> : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[68vh] overflow-auto">
          {!selectedHotelId ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Select a hotel above to view its rooms.</p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Loading rooms...</p>
          ) : rooms.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No rooms found for this hotel.{" "}
              <button type="button" onClick={openAdd} className="font-semibold text-slate-600 underline hover:text-slate-900">
                Add the first room.
              </button>
            </p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Room Type</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Board Type</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Date From</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Date To</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Availability</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Public Price</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Agency Price</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Cost Price</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Note</th>
                  <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  const currencyLabel =
                    currencyOptions.find((c) => c.id === String(room.currency))?.label?.split(" – ")[0] ?? "";
                  return (
                    <tr
                      key={room.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                    >
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-800">
                        {ROOM_TYPE_LABELS[room.room_type] ?? room.room_type}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                        {room.board_type}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{room.date_from}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{room.date_to}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{room.availability_count}</td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                        {room.public_price} {currencyLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                        {room.agency_price ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-500 italic">
                        {room.cost_price ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-500 max-w-[140px] truncate">
                        {room.note || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(room)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(room)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && selectedHotelId ? (
        <RoomFormModal
          hotelId={selectedHotelId}
          editingRoom={editingRoom}
          currencyOptions={currencyOptions}
          defaultCurrencyId={defaultCurrencyId}
          onSuccess={handleModalSuccess}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotelRoomsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-xs text-slate-500">Loading...</p>}>
      <HotelRoomsContent />
    </Suspense>
  );
}
