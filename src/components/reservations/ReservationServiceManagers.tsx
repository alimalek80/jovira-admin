"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import HotelBookingForm from "@/components/reservations/HotelBookingForm";
import TransferServiceForm from "@/components/reservations/TransferServiceForm";
import ExcursionServiceForm from "@/components/reservations/ExcursionServiceForm";
import {
  deleteHotelBooking,
  deleteTransferService,
  deleteExcursionService,
  listHotelBookings,
  listTransferServices,
  listExcursionServices,
  listFlightTickets,
  createFlightTicket,
  updateFlightTicket,
  deleteFlightTicket,
  type HotelBooking,
  type TransferService,
  type ExcursionService,
  type FlightTicket,
  type FlightTicketInput,
} from "@/lib/api/reservation-services";
import { convertCurrencyAmount, listAdminFlightOptions } from "@/lib/api/tour-packages";
import { listTourists } from "@/lib/api/tourists";

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
    ownerType: "AGENCY" | "NORMAL";
    currencyOptions: Array<{ id: string; label: string }>;
    reservationCurrencyId?: string;
    currencyCodeById?: Record<string, string>;
    isAddOpen: boolean;
    onCloseAdd: () => void;
  }
>(function HotelBookingManager({ reservationId, ownerType, currencyOptions, reservationCurrencyId, currencyCodeById, isAddOpen, onCloseAdd }, ref) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const currencyLabelById = useMemo(
    () =>
      currencyOptions.reduce<Record<string, string>>((acc, option) => {
        acc[option.id] = option.label;
        return acc;
      }, {}),
    [currencyOptions]
  );
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
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Price</th>
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
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                  {booking.price
                    ? `${booking.price} ${booking.currencyId ? (currencyLabelById[booking.currencyId] ?? booking.currencyId) : ""}`.trim()
                    : "-"}
                </td>
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
            ownerType={ownerType}
            currencyOptions={currencyOptions}
            reservationCurrencyId={reservationCurrencyId}
            currencyCodeById={currencyCodeById}
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
            ownerType={ownerType}
            currencyOptions={currencyOptions}
            reservationCurrencyId={reservationCurrencyId}
            currencyCodeById={currencyCodeById}
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

// ─── ExcursionServiceManager ──────────────────────────────────────────────────

function ExcursionViewPanel({ service }: { service: ExcursionService }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <ViewField label="System Date" value={toDateLabel(service.systemDate)} />
      <ViewField label="Excursion Date" value={toDateLabel(service.excursionDate)} />
      <ViewField label="Excursion" value={service.excursionName} />
      <ViewField label="Combo" value={service.isCombo ? "Yes" : "No"} />
      <ViewField label="Pick Up Point" value={service.pickupPoint} />
      <ViewField label="Price" value={service.price ? `${service.price} ${service.sellingCurrencyCode}`.trim() : "-"} />
      <ViewField label="Selling Currency" value={service.sellingCurrencyCode} />
      <ViewField label="Cost" value={service.cost ? `${service.cost} ${service.costCurrencyCode}`.trim() : "-"} />
      <ViewField label="Cost Currency" value={service.costCurrencyCode} />
      <ViewField label="Cross Currency Rate" value={service.crossCurrencyRate} />
      <ViewField label="Paid" value={service.isPaid ? "Yes" : "No"} />
      <ViewField label="Confirm Booking #" value={service.confirmBookingNumber} />
      <ViewField label="Agent Confirmation #" value={service.agentConfirmationNumber} />
      <div className="sm:col-span-2">
        <ViewField label="Note" value={service.note} />
      </div>
    </div>
  );
}

export const ExcursionServiceManager = forwardRef<
  ReservationServiceManagerHandle,
  {
    isAddOpen: boolean;
    onCloseAdd: () => void;
  }
