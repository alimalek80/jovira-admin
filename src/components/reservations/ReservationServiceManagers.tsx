"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import HotelBookingForm from "@/components/reservations/HotelBookingForm";
import TransferServiceForm from "@/components/reservations/TransferServiceForm";
import {
  deleteHotelBooking,
  deleteTransferService,
  listHotelBookings,
  listTransferServices,
  type HotelBooking,
  type TransferService,
} from "@/lib/api/reservation-services";

export type ReservationServiceManagerHandle = {
  openEdit: () => void;
  openView: () => void;
  deleteSelected: () => void;
};

function toDateLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }

  return trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-medium text-slate-800">{value || "-"}</p>
    </div>
  );
}

function HotelViewPanel({ booking }: { booking: HotelBooking }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <ViewField label="Hotel" value={booking.hotelName} />
      <ViewField label="Check In" value={toDateLabel(booking.checkInDate)} />
      <ViewField label="Check Out" value={toDateLabel(booking.checkOutDate)} />
      <ViewField label="Paid" value={booking.paid ? "Yes" : "No"} />
      <ViewField label="Paid Cancelation" value={booking.isPaidCancelation ? "Yes" : "No"} />
    </div>
  );
}

function TransferViewPanel({ service, currencyLabel }: { service: TransferService; currencyLabel: string }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <ViewField label="Service Name" value={service.serviceName} />
      <ViewField label="Service Date" value={toDateLabel(service.serviceDate)} />
      <ViewField label="On Arrival" value={service.onArrival ? "Yes" : "No"} />
      <ViewField label="On Departure" value={service.onDeparture ? "Yes" : "No"} />
      <ViewField label="From" value={`${service.fromLocationType} - ${service.fromLocationName}`.trim()} />
      <ViewField label="To" value={`${service.toLocationType} - ${service.toLocationName}`.trim()} />
      <ViewField label="Price" value={service.price ? `${service.price} ${currencyLabel}`.trim() : "-"} />
      <ViewField label="Passengers" value={String(service.passengers.length)} />
      <ViewField label="External Note" value={service.externalNote} />
      <ViewField label="Driver Note" value={service.driverNote} />
    </div>
  );
}

export const HotelBookingManager = forwardRef<
  ReservationServiceManagerHandle,
  {
    reservationId: number | null;
    isAddOpen: boolean;
    onCloseAdd: () => void;
  }
