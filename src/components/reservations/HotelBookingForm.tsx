"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { FINANCE_ENDPOINTS, INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import { createHotelBooking, type HotelBooking, updateHotelBooking } from "@/lib/api/reservation-services";
import { listHotelRooms, fetchRoomAvailability, type HotelRoom } from "@/lib/api/hotel-rooms";
import { listTourists } from "@/lib/api/tourists";

// ---- Schema ----------------------------------------------------------------

const schema = z.object({
  hotel: z.string().min(1, "Hotel is required."),
  hotel_room: z.string().min(1, "Hotel room is required."),
  check_in_date: z.string().min(1, "Check-in date is required."),
  check_out_date: z.string().min(1, "Check-out date is required."),
  quantity: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, "Must be >= 1."),
  status: z.string().min(1, "Status is required."),
  is_paid: z.boolean(),
  // Financials
  selling_currency: z.string(),
  price: z.string(),
  agency_price: z.string(),
  cost_currency: z.string(),
  cost: z.string(),
  cross_currency_rate: z.string(),
  // Tracking
  confirm_booking_number: z.string(),
  agent_confirmation_number: z.string(),
  hotel_cancellation_number: z.string(),
  // Notes
  internal_note: z.string(),
  remarks_for_hotel: z.string(),
  tourists: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

// ---- Helpers ----------------------------------------------------------------

type HotelOption = { id: string; label: string };
type CurrencyOption = { id: string; label: string };

function normalizeHotelOptions(payload: unknown): HotelOption[] {
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
        (typeof row.title === "string" && row.title) ||
        String(row.id ?? ""),
    }))
    .filter((opt) => opt.id.length > 0);
}

function normalizeCurrencyOptions(payload: unknown): CurrencyOption[] {
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
      const name =
        (typeof row.name_en === "string" && row.name_en) ||
        (typeof row.name === "string" && row.name) || "";
      return {
        id: String(row.id ?? ""),
        label: code && name ? `${code} - ${name}` : code || String(row.id ?? ""),
      };
    })
    .filter((opt) => opt.id.length > 0);
}

function roomOptionLabel(room: HotelRoom): string {
  return `${room.room_type} / ${room.board_type} [${room.date_from} - ${room.date_to}] (avail: ${room.availability_count})`;
}

function emptyValues(): FormValues {
  return {
    hotel: "",
    hotel_room: "",
    check_in_date: "",
    check_out_date: "",
    quantity: "1",
    status: "PENDING",
    is_paid: false,
    selling_currency: "",
    price: "",
    agency_price: "",
    cost_currency: "",
    cost: "",
    cross_currency_rate: "1.0000000000",
    confirm_booking_number: "",
    agent_confirmation_number: "",
    hotel_cancellation_number: "",
    internal_note: "",
    remarks_for_hotel: "",
    tourists: [],
  };
}

function bookingToValues(booking: HotelBooking, hotelId: string): FormValues {
  return {
    hotel: hotelId,
    hotel_room: String(booking.hotelRoomId ?? ""),
    check_in_date: booking.checkInDate?.slice(0, 10) ?? "",
    check_out_date: booking.checkOutDate?.slice(0, 10) ?? "",
    quantity: String(booking.quantity ?? 1),
    status: booking.status ?? "PENDING",
    is_paid: booking.isPaid ?? false,
    selling_currency: booking.sellingCurrencyId ?? "",
    price: booking.price ?? "",
    agency_price: booking.agencyPrice ?? "",
    cost_currency: booking.costCurrencyId ?? "",
    cost: booking.cost ?? "",
    cross_currency_rate: booking.crossCurrencyRate ?? "1.0000000000",
    confirm_booking_number: booking.confirmBookingNumber ?? "",
    agent_confirmation_number: booking.agentConfirmationNumber ?? "",
    hotel_cancellation_number: booking.hotelCancellationNumber ?? "",
    internal_note: booking.internalNote ?? "",
    remarks_for_hotel: booking.remarksForHotel ?? "",
    tourists: booking.tourists?.map(String) ?? [],
  };
}

// ---- Component --------------------------------------------------------------