>(function ExcursionServiceManager({ isAddOpen, onCloseAdd }, ref) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const query = useQuery({
    queryKey: ["excursion-services"],
    queryFn: async () => {
      const result = await listExcursionServices();
      return result.results;
    },
  });

  const selectedService = useMemo(
    () => query.data?.find((service) => service.id === selectedId) ?? null,
    [query.data, selectedId]
  );

  const deleteMutation = useMutation({
    mutationFn: async (serviceId: number) => deleteExcursionService(serviceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["excursion-services"] });
      setToastMessage("Excursion service deleted successfully.");
      setSelectedId(null);
    },
  });

  useImperativeHandle(ref, () => ({
    openEdit: () => {
      if (!selectedService) {
        window.alert("Select an excursion row first.");
        return;
      }
      setIsEditOpen(true);
    },
    openView: () => {
      if (!selectedService) {
        window.alert("Select an excursion row first.");
        return;
      }
      setIsViewOpen(true);
    },
    deleteSelected: () => {
      if (!selectedService) {
        window.alert("Select an excursion row first.");
        return;
      }
      const confirmed = window.confirm("Delete selected excursion service?");
      if (!confirmed) return;
      void deleteMutation.mutateAsync(selectedService.id);
    },
  }), [deleteMutation, selectedService]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {toastMessage ? (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {query.isLoading ? (
        <p className="text-xs text-slate-500">Loading excursion services...</p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-slate-500">No excursion services added yet.</p>
      ) : (
        <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">System Date</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Excursion Date</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Excursion</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Combo</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Price</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Selling CCY</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Cost</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Cost CCY</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Paid</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Confirm #</th>
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
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{toDateLabel(service.systemDate)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{toDateLabel(service.excursionDate)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">{service.excursionName || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.isCombo ? "Yes" : "No"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.price || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.sellingCurrencyCode || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.cost || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.costCurrencyCode || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.isPaid ? "Yes" : "No"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{service.confirmBookingNumber || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isAddOpen ? (
        <ModalShell title="Add Excursion Service" onClose={onCloseAdd}>
          <ExcursionServiceForm
            onCancel={onCloseAdd}
            onSuccess={() => {
              onCloseAdd();
              setToastMessage("Excursion service added successfully.");
            }}
          />
        </ModalShell>
      ) : null}

      {isViewOpen && selectedService ? (
        <ModalShell title="View Excursion Service" onClose={() => setIsViewOpen(false)}>
          <ExcursionViewPanel service={selectedService} />
        </ModalShell>
      ) : null}

      {isEditOpen && selectedService ? (
        <ModalShell title="Edit Excursion Service" onClose={() => setIsEditOpen(false)}>
          <ExcursionServiceForm
            key={`edit-excursion-${selectedService.id}`}
            service={selectedService}
            onCancel={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              setToastMessage("Excursion service updated successfully.");
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
});

// ─── FlightTicketForm ─────────────────────────────────────────────────────────

type FlightTicketFormState = {
  flightId: string;
  touristId: string;
  departureDate: string;
  arrivalDate: string;
  ticketNumber: string;
  price: string;
  currencyId: string;
  paid: boolean;
};

function FlightTicketForm({
  reservationId,
  ownerType,
  currencyOptions,
  reservationCurrencyId,
  currencyCodeById,
  ticket,
  onCancel,
  onSuccess,
}: {
  reservationId: number;
  ownerType: "AGENCY" | "NORMAL";
  currencyOptions: Array<{ id: string; label: string }>;
  reservationCurrencyId?: string;
  currencyCodeById?: Record<string, string>;
  ticket?: FlightTicket;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<FlightTicketFormState>({
    flightId: ticket ? ticket.flightId : "",
    touristId: ticket ? ticket.touristId : "",
    departureDate: ticket?.departureDate ?? "",
    arrivalDate: ticket?.arrivalDate ?? "",
    ticketNumber: ticket?.ticketNumber ?? "",
    price: ticket?.price ?? "",
    currencyId: ticket?.currencyId ?? "",
    paid: ticket?.paid ?? false,
  });
  const [formError, setFormError] = useState("");

  const flightOptionsQuery = useQuery({
    queryKey: ["flight-options-for-ticket"],
    queryFn: listAdminFlightOptions,
    staleTime: 60_000,
  });

  const touristQuery = useQuery({
    queryKey: ["tourists-for-reservation", reservationId],
    queryFn: async () => listTourists("admin", { reservationId }),
    staleTime: 30_000,
  });

  const selectedFlightOption = useMemo(
    () => (flightOptionsQuery.data ?? []).find((option) => option.id === formState.flightId) ?? null,
    [flightOptionsQuery.data, formState.flightId]
  );

  useEffect(() => {
    if (!selectedFlightOption) {
      return;
    }

    const applyFlightPricing = async () => {
      const rolePrice =
        ownerType === "AGENCY"
          ? selectedFlightOption.agencyPrice ?? selectedFlightOption.publicPrice
          : selectedFlightOption.publicPrice ?? selectedFlightOption.agencyPrice;

      let nextPrice = typeof rolePrice === "number" && Number.isFinite(rolePrice) ? rolePrice : null;
      let nextCurrencyId = selectedFlightOption.currencyId;

      // Keep all reservation service prices in reservation currency.
      if (
        nextPrice !== null &&
        reservationCurrencyId &&
        nextCurrencyId &&
        reservationCurrencyId !== nextCurrencyId &&
        currencyCodeById
      ) {
        const fromCode = currencyCodeById[nextCurrencyId];
        const toCode = currencyCodeById[reservationCurrencyId];

        if (fromCode && toCode) {
          try {
            nextPrice = await convertCurrencyAmount({
              from: fromCode,
              to: toCode,
              amount: nextPrice,
            });
            nextCurrencyId = reservationCurrencyId;
          } catch {
            // Keep base inventory price if conversion endpoint is unavailable.
          }
        }
      }

      setFormState((previous) => ({
        ...previous,
        price: nextPrice !== null ? nextPrice.toFixed(2) : previous.price,
        currencyId: nextCurrencyId || previous.currencyId,
        departureDate:
          typeof selectedFlightOption.departureDate === "string" && selectedFlightOption.departureDate.length > 0
            ? selectedFlightOption.departureDate.slice(0, 10)
            : previous.departureDate,
        arrivalDate:
          typeof selectedFlightOption.arrivalDate === "string" && selectedFlightOption.arrivalDate.length > 0
            ? selectedFlightOption.arrivalDate.slice(0, 10)
            : previous.arrivalDate,
      }));
    };

    void applyFlightPricing();
  }, [selectedFlightOption, ownerType, reservationCurrencyId, currencyCodeById]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: FlightTicketInput = {
        reservation: reservationId,
        flight: formState.flightId ? Number(formState.flightId) : null,
        tourist: formState.touristId ? Number(formState.touristId) : null,
        departure_date: formState.departureDate || null,
        arrival_date: formState.arrivalDate || null,
        ticket_number: formState.ticketNumber,
        price: formState.price || undefined,
        currency: formState.currencyId ? Number(formState.currencyId) : null,
        paid: formState.paid,
      };
      if (ticket) {
        return updateFlightTicket(ticket.id, { ...payload, reservation: reservationId });
      }
      return createFlightTicket(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "flight-ticket", reservationId] });
      onSuccess();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to save flight ticket.";
      setFormError(message);
    },
  });

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );

  const inputClass = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200";
  const selectClass = `${inputClass} w-full`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setFormError("");
        saveMutation.mutate();
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      {field(
        "Flight",
        <select
          className={selectClass}
          value={formState.flightId}
          onChange={(event) => setFormState((prev) => ({ ...prev, flightId: event.target.value }))}
          disabled={flightOptionsQuery.isLoading}
        >
          <option value="">{flightOptionsQuery.isLoading ? "Loading..." : "— select flight —"}</option>
          {(flightOptionsQuery.data ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )}

      {field(
        "Tourist / Passenger",
        <select
          className={selectClass}
          value={formState.touristId}
          onChange={(event) => setFormState((prev) => ({ ...prev, touristId: event.target.value }))}
          disabled={touristQuery.isLoading}
        >
          <option value="">{touristQuery.isLoading ? "Loading..." : "— select tourist —"}</option>
          {(touristQuery.data ?? []).map((tourist) => (
            <option key={tourist.id} value={String(tourist.id)}>
              {`${tourist.first_name} ${tourist.last_name}`.trim() || `Tourist #${tourist.id}`}
            </option>
          ))}
        </select>
      )}

      {field(
        "Ticket / PNR Number",
        <input
          type="text"
          className={`${inputClass} w-full`}
          value={formState.ticketNumber}
          onChange={(event) => setFormState((prev) => ({ ...prev, ticketNumber: event.target.value }))}
          placeholder="e.g. ABC123"
        />
      )}

      {field(
        "Departure Date",
        <input
          type="date"
          className={`${inputClass} w-full`}
          value={formState.departureDate}
          onChange={(event) => setFormState((prev) => ({ ...prev, departureDate: event.target.value }))}
        />
      )}

      {field(
        "Arrival Date",
        <input
          type="date"
          className={`${inputClass} w-full`}
          value={formState.arrivalDate}
          onChange={(event) => setFormState((prev) => ({ ...prev, arrivalDate: event.target.value }))}
        />
      )}

      {field(
        "Price",
        <input
          type="number"
          step="0.01"
          min="0"
          className={`${inputClass} w-full`}
          value={formState.price}
          onChange={(event) => setFormState((prev) => ({ ...prev, price: event.target.value }))}
          placeholder="0.00"
        />
      )}

      {field(
        "Currency",
        <select
          className={selectClass}
          value={formState.currencyId}
          onChange={(event) => setFormState((prev) => ({ ...prev, currencyId: event.target.value }))}
        >
          <option value="">— select currency —</option>
          {currencyOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="flight-ticket-paid"
          type="checkbox"
          checked={formState.paid}
          onChange={(event) => setFormState((prev) => ({ ...prev, paid: event.target.checked }))}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="flight-ticket-paid" className="text-xs font-medium text-slate-700">Paid</label>
      </div>

      {formError ? (
        <p className="text-xs text-red-600 sm:col-span-2">{formError}</p>
      ) : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded-md bg-[#0f2347] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b1b38] disabled:opacity-60"
        >
          {saveMutation.isPending ? "Saving..." : ticket ? "Update" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ─── FlightTicketViewPanel ────────────────────────────────────────────────────

function FlightTicketViewPanel({ ticket, currencyLabel }: { ticket: FlightTicket; currencyLabel: string }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <ViewField label="Flight" value={ticket.flightLabel} />
      <ViewField label="Passenger" value={ticket.touristName} />
      <ViewField label="Ticket / PNR" value={ticket.ticketNumber} />
      <ViewField label="Departure Date" value={toDateLabel(ticket.departureDate)} />
      <ViewField label="Arrival Date" value={toDateLabel(ticket.arrivalDate)} />
      <ViewField label="Price" value={ticket.price ? `${ticket.price} ${currencyLabel}`.trim() : "-"} />
      <ViewField label="Currency" value={currencyLabel} />
      <ViewField label="Paid" value={ticket.paid ? "Yes" : "No"} />
    </div>
  );
}

// ─── FlightTicketManager ──────────────────────────────────────────────────────

export const FlightTicketManager = forwardRef<
  ReservationServiceManagerHandle,
  {
    reservationId: number | null;
    ownerType: "AGENCY" | "NORMAL";
    currencyOptions: Array<{ id: string; label: string }>;
    reservationCurrencyId?: string;
    currencyCodeById?: Record<string, string>;
    isAddOpen: boolean;
    onCloseAdd: () => void;
  }
>(function FlightTicketManager({ reservationId, ownerType, currencyOptions, reservationCurrencyId, currencyCodeById, isAddOpen, onCloseAdd }, ref) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const currencyLabelById = useMemo(
    () =>
      currencyOptions.reduce<Record<string, string>>((acc, opt) => {
        acc[opt.id] = opt.label;
        return acc;
      }, {}),
    [currencyOptions]
  );

  const query = useQuery({
    queryKey: ["reservation-service", "flight-ticket", reservationId],
    queryFn: async () => listFlightTickets(reservationId as number),
    enabled: typeof reservationId === "number" && reservationId > 0,
  });

  const flightOptionsQuery = useQuery({
    queryKey: ["flight-options-for-ticket-grid"],
    queryFn: listAdminFlightOptions,
    staleTime: 60_000,
  });

  const touristsQuery = useQuery({
    queryKey: ["tourists-for-flight-ticket-grid", reservationId],
    queryFn: async () => listTourists("admin", { reservationId: reservationId as number }),
    enabled: typeof reservationId === "number" && reservationId > 0,
    staleTime: 30_000,
  });

  const flightLabelById = useMemo(
    () =>
      (flightOptionsQuery.data ?? []).reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
      }, {}),
    [flightOptionsQuery.data]
  );

  // Full inventory snapshot per flight for resolving missing price/date on saved tickets
  const flightInventoryById = useMemo(
    () =>
      (flightOptionsQuery.data ?? []).reduce<Record<string, typeof flightOptionsQuery.data[number]>>(
        (accumulator, option) => {
          accumulator[option.id] = option;
          return accumulator;
        },
        {}
      ),
    [flightOptionsQuery.data]
  );

  const touristLabelById = useMemo(
    () =>
      (touristsQuery.data ?? []).reduce<Record<string, string>>((accumulator, tourist) => {
        accumulator[String(tourist.id)] = `${tourist.first_name} ${tourist.last_name}`.trim() || `Tourist #${tourist.id}`;
        return accumulator;
      }, {}),
    [touristsQuery.data]
  );

  const selectedTicket = useMemo(
    () => query.data?.find((t) => t.id === selectedId) ?? null,
    [query.data, selectedId]
  );

  const resolveFlightLabel = (ticket: FlightTicket) => {
    if (ticket.flightLabel && ticket.flightLabel !== ticket.flightId) {
      return ticket.flightLabel;
    }

    return flightLabelById[ticket.flightId] ?? ticket.flightLabel ?? ticket.flightId ?? "-";
  };

  // Price: use saved ticket price if non-zero, otherwise fall back to inventory price by owner type
  const resolveTicketPrice = (ticket: FlightTicket) => {
    const savedPrice = parseFloat(ticket.price);
    if (Number.isFinite(savedPrice) && savedPrice > 0) {
      return ticket.price;
    }

    const inv = flightInventoryById[ticket.flightId];
    if (!inv) return "0.00";

    const rolePrice = ownerType === "AGENCY"
      ? (inv.agencyPrice ?? inv.publicPrice)
      : (inv.publicPrice ?? inv.agencyPrice);

    return typeof rolePrice === "number" ? rolePrice.toFixed(2) : "0.00";
  };

  const resolveTicketCurrencyLabel = (ticket: FlightTicket) => {
    if (ticket.currencyId && currencyLabelById[ticket.currencyId]) {
      return currencyLabelById[ticket.currencyId];
    }

    const inv = flightInventoryById[ticket.flightId];
    return inv ? (currencyLabelById[inv.currencyId] ?? inv.currencyId) : "";
  };

  const resolveTicketDeparture = (ticket: FlightTicket) => {
    if (ticket.departureDate) return toDateLabel(ticket.departureDate);
    const inv = flightInventoryById[ticket.flightId];
    return inv?.departureDate ? toDateLabel(inv.departureDate.slice(0, 10)) : "-";
  };

  const resolveTicketArrival = (ticket: FlightTicket) => {
    if (ticket.arrivalDate) return toDateLabel(ticket.arrivalDate);
    const inv = flightInventoryById[ticket.flightId];
    return inv?.arrivalDate ? toDateLabel(inv.arrivalDate.slice(0, 10)) : "-";
  };

  const resolveTouristLabel = (ticket: FlightTicket) => {
    if (ticket.touristName && ticket.touristName !== ticket.touristId) {
      return ticket.touristName;
    }

    if (ticket.touristId) {
      return touristLabelById[ticket.touristId] ?? ticket.touristName ?? ticket.touristId;
    }

    return "Unassigned";
  };

  const deleteMutation = useMutation({
    mutationFn: async (ticketId: number) => deleteFlightTicket(ticketId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "flight-ticket", reservationId] });
      setToastMessage("Flight ticket deleted successfully.");
      setSelectedId(null);
    },
  });

  useImperativeHandle(ref, () => ({
    openEdit: () => {
      if (!selectedTicket) {
        window.alert("Select a flight ticket row first.");
        return;
      }
      setIsEditOpen(true);
    },
    openView: () => {
      if (!selectedTicket) {
        window.alert("Select a flight ticket row first.");
        return;
      }
      setIsViewOpen(true);
    },
    deleteSelected: () => {
      if (!selectedTicket) {
        window.alert("Select a flight ticket row first.");
        return;
      }
      const confirmed = window.confirm("Delete selected flight ticket?");
      if (!confirmed) return;
      void deleteMutation.mutateAsync(selectedTicket.id);
    },
  }), [deleteMutation, selectedTicket]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {toastMessage ? (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {typeof reservationId !== "number" || reservationId <= 0 ? (
        <p className="text-xs text-slate-500">Save or select a reservation to manage flight tickets.</p>
      ) : query.isLoading ? (
        <p className="text-xs text-slate-500">Loading flight tickets...</p>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-xs text-slate-500">No flight tickets added yet.</p>
      ) : (
        <table className="min-w-full rounded-md border border-slate-200 text-left text-[11px]">
          <thead className="sticky top-0 bg-slate-100 text-slate-600">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Flight</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Passenger</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Ticket / PNR</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Departure</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Arrival</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Price</th>
              <th className="border-b border-slate-200 px-2 py-1.5 font-semibold">Paid</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((ticket, index) => (
              <tr
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id)}
                className={`cursor-pointer ${
                  selectedTicket?.id === ticket.id
                    ? "bg-amber-200/80 hover:bg-amber-200"
                    : index % 2 === 0
                      ? "bg-white hover:bg-slate-50"
                      : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-800">{resolveFlightLabel(ticket)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{resolveTouristLabel(ticket)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{ticket.ticketNumber || "-"}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{resolveTicketDeparture(ticket)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">{resolveTicketArrival(ticket)}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700">
                  {`${resolveTicketPrice(ticket)} ${resolveTicketCurrencyLabel(ticket)}`.trim()}
                </td>
                <td className={`border-b border-slate-100 px-2 py-1.5 font-medium ${
                  ticket.paid ? "text-emerald-700" : "text-rose-600"
                }`}>{ticket.paid ? "Paid" : "Unpaid"}</td>
              </tr>
            ))}
          </tbody>
          {query.data.length > 0 ? (() => {
            // Group tickets by currency to compute per-currency totals
            const totals: Record<string, { amount: number; label: string }> = {};
            for (const ticket of query.data) {
              const price = parseFloat(resolveTicketPrice(ticket)) || 0;
              const currLabel = resolveTicketCurrencyLabel(ticket) || "?";
              if (!totals[currLabel]) totals[currLabel] = { amount: 0, label: currLabel };
              totals[currLabel].amount += price;
            }
            const paidCount = query.data.filter((t) => t.paid).length;
            const totalEntries = Object.values(totals);
            return (
              <tfoot>
                <tr className="bg-slate-100 font-semibold text-slate-800">
                  <td className="px-2 py-1.5" colSpan={4}>
                    Total ({query.data.length} ticket{query.data.length === 1 ? "" : "s"}, {query.data.length} passenger{query.data.length === 1 ? "" : "s"})
                  </td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5">
                    {totalEntries.map((e) => `${e.amount.toFixed(2)} ${e.label}`).join(" + ")}
                  </td>
                  <td className="px-2 py-1.5">
                    {paidCount}/{query.data.length} Paid
                  </td>
                </tr>
              </tfoot>
            );
          })() : null}
        </table>
      )}

      {isAddOpen && typeof reservationId === "number" && reservationId > 0 ? (
        <ModalShell title="Add Flight Ticket" onClose={onCloseAdd}>
          <FlightTicketForm
            reservationId={reservationId}
            ownerType={ownerType}
            currencyOptions={currencyOptions}
            reservationCurrencyId={reservationCurrencyId}
            currencyCodeById={currencyCodeById}
            onCancel={onCloseAdd}
            onSuccess={() => {
              onCloseAdd();
              setToastMessage("Flight ticket added successfully.");
            }}
          />
        </ModalShell>
      ) : null}

      {isViewOpen && selectedTicket ? (
        <ModalShell title="View Flight Ticket" onClose={() => setIsViewOpen(false)}>
          <FlightTicketViewPanel ticket={selectedTicket} currencyLabel={currencyLabelById[selectedTicket.currencyId] ?? ""} />
        </ModalShell>
      ) : null}

      {isEditOpen && selectedTicket ? (
        <ModalShell title="Edit Flight Ticket" onClose={() => setIsEditOpen(false)}>
          <FlightTicketForm
            key={`edit-flight-ticket-${selectedTicket.id}`}
            reservationId={reservationId as number}
            ownerType={ownerType}
            currencyOptions={currencyOptions}
            reservationCurrencyId={reservationCurrencyId}
            currencyCodeById={currencyCodeById}
            ticket={selectedTicket}
            onCancel={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              setToastMessage("Flight ticket updated successfully.");
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
});