>(function HotelBookingManager({ reservationId, isAddOpen, onCloseAdd }, ref) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const query = useQuery({
    queryKey: ["reservation-service", "hotel", reservationId],
    queryFn: async () => listHotelBookings("admin", reservationId as number),
    enabled: typeof reservationId === "number" && reservationId > 0,
  });

  const selectedBooking = useMemo(
    () => query.data?.find((booking) => booking.id === selectedId) ?? null,
    [query.data, selectedId]
  );

  const deleteMutation = useMutation({
    mutationFn: async (bookingId: number) => deleteHotelBooking("admin", bookingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "hotel", reservationId] });
      setToastMessage("Hotel booking deleted successfully.");
      setSelectedId(null);
    },
  });

  useImperativeHandle(ref, () => ({
    openEdit: () => {
      if (!selectedBooking) {
        window.alert("Select a hotel row first.");
        return;
      }
      setIsEditOpen(true);
    },
    openView: () => {
      if (!selectedBooking) {
        window.alert("Select a hotel row first.");
        return;
      }
      setIsViewOpen(true);
    },
    deleteSelected: () => {
      if (!selectedBooking) {
        window.alert("Select a hotel row first.");
        return;
      }

      const confirmed = window.confirm("Delete selected hotel booking?");
      if (!confirmed) {
        return;
      }

      void deleteMutation.mutateAsync(selectedBooking.id);
    },
  }), [deleteMutation, selectedBooking]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {toastMessage ? <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{toastMessage}</div> : null}

      {typeof reservationId !== "number" || reservationId <= 0 ? (
        <p className="text-xs text-slate-500">Save or select a reservation to manage hotel lines.</p>
      ) : query.isLoading ? (
        <p className="text-xs text-slate-500">Loading hotel lines...</p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-slate-500">No hotel lines added yet.</p>
      ) : (
        <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Hotel</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Check In</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Check Out</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Paid</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Paid Cancelation</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((booking, index) => (
              <tr
                key={booking.id}
                onClick={() => setSelectedId(booking.id)}
                className={`cursor-pointer ${
                  selectedBooking?.id === booking.id
                    ? "bg-amber-200/80 hover:bg-amber-200"
                    : index % 2 === 0
                      ? "bg-white hover:bg-slate-50"
                      : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">{booking.hotelName || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{toDateLabel(booking.checkInDate)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{toDateLabel(booking.checkOutDate)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{booking.paid ? "Yes" : "No"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{booking.isPaidCancelation ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isAddOpen && typeof reservationId === "number" && reservationId > 0 ? (
        <ModalShell title="Add Hotel Booking" onClose={onCloseAdd}>
          <HotelBookingForm
            reservationId={reservationId}
            onCancel={onCloseAdd}
            onSuccess={() => {
              onCloseAdd();
              setToastMessage("Hotel booking added successfully.");
            }}
          />
        </ModalShell>
      ) : null}

      {isViewOpen && selectedBooking ? (
        <ModalShell title="View Hotel Booking" onClose={() => setIsViewOpen(false)}>
          <HotelViewPanel booking={selectedBooking} />
        </ModalShell>
      ) : null}

      {isEditOpen && selectedBooking ? (
        <ModalShell title="Edit Hotel Booking" onClose={() => setIsEditOpen(false)}>
          <HotelBookingForm
            key={`edit-hotel-${selectedBooking.id}`}
            reservationId={reservationId as number}
            booking={selectedBooking}
            onCancel={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              setToastMessage("Hotel booking updated successfully.");
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
});

export const TransferServiceManager = forwardRef<
  ReservationServiceManagerHandle,
  {
    reservationId: number | null;
    tourPackageId?: string;
    currencyOptions: Array<{ id: string; label: string }>;
    isAddOpen: boolean;
    onCloseAdd: () => void;
  }
>(function TransferServiceManager({ reservationId, tourPackageId, currencyOptions, isAddOpen, onCloseAdd }, ref) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const currencyLabelById = useMemo(
    () =>
      currencyOptions.reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
      }, {}),
    [currencyOptions]
  );
  const query = useQuery({
    queryKey: ["reservation-service", "transfer", reservationId],
    queryFn: async () => listTransferServices("admin", reservationId as number),
    enabled: typeof reservationId === "number" && reservationId > 0,
  });

  const selectedService = useMemo(
    () => query.data?.find((service) => service.id === selectedId) ?? null,
    [query.data, selectedId]
  );

  const deleteMutation = useMutation({
    mutationFn: async (serviceId: number) => deleteTransferService("admin", serviceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "transfer", reservationId] });
      setToastMessage("Transfer service deleted successfully.");
      setSelectedId(null);
    },
  });

  useImperativeHandle(ref, () => ({
    openEdit: () => {
      if (!selectedService) {
        window.alert("Select a transfer row first.");
        return;
      }
      setIsEditOpen(true);
    },
    openView: () => {
      if (!selectedService) {
        window.alert("Select a transfer row first.");
        return;
      }
      setIsViewOpen(true);
    },
    deleteSelected: () => {
      if (!selectedService) {
        window.alert("Select a transfer row first.");
        return;
      }

      const confirmed = window.confirm("Delete selected transfer service?");
      if (!confirmed) {
        return;
      }

      void deleteMutation.mutateAsync(selectedService.id);
    },
  }), [deleteMutation, selectedService]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {toastMessage ? <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{toastMessage}</div> : null}

      {typeof reservationId !== "number" || reservationId <= 0 ? (
        <p className="text-xs text-slate-500">Save or select a reservation to manage transfer lines.</p>
      ) : query.isLoading ? (
        <p className="text-xs text-slate-500">Loading transfer lines...</p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-slate-500">No transfer lines added yet.</p>
      ) : (
        <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Service</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Date</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">From</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">To</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Price</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Passengers</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((service, index) => (
              <tr
                key={service.id}
                onClick={() => setSelectedId(service.id)}
                className={`cursor-pointer ${
                  selectedService?.id === service.id
                    ? "bg-amber-200/80 hover:bg-amber-200"
                    : index % 2 === 0
                      ? "bg-white hover:bg-slate-50"
                      : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">{service.serviceName || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{toDateLabel(service.serviceDate)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.fromLocationName || service.fromLocationType || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.toLocationName || service.toLocationType || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.price ? `${service.price} ${currencyLabelById[service.currencyId] ?? ""}`.trim() : "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.passengers.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isAddOpen && typeof reservationId === "number" && reservationId > 0 ? (
        <ModalShell title="Add Transfer Service" onClose={onCloseAdd}>
          <TransferServiceForm
            reservationId={reservationId}
            tourPackageId={tourPackageId}
            currencyOptions={currencyOptions}
            onCancel={onCloseAdd}
            onSuccess={() => {
              onCloseAdd();
              setToastMessage("Transfer service added successfully.");
            }}
          />
        </ModalShell>
      ) : null}

      {isViewOpen && selectedService ? (
        <ModalShell title="View Transfer Service" onClose={() => setIsViewOpen(false)}>
          <TransferViewPanel service={selectedService} currencyLabel={currencyLabelById[selectedService.currencyId] ?? ""} />
        </ModalShell>
      ) : null}

      {isEditOpen && selectedService ? (
        <ModalShell title="Edit Transfer Service" onClose={() => setIsEditOpen(false)}>
          <TransferServiceForm
            key={`edit-transfer-${selectedService.id}`}
            reservationId={reservationId as number}
            tourPackageId={tourPackageId}
            currencyOptions={currencyOptions}
            service={selectedService}
            onCancel={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              setToastMessage("Transfer service updated successfully.");
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
});