export default function HotelBookingForm({
  reservationId,
  ownerType,
  booking,
  initialHotelId,
  onSuccess,
  onCancel,
}: {
  reservationId: number;
  ownerType?: "AGENCY" | "NORMAL";
  currencyOptions?: Array<{ id: string; label: string }>;
  reservationCurrencyId?: string;
  currencyCodeById?: Record<string, string>;
  booking?: HotelBooking;
  initialHotelId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();

  // On edit: use initialHotelId (passed from parent) to pre-populate hotel synchronously.
  // On create: start with empty values.
  const [values, setValues] = useState<FormValues>(() =>
    booking ? bookingToValues(booking, initialHotelId ?? "") : emptyValues()
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  // Track whether we are in edit mode so we do not overwrite existing financials.
  const isEditMode = Boolean(booking?.id);

  // ---- Data queries ----------------------------------------------------------

  const hotelsQuery = useQuery({
    queryKey: ["inventory-hotels", "admin"],
    queryFn: async () => {
      const res = await axiosInstance.get(INVENTORY_ENDPOINTS.adminHotels);
      return normalizeHotelOptions(res.data);
    },
  });

  const currenciesQuery = useQuery({
    queryKey: ["finance-currencies"],
    queryFn: async () => {
      const res = await axiosInstance.get(FINANCE_ENDPOINTS.adminCurrencies);
      return normalizeCurrencyOptions(res.data);
    },
  });

  const touristsQuery = useQuery({
    queryKey: ["tourists-for-reservation", reservationId],
    queryFn: async () => listTourists("admin", { reservationId }),
    staleTime: 30_000,
  });

  const hotelOptions = hotelsQuery.data ?? [];
  const currencyOptions = currenciesQuery.data ?? [];
  const availableTourists = touristsQuery.data ?? [];

  // If initialHotelId was not provided but we are editing, try to resolve the
  // hotel from the room detail as a fallback (fires only once, only when needed).
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (!booking?.hotelRoomId) return;
    if (values.hotel) return; // already set — nothing to do
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    void (async () => {
      try {
        const rooms = await listHotelRooms();
        const room = rooms.find((r) => r.id === booking.hotelRoomId);
        if (room) {
          setValues((prev) => ({ ...prev, hotel: String(room.hotel) }));
        }
      } catch {
        // User can select hotel manually.
      }
    })();
  }, [booking?.hotelRoomId, values.hotel]);

  const selectedHotelId = values.hotel;

  const roomsQuery = useQuery({
    queryKey: ["hotel-rooms", selectedHotelId],
    queryFn: async () => listHotelRooms(Number(selectedHotelId)),
    enabled: selectedHotelId.length > 0,
  });
  const roomOptions = roomsQuery.data ?? [];

  const selectedRoom = useMemo(
    () => roomOptions.find((r) => String(r.id) === values.hotel_room) ?? null,
    [roomOptions, values.hotel_room]
  );

  // Fetch real availability from the server when room + both dates are selected.
  const canFetchAvailability =
    values.hotel_room.length > 0 &&
    values.check_in_date.length > 0 &&
    values.check_out_date.length > 0;

  const availabilityQuery = useQuery({
    queryKey: ["room-availability", values.hotel_room, values.check_in_date, values.check_out_date],
    queryFn: () =>
      fetchRoomAvailability(
        Number(values.hotel_room),
        values.check_in_date,
        values.check_out_date
      ),
    enabled: canFetchAvailability,
    staleTime: 30_000,
  });

  const availability = availabilityQuery.data ?? null;

  // When editing, available_count already excludes the current booking on the server.
  // For the UI preview, subtract the quantity being entered to show what remains after save.
  const qty = Number(values.quantity);
  const availableAfterThis = availability
    ? availability.available_count - (Number.isFinite(qty) ? qty : 0)
    : null;

  // Auto-populate financials when room changes — only on new bookings.
  // On edit, the user's saved financials must not be overwritten.
  const prevRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEditMode) return;
    if (!selectedRoom) return;
    if (prevRoomIdRef.current === String(selectedRoom.id)) return;
    prevRoomIdRef.current = String(selectedRoom.id);

    const roomCurrencyId = String(selectedRoom.currency);
    const isAgency = ownerType === "AGENCY";
    const autoPrice = isAgency
      ? (selectedRoom.agency_price ?? selectedRoom.public_price)
      : selectedRoom.public_price;

    setValues((prev) => ({
      ...prev,
      selling_currency: roomCurrencyId,
      price: autoPrice ?? "",
      agency_price: selectedRoom.agency_price ?? "",
      cost_currency: roomCurrencyId,
      cost: selectedRoom.cost_price ?? "",
    }));
  }, [selectedRoom, ownerType, isEditMode]);

  // ---- Helpers ---------------------------------------------------------------

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ---- Mutation --------------------------------------------------------------

  const mutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const numOrNull = (v: string) => {
        const n = Number(v);
        return v.trim() && Number.isFinite(n) ? n : null;
      };
      const strOrNull = (v: string) => v.trim() || null;

      const requestPayload = {
        reservation: reservationId,
        hotel_room: Number(payload.hotel_room),
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        quantity: Number(payload.quantity),
        status: payload.status as "PENDING" | "CONFIRMED" | "CANCELLED",
        is_paid: payload.is_paid,
        selling_currency: numOrNull(payload.selling_currency),
        price: strOrNull(payload.price),
        agency_price: strOrNull(payload.agency_price),
        cost_currency: numOrNull(payload.cost_currency),
        cost: strOrNull(payload.cost),
        cross_currency_rate: payload.cross_currency_rate || "1.0000000000",
        confirm_booking_number: payload.confirm_booking_number,
        agent_confirmation_number: payload.agent_confirmation_number,
        hotel_cancellation_number: payload.hotel_cancellation_number,
        internal_note: payload.internal_note,
        remarks_for_hotel: payload.remarks_for_hotel,
        tourists: payload.tourists.map(Number).filter((n) => Number.isFinite(n) && n > 0),
      };

      if (booking?.id) {
        return updateHotelBooking("admin", booking.id, requestPayload);
      }
      return createHotelBooking("admin", requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "hotel", reservationId] });
      await queryClient.invalidateQueries({ queryKey: ["room-availability"] });
      onSuccess?.();
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = schema.safeParse(values);
    if (!validation.success) {
      const nextErrors: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    try {
      await mutation.mutateAsync(validation.data);
    } catch (error) {
      const mapped = mapBackendValidationErrors((error as AxiosError)?.response?.data);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
      } else {
        setFormError("Unable to save hotel booking.");
      }
    }
  };

  // ---- Section header --------------------------------------------------------
  function SectionHeading({ title }: { title: string }) {
    return (
      <div className="sm:col-span-2 border-b border-slate-200 pb-1 mt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      </div>
    );
  }

  // ---- Render ----------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">

      {/* ---- Section 1: Booking Info ---- */}
      <SectionHeading title="Booking Info" />

      {/* Hotel selector */}
      <div className="sm:col-span-2">
        <label htmlFor="hotel" className="mb-1 block text-[11px] font-medium text-slate-600">Hotel</label>
        <select
          id="hotel"
          value={values.hotel}
          onChange={(e) => { update("hotel", e.target.value); update("hotel_room", ""); }}
          disabled={hotelsQuery.isLoading}
          className={`${inputCls} disabled:cursor-wait disabled:opacity-60`}
        >
          <option value="">{hotelsQuery.isLoading ? "Loading hotels..." : "Select hotel"}</option>
          {hotelOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        {fieldErrors.hotel ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.hotel}</p> : null}
      </div>

      {/* Room selector */}
      <div className="sm:col-span-2">
        <label htmlFor="hotel_room" className="mb-1 block text-[11px] font-medium text-slate-600">Room</label>
        <select
          id="hotel_room"
          value={values.hotel_room}
          onChange={(e) => update("hotel_room", e.target.value)}
          disabled={!selectedHotelId || roomsQuery.isLoading}
          className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <option value="">
            {!selectedHotelId ? "Select a hotel first" : roomsQuery.isLoading ? "Loading rooms..." : roomOptions.length === 0 ? "No rooms available" : "Select room"}
          </option>
          {roomOptions.map((room) => (
            <option key={room.id} value={String(room.id)}>{roomOptionLabel(room)}</option>
          ))}
        </select>
        {availability ? (
          <p className="mt-1 text-[11px] text-slate-500">
            <span className={`font-semibold ${
              availability.available_count > 0 ? "text-emerald-700"
                : availability.pending_count > 0 ? "text-amber-600"
                : "text-red-600"
            }`}>
              {availability.available_count} available
            </span>
            {availability.pending_count > 0 ? (
              <span className="text-amber-600"> &middot; {availability.pending_count} pending</span>
            ) : null}
            {availability.confirmed_count > 0 ? (
              <span className="text-slate-500"> &middot; {availability.confirmed_count} confirmed</span>
            ) : null}
            <span className="text-slate-400"> (of {availability.total_count} total)</span>
            {availableAfterThis !== null && qty > 0 ? (
              <>
                {" "}&#8594; after save:{" "}
                <span className={`font-semibold ${
                  availableAfterThis < 0 ? "text-red-600" : availableAfterThis === 0 ? "text-amber-600" : "text-emerald-700"
                }`}>
                  {availableAfterThis}
                </span>
                {availableAfterThis < 0 ? <span className="text-red-600"> &#9888; exceeds availability</span> : null}
              </>
            ) : null}
          </p>
        ) : availabilityQuery.isLoading && canFetchAvailability ? (
          <p className="mt-1 text-[11px] text-slate-400">Checking availability...</p>
        ) : selectedRoom ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Total capacity: <span className="font-semibold text-slate-700">{selectedRoom.availability_count}</span> rooms
            {" · "}Select dates to see live availability.
          </p>
        ) : null}
        {fieldErrors.hotel_room ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.hotel_room}</p> : null}
      </div>

      {/* Dates */}
      <div>
        <label htmlFor="check_in_date" className="mb-1 block text-[11px] font-medium text-slate-600">Check-In Date</label>
        <input id="check_in_date" type="date" value={values.check_in_date} onChange={(e) => update("check_in_date", e.target.value)} className={inputCls} />
        {fieldErrors.check_in_date ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.check_in_date}</p> : null}
      </div>

      <div>
        <label htmlFor="check_out_date" className="mb-1 block text-[11px] font-medium text-slate-600">Check-Out Date</label>
        <input id="check_out_date" type="date" value={values.check_out_date} onChange={(e) => update("check_out_date", e.target.value)} className={inputCls} />
        {fieldErrors.check_out_date ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.check_out_date}</p> : null}
      </div>

      {/* Quantity */}
      <div>
        <label htmlFor="quantity" className="mb-1 block text-[11px] font-medium text-slate-600">Quantity</label>
        <input
          id="quantity"
          type="number"
          min="1"
          step="1"
          max={availability ? availability.available_count : undefined}
          value={values.quantity}
          onChange={(e) => update("quantity", e.target.value)}
          className={inputCls}
          placeholder="1"
        />
        {fieldErrors.quantity ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.quantity}</p> : null}
        {availability && qty > availability.available_count ? (
          <p className="mt-1 text-[11px] text-red-600">
            Only {availability.available_count} room{availability.available_count !== 1 ? "s" : ""} available for these dates.
          </p>
        ) : null}
      </div>

      {/* Paid checkbox */}
      <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <input type="checkbox" checked={values.is_paid} onChange={(e) => update("is_paid", e.target.checked)} />
        Paid
      </label>

      {/* Status */}
      <div className="sm:col-span-2">
        <label htmlFor="status" className="mb-1 block text-[11px] font-medium text-slate-600">Status</label>
        <select
          id="status"
          value={values.status}
          onChange={(e) => update("status", e.target.value)}
          className={inputCls}
        >
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {values.status === "CANCELLED" ? (
          <p className="mt-1 text-[11px] text-amber-600">Saving as Cancelled will restore room availability.</p>
        ) : null}
      </div>

      {/* ---- Section: Assigned Tourists ---- */}
      <SectionHeading title="Assigned Tourists" />

      <div className="sm:col-span-2">
        <label className="mb-2 block text-[11px] font-medium text-slate-600">
          Assign Tourists to this Room
        </label>
        
        {(() => {
          const ROOM_CAPACITY_MAP: Record<string, number> = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3, FAMILY: 4, SUITE: 4 };
          const baseCapacity = selectedRoom ? (ROOM_CAPACITY_MAP[selectedRoom.room_type] ?? 2) : 2;
          const maxCapacity = (Number.isFinite(qty) ? qty : 0) * baseCapacity;
          const currentCount = values.tourists.length;

          return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Select Tourists</span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${currentCount > maxCapacity ? "bg-red-100 text-red-700" : currentCount === maxCapacity ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                  {currentCount} / {maxCapacity} Assigned
                </span>
              </div>
              
              {touristsQuery.isLoading ? (
                <p className="text-xs text-slate-500">Loading tourists...</p>
              ) : availableTourists.length === 0 ? (
                <p className="text-xs text-slate-500">No tourists found for this reservation.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {availableTourists.map((t) => {
                    const tid = String(t.id);
                    const isSelected = values.tourists.includes(tid);
                    const isDisabled = !isSelected && currentCount >= maxCapacity;
                    return (
                      <label key={t.id} className={`flex items-start gap-2 rounded border p-2 ${isSelected ? "border-amber-300 bg-amber-50" : isDisabled ? "border-slate-100 opacity-50 cursor-not-allowed" : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              update("tourists", [...values.tourists, tid]);
                            } else {
                              update("tourists", values.tourists.filter((id) => id !== tid));
                            }
                          }}
                        />
                        <span className="text-xs font-medium text-slate-800 line-clamp-2">
                          {t.first_name} {t.last_name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {currentCount > maxCapacity ? (
                <p className="mt-2 text-[11px] text-red-600">You have selected more tourists than the room's maximum capacity.</p>
              ) : null}
            </div>
          );
        })()}
      </div>

      {/* ---- Section 2: Financials ---- */}
      <SectionHeading title="Financials" />

      <div>
        <label htmlFor="selling_currency" className="mb-1 block text-[11px] font-medium text-slate-600">Selling Currency</label>
        <select id="selling_currency" value={values.selling_currency} onChange={(e) => update("selling_currency", e.target.value)} className={inputCls}>
          <option value="">Select currency</option>
          {currencyOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="price" className="mb-1 block text-[11px] font-medium text-slate-600">Price</label>
        <input id="price" type="number" min="0" step="0.01" value={values.price} onChange={(e) => update("price", e.target.value)} className={inputCls} placeholder="0.00" />
        {fieldErrors.price ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.price}</p> : null}
      </div>

      <div>
        <label htmlFor="agency_price" className="mb-1 block text-[11px] font-medium text-slate-600">Agency Price <span className="text-slate-400">(optional)</span></label>
        <input id="agency_price" type="number" min="0" step="0.01" value={values.agency_price} onChange={(e) => update("agency_price", e.target.value)} className={inputCls} placeholder="0.00" />
      </div>

      <div>
        <label htmlFor="cost_currency" className="mb-1 block text-[11px] font-medium text-slate-600">Cost Currency</label>
        <select id="cost_currency" value={values.cost_currency} onChange={(e) => update("cost_currency", e.target.value)} className={inputCls}>
          <option value="">Select currency</option>
          {currencyOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
        <label htmlFor="cost" className="mb-1 block text-[11px] font-medium text-slate-600">
          Cost{" "}
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
            Internal
          </span>
        </label>
        <input id="cost" type="number" min="0" step="0.01" value={values.cost} onChange={(e) => update("cost", e.target.value)} className={inputCls} placeholder="0.00" />
      </div>

      <div>
        <label htmlFor="cross_currency_rate" className="mb-1 block text-[11px] font-medium text-slate-600">Cross-Currency Rate</label>
        <input id="cross_currency_rate" type="number" min="0" step="0.0000000001" value={values.cross_currency_rate} onChange={(e) => update("cross_currency_rate", e.target.value)} className={inputCls} placeholder="1.0000000000" />
      </div>

      {/* ---- Section 3: Tracking ---- */}
      <SectionHeading title="Tracking" />

      <div>
        <label htmlFor="confirm_booking_number" className="mb-1 block text-[11px] font-medium text-slate-600">Hotel Confirmation #</label>
        <input id="confirm_booking_number" type="text" value={values.confirm_booking_number} onChange={(e) => update("confirm_booking_number", e.target.value)} className={inputCls} placeholder="Hotel's confirmation reference" />
      </div>

      <div>
        <label htmlFor="agent_confirmation_number" className="mb-1 block text-[11px] font-medium text-slate-600">Agent Confirmation #</label>
        <input id="agent_confirmation_number" type="text" value={values.agent_confirmation_number} onChange={(e) => update("agent_confirmation_number", e.target.value)} className={inputCls} placeholder="Our internal reference" />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="hotel_cancellation_number" className="mb-1 block text-[11px] font-medium text-slate-600">Cancellation # <span className="text-slate-400">(fill when cancelled)</span></label>
        <input id="hotel_cancellation_number" type="text" value={values.hotel_cancellation_number} onChange={(e) => update("hotel_cancellation_number", e.target.value)} className={inputCls} placeholder="Hotel cancellation reference" />
      </div>

      {/* ---- Section 4: Notes ---- */}
      <SectionHeading title="Notes" />

      <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50/50 p-2">
        <label htmlFor="internal_note" className="mb-1 block text-[11px] font-medium text-slate-600">
          Internal Note{" "}
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
            Staff only
          </span>
        </label>
        <textarea id="internal_note" rows={2} value={values.internal_note} onChange={(e) => update("internal_note", e.target.value)} className={inputCls} placeholder="Internal notes visible to staff only" />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="remarks_for_hotel" className="mb-1 block text-[11px] font-medium text-slate-600">Remarks for Hotel</label>
        <textarea id="remarks_for_hotel" rows={2} value={values.remarks_for_hotel} onChange={(e) => update("remarks_for_hotel", e.target.value)} className={inputCls} placeholder="Notes sent to the hotel" />
      </div>

      {/* ---- Footer ---- */}
      {formError ? <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p> : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md border border-[#0f2347] bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Saving..." : booking ? "Update Booking" : "Save Booking"}
        </button>
      </div>
    </form>
  );
}