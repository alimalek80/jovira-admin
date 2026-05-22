"use client";

import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import axiosInstance from "@/lib/axios";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";
import { mapBackendValidationErrors, type FieldErrorMap } from "@/lib/forms/backend-errors";
import { createHotelBooking, type HotelBooking, updateHotelBooking } from "@/lib/api/reservation-services";

const hotelBookingSchema = z.object({
  hotel: z.string().min(1, "Hotel is required."),
  check_in_date: z.string().min(1, "Check-in date is required."),
  check_out_date: z.string().min(1, "Check-out date is required."),
  paid: z.boolean(),
  is_paid_cancelation: z.boolean(),
});

type HotelBookingFormValues = z.infer<typeof hotelBookingSchema>;

function normalizeHotelOptions(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .map((row) => {
      const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
      const label =
        (typeof row.name === "string" && row.name) ||
        (typeof row.title === "string" && row.title) ||
        (typeof row.name_en === "string" && row.name_en) ||
        id;

      return { id, label };
    })
    .filter((option) => option.id.length > 0);
}

function fieldError(errors: FieldErrorMap, key: keyof HotelBookingFormValues) {
  return errors[key] ?? "";
}

export default function HotelBookingForm({
  reservationId,
  booking,
  onSuccess,
  onCancel,
}: {
  reservationId: number;
  booking?: HotelBooking;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<HotelBookingFormValues>({
    hotel: booking?.hotelId ?? "",
    check_in_date: booking?.checkInDate?.slice(0, 10) ?? "",
    check_out_date: booking?.checkOutDate?.slice(0, 10) ?? "",
    paid: booking?.paid ?? false,
    is_paid_cancelation: booking?.isPaidCancelation ?? false,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState("");

  const hotelsQuery = useQuery({
    queryKey: ["inventory-hotels", "admin"],
    queryFn: async () => {
      const response = await axiosInstance.get(INVENTORY_ENDPOINTS.adminHotels);
      return normalizeHotelOptions(response.data);
    },
  });

  const hotelOptions = hotelsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: HotelBookingFormValues) => {
      const requestPayload = {
        reservation: reservationId,
        hotel: Number(payload.hotel),
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        paid: payload.paid,
        is_paid_cancelation: payload.is_paid_cancelation,
        is_paid_cancellation: payload.is_paid_cancelation,
      };

      if (booking?.id) {
        return updateHotelBooking("admin", booking.id, requestPayload);
      }

      return createHotelBooking("admin", requestPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "hotel", reservationId] });
      onSuccess?.();
    },
  });

  const inputClassName = useMemo(
    () =>
      "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
    []
  );

  const update = <K extends keyof HotelBookingFormValues>(key: K, value: HotelBookingFormValues[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const validation = hotelBookingSchema.safeParse(values);
    if (!validation.success) {
      const nextErrors: FieldErrorMap = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="hotel" className="mb-1 block text-[11px] font-medium text-slate-600">
          Hotel
        </label>
        <div className="flex items-center gap-2">
          <select
            id="hotel"
            value={values.hotel}
            onChange={(event) => update("hotel", event.target.value)}
            disabled={hotelsQuery.isLoading}
            className={`${inputClassName} disabled:cursor-wait disabled:opacity-60`}
          >
            <option value="">{hotelsQuery.isLoading ? "Loading hotels..." : "Select hotel"}</option>
            {hotelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const base = "/hotels";
              const target = values.hotel ? `${base}?hotelId=${encodeURIComponent(values.hotel)}` : base;
              window.open(target, "_blank", "noopener,noreferrer");
            }}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Open Hotel Inventory
          </button>
        </div>
        {fieldError(fieldErrors, "hotel") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.hotel}</p> : null}
      </div>

      <div>
        <label htmlFor="check_in_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Check In Date
        </label>
        <input id="check_in_date" type="date" value={values.check_in_date} onChange={(event) => update("check_in_date", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "check_in_date") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.check_in_date}</p> : null}
      </div>

      <div>
        <label htmlFor="check_out_date" className="mb-1 block text-[11px] font-medium text-slate-600">
          Check Out Date
        </label>
        <input id="check_out_date" type="date" value={values.check_out_date} onChange={(event) => update("check_out_date", event.target.value)} className={inputClassName} />
        {fieldError(fieldErrors, "check_out_date") ? <p className="mt-1 text-[11px] text-red-600">{fieldErrors.check_out_date}</p> : null}
      </div>

      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <input type="checkbox" checked={values.paid} onChange={(event) => update("paid", event.target.checked)} />
        Paid
      </label>

      <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
        <input type="checkbox" checked={values.is_paid_cancelation} onChange={(event) => update("is_paid_cancelation", event.target.checked)} />
        Is Paid Cancelation
      </label>

      {formError ? <p className="sm:col-span-2 text-[11px] font-medium text-red-600">{formError}</p> : null}

      <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={mutation.isPending} className="rounded-md border border-[#0f2347] bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60">
          {mutation.isPending ? "Saving..." : booking ? "Update Hotel" : "Save Hotel"}
        </button>
      </div>
    </form>
  );
}