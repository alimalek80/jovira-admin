"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AxiosError } from "axios";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HotelBookingManager,
  TransferServiceManager,
  ExcursionServiceManager,
  FlightTicketManager,
  type ReservationServiceManagerHandle,
} from "../../../components/reservations/ReservationServiceManagers";
import TouristManager from "@/components/reservations/TouristManager";
import { listTourists, updateReservationWithTourists } from "@/lib/api/tourists";
import axiosInstance from "@/lib/axios";
import { ACCOUNTS_ENDPOINTS, AGENCIES_ENDPOINTS, INVENTORY_ENDPOINTS, RESERVATIONS_ENDPOINTS, USER_ROLES } from "@/lib/api-endpoints";
import {
  buildReservationPayload,
  mapReservationValidationError,
  resolveNoTourPackageLabel,
  type ReservationFormState,
  type ReservationOwnerType,
} from "@/lib/reservations/admin-reservations";
import { convertCurrencyAmount, getAdminTourPackage } from "@/lib/api/tour-packages";
import {
  createHotelBooking,
  createTransferService,
  createFlightTicket,
  listHotelBookings,
  listTransferServices,
  listFlightTickets,
  updateHotelBooking,
  updateFlightTicket,
} from "@/lib/api/reservation-services";
import { listHotelRooms } from "@/lib/api/hotel-rooms";
import ActivityTimeline from "@/components/reservations/ActivityTimeline";


type ReservationRecord = {
  id: number;
  reservationNo: string;
  reservationDate: string;
  status: string;
  owner: string;
  ownerId: string;
  ownerType: ReservationOwnerType;
  tourPackage: string;
  tourPackageId: string;
  currency: string;
  currencyId: string;
  total: string;
};

type SelectOption = {
  id: string;
  value?: string;
  label: string;
};

type AgencyDetails = {
  id: string;
  name: string;
  agencyType: string;
  contactPerson: string;
  email: string;
  phone: string;
  mobilePhone: string;
  skypeId: string;
  icq: string;
};

type ReservationApiRow = Record<string, unknown>;

function resolveReservationSaveError(error: unknown): string {
  const responseData = (error as AxiosError)?.response?.data;

  if (typeof responseData === "string") {
    if (responseData.includes("no such column") || responseData.includes("OperationalError")) {
      return "Backend database schema is out of date. Run backend migrations and retry.";
    }
    return "Unable to save reservation due to a backend error.";
  }

  if (responseData && typeof responseData === "object") {
    const mappedValidationMessage = mapReservationValidationError(responseData);
    if (mappedValidationMessage) {
      return mappedValidationMessage;
    }

    const detail = (responseData as Record<string, unknown>).detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
    const nonFieldErrors = (responseData as Record<string, unknown>).non_field_errors;
    if (Array.isArray(nonFieldErrors) && typeof nonFieldErrors[0] === "string") {
      return nonFieldErrors[0];
    }
  }

  return "Unable to save reservation. Check backend required fields.";
}

const tableColumnHelper = createColumnHelper<ReservationRecord>();

const TAB_LABELS = [
  "Hotel",
  "Arrival",
  "Departure",
  "Transfer",
  "Flight Tickets",
  "Other",
  "Excursion",
  "Activity",
] as const;

type TabLabel = (typeof TAB_LABELS)[number];

const EMPTY_RESERVATION_FORM: ReservationFormState = {
  id: null,
  reservationNo: "",
  reservationDate: "",
  status: "DRAFT",
  ownerType: "AGENCY",
  agencyId: "",
  customerId: "",
  bookingMode: "WITH_TOUR_PACKAGE",
  tourPackageId: "",
  currencyId: "",
};

const RESERVATION_STATUS_FALLBACK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PENDING", label: "Pending" },
];

function toStatusLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : ""))
    .join(" ");
}

function normalizeStatusOptions(payload: unknown): Array<{ value: string; label: string }> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const actions = (payload as { actions?: Record<string, unknown> }).actions;
  const post = actions && typeof actions === "object" ? (actions.POST as Record<string, unknown> | undefined) : undefined;
  const statusField = post?.status as Record<string, unknown> | undefined;
  const rawChoices = statusField?.choices;

  if (!Array.isArray(rawChoices)) {
    return [];
  }

  return rawChoices
    .map((choice) => {
      if (!choice || typeof choice !== "object") {
        return null;
      }

      const row = choice as Record<string, unknown>;
      const valueRaw = row.value;
      const value = typeof valueRaw === "string" ? valueRaw.trim().toUpperCase() : "";
      if (!value) {
        return null;
      }

      const labelRaw = row.display_name;
      const label = typeof labelRaw === "string" && labelRaw.trim().length > 0 ? labelRaw.trim() : toStatusLabel(value);
      return { value, label };
    })
    .filter((option): option is { value: string; label: string } => Boolean(option));
}

function statusesFromReservations(payload: unknown): Array<{ value: string; label: string }> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  const values = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const rawStatus = (row as Record<string, unknown>).status;
    if (typeof rawStatus !== "string") {
      continue;
    }

    const normalized = rawStatus.trim().toUpperCase();
    if (!normalized) {
      continue;
    }

    values.add(normalized);
  }

  return [...values].map((value) => ({ value, label: toStatusLabel(value) }));
}

function normalizeReservationStatus(value: unknown): ReservationRecord["status"] {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized ? toStatusLabel(normalized) : "Draft";
}

function formatCurrencyDisplay(value: unknown): { code: string; id: string } {
  if (typeof value === "number") {
    return { code: String(value), id: String(value) };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return { code: trimmed, id: trimmed };
  }

  if (value && typeof value === "object") {
    const dictionary = value as Record<string, unknown>;
    const code =
      (dictionary.code as string | undefined) ??
      (dictionary.currency_code as string | undefined) ??
      (dictionary.iso_code as string | undefined) ??
      (typeof dictionary.id === "number" || typeof dictionary.id === "string" ? String(dictionary.id) : "");
    const id = typeof dictionary.id === "number" || typeof dictionary.id === "string" ? String(dictionary.id) : code;
    return { code: code?.trim() ?? "", id: id?.trim() ?? "" };
  }

  return { code: "", id: "" };
}

function formatRelationDisplay(value: unknown): { label: string; id: string } {
  if (typeof value === "number") {
    return { label: String(value), id: String(value) };
  }

  if (typeof value === "string") {
    return { label: value, id: value };
  }

  if (value && typeof value === "object") {
    const dictionary = value as Record<string, unknown>;
    const label =
      (dictionary.name as string | undefined) ??
      (dictionary.title as string | undefined) ??
      (dictionary.destination as string | undefined) ??
      (typeof dictionary.id === "number" || typeof dictionary.id === "string" ? String(dictionary.id) : "");
    const id = typeof dictionary.id === "number" || typeof dictionary.id === "string" ? String(dictionary.id) : label;
    return { label: label?.trim() ?? "", id: id?.trim() ?? "" };
  }

  return { label: "", id: "" };
}

function formatReservationOwnerDisplay(row: ReservationApiRow): {
  owner: string;
  ownerId: string;
  ownerType: ReservationOwnerType;
} {
  const agency = formatRelationDisplay(row.agency);
  if (agency.id || agency.label) {
    return {
      owner: agency.label,
      ownerId: agency.id,
      ownerType: "AGENCY",
    };
  }

  const customer = formatRelationDisplay(row.customer ?? row.user ?? row.owner);
  return {
    owner: customer.label || "Normal Customer",
    ownerId: customer.id,
    ownerType: "NORMAL",
  };
}

function normalizeReservations(payload: unknown): ReservationRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is ReservationApiRow => Boolean(row && typeof row === "object"))
    .map((row) => {
      const currency = formatCurrencyDisplay(row.currency);
      const owner = formatReservationOwnerDisplay(row);
      const tourPackage = formatRelationDisplay(row.tour_package);

      return {
        id: Number(row.id ?? 0),
        reservationNo: String(row.reservation_number ?? row.reservationNo ?? `RSV-${row.id ?? ""}`),
        reservationDate: formatDateInputValue(row.created_at ?? row.createdAt),
        status: normalizeReservationStatus(row.status),
        owner: owner.owner,
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
        tourPackage: resolveNoTourPackageLabel(tourPackage.label),
        tourPackageId: tourPackage.id,
        currency: currency.code,
        currencyId: currency.id,
        total: String(row.total ?? row.amount ?? row.grand_total ?? "-"),
      };
    })
    .filter((row) => row.id > 0);
}

function generateReservationNumber(existingRows: ReservationRecord[]): string {
  const year = new Date().getFullYear();
  const maxSequence = existingRows.reduce((highest, row) => {
    const match = row.reservationNo.match(/(\d{5})$/);
    const sequence = match ? Number(match[1]) : 0;
    return sequence > highest ? sequence : highest;
  }, 0);

  return `RSV-${year}-${String(maxSequence + 1).padStart(5, "0")}`;
}

function normalizeCurrencyOptions(payload: unknown): SelectOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  const optionsMap = new Map<string, SelectOption>();

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const dictionary = row as Record<string, unknown>;
    const codeRaw =
      (dictionary.code as string | undefined) ??
      (dictionary.currency as string | undefined) ??
      (dictionary.currency_code as string | undefined) ??
      (dictionary.iso_code as string | undefined);

    if (!codeRaw || typeof codeRaw !== "string") {
      continue;
    }

    const code = codeRaw.trim().toUpperCase();

    if (!code) {
      continue;
    }

    // Prefer name_en (actual API field), then name, then fallbacks
    const name =
      (dictionary.name_en as string | undefined) ??
      (dictionary.name as string | undefined) ??
      (dictionary.currency_name as string | undefined) ??
      (dictionary.title as string | undefined);

    const symbol = dictionary.symbol as string | undefined;
    const symbolPart = symbol && typeof symbol === "string" ? ` (${symbol})` : "";
    const id =
      typeof dictionary.id === "number" || typeof dictionary.id === "string"
        ? String(dictionary.id)
        : code;

    optionsMap.set(code, {
      id,
      label: name && typeof name === "string" ? `${code} - ${name}${symbolPart}` : code,
    });
  }

  return [...optionsMap.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeGenericOptions(payload: unknown, labelKeys: string[]): SelectOption[] {
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
        labelKeys
          .map((key) => row[key])
          .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? id;

      return {
        id,
        label,
      };
    })
    .filter((option) => option.id.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeNormalCustomerOptions(payload: unknown): SelectOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .filter((row) => String(row.role ?? "").toUpperCase() === USER_ROLES.NORMAL)
    .map((row) => {
      const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
      const fullName = [row.first_name, row.last_name]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .trim();
      const email = typeof row.email === "string" ? row.email.trim() : "";

      return {
        id,
        label: fullName || email || id,
      };
    })
    .filter((option) => option.id.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeAgencyDetailsById(payload: unknown): Record<string, AgencyDetails> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .reduce<Record<string, AgencyDetails>>((accumulator, row) => {
      const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
      if (!id) {
        return accumulator;
      }

      accumulator[id] = {
        id,
        name: String(row.name ?? ""),
        agencyType: String(row.agency_type ?? ""),
        contactPerson: String(row.contact_person ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.phone ?? ""),
        mobilePhone: String(row.mobile_phone ?? ""),
        skypeId: String(row.skype_id ?? ""),
        icq: String(row.icq ?? ""),
      };

      return accumulator;
    }, {});
}

function formatDateInputValue(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  const normalized = value.includes("T") ? value.slice(0, 10) : value;
  return normalized.trim();
}

function addDays(dateIso: string, daysToAdd: number) {
  const baseDate = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) {
    return dateIso;
  }

  baseDate.setDate(baseDate.getDate() + Math.max(daysToAdd, 0));
  return baseDate.toISOString().slice(0, 10);
}

type FlightInventoryDetail = {
  id: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureAtRaw: string;
  departureDate: string;
  arrivalDate: string;
  publicPrice: string;
  agencyPrice: string;
  currency: number | null;
  currencyCode: string;
};

function normalizeCurrencyCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function findCurrencyIdByCode(code: string, currencyCodeById?: Record<string, string>): number | null {
  if (!currencyCodeById || !code) {
    return null;
  }

  for (const [id, mappedCode] of Object.entries(currencyCodeById)) {
    if (mappedCode === code) {
      const parsed = Number.parseInt(id, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function resolveCurrencyNumericId(value: unknown, currencyCodeById?: Record<string, string>): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return findCurrencyIdByCode(trimmed.toUpperCase(), currencyCodeById);
  }

  return null;
}

function toFlightInventoryDetail(payload: unknown, fallbackId: number): FlightInventoryDetail {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const departureDate = formatDateInputValue(row.departure_time);
  const arrivalDate = formatDateInputValue(row.arrival_time);
  const currencyRaw = row.currency;
  const parsedCurrency =
    typeof currencyRaw === "number"
      ? currencyRaw
      : typeof currencyRaw === "string"
        ? Number.parseInt(currencyRaw, 10)
        : currencyRaw && typeof currencyRaw === "object" && typeof (currencyRaw as { id?: unknown }).id !== "undefined"
          ? Number.parseInt(String((currencyRaw as { id?: unknown }).id), 10)
          : Number.NaN;

  const currencyCode =
    typeof currencyRaw === "string"
      ? normalizeCurrencyCode(currencyRaw)
      : currencyRaw && typeof currencyRaw === "object"
        ? normalizeCurrencyCode(
          (currencyRaw as Record<string, unknown>).code ??
          (currencyRaw as Record<string, unknown>).currency_code ??
          (currencyRaw as Record<string, unknown>).iso_code
        )
        : "";

  return {
    id: fallbackId,
    flightNumber: String(row.flight_number ?? fallbackId),
    airline: String(row.airline ?? ""),
    origin: String(row.origin ?? ""),
    destination: String(row.destination ?? ""),
    departureAtRaw: typeof row.departure_time === "string" ? row.departure_time : "",
    departureDate,
    arrivalDate,
    publicPrice: String(row.public_price ?? row.price ?? "0"),
    agencyPrice: String(row.agency_price ?? row.public_price ?? row.price ?? "0"),
    currency: Number.isFinite(parsedCurrency) ? parsedCurrency : null,
    currencyCode,
  };
}

function resolveFlightPriceForOwner(
  flight: FlightInventoryDetail,
  ownerType: ReservationOwnerType
): string {
  if (ownerType === "AGENCY") {
    return flight.agencyPrice || flight.publicPrice || "0";
  }

  return flight.publicPrice || flight.agencyPrice || "0";
}

async function convertToReservationCurrency(args: {
  amount: string;
  sourceCurrencyId: number | null;
  sourceCurrencyCode?: string;
  reservationCurrencyId?: string;
  currencyCodeById?: Record<string, string>;
}): Promise<{ amount: string; currencyId: number | null }> {
  const parsedAmount = Number.parseFloat(args.amount);
  if (!Number.isFinite(parsedAmount)) {
    return {
      amount: "0.00",
      currencyId: args.sourceCurrencyId,
    };
  }

  const sourceCurrencyId = args.sourceCurrencyId;
  const targetCurrencyId = resolveCurrencyNumericId(args.reservationCurrencyId, args.currencyCodeById);
  const sourceCode =
    normalizeCurrencyCode(args.sourceCurrencyCode) ||
    (sourceCurrencyId ? args.currencyCodeById?.[String(sourceCurrencyId)] ?? "" : "");
  const targetCode =
    (targetCurrencyId ? args.currencyCodeById?.[String(targetCurrencyId)] : "") ||
    normalizeCurrencyCode(args.reservationCurrencyId);

  if (!targetCode || !sourceCode || sourceCode === targetCode) {
    return {
      amount: parsedAmount.toFixed(2),
      currencyId: targetCurrencyId ?? sourceCurrencyId,
    };
  }

  try {
    const converted = await convertCurrencyAmount({
      from: sourceCode,
      to: targetCode,
      amount: parsedAmount,
    });

    return {
      amount: Number.isFinite(converted) ? converted.toFixed(2) : parsedAmount.toFixed(2),
      currencyId: targetCurrencyId ?? findCurrencyIdByCode(targetCode, args.currencyCodeById) ?? sourceCurrencyId,
    };
  } catch {
    // Even when amount conversion fails, still use the reservation currency
    // so at least the currency label is correct (user can adjust amount manually)
    return {
      amount: parsedAmount.toFixed(2),
      currencyId: targetCurrencyId ?? sourceCurrencyId,
    };
  }
}

async function loadFlightDetails(flightIds: number[]): Promise<FlightInventoryDetail[]> {
  if (flightIds.length === 0) {
    return [];
  }

  const details = await Promise.all(
    flightIds.map(async (flightId) => {
      const data = await axiosInstance
        .get(`${INVENTORY_ENDPOINTS.adminFlights}${flightId}/`)
        .then((response) => response.data)
        .catch(() => null);

      return toFlightInventoryDetail(data, flightId);
    })
  );

  return details;
}

function pickArrivalDepartureFlights(flights: FlightInventoryDetail[]): FlightInventoryDetail[] {
  if (flights.length <= 2) {
    return flights;
  }

  const sorted = [...flights].sort((left, right) => {
    const leftTime = Date.parse(left.departureAtRaw || `${left.departureDate || "1970-01-01"}T00:00:00`);
    const rightTime = Date.parse(right.departureAtRaw || `${right.departureDate || "1970-01-01"}T00:00:00`);
    return leftTime - rightTime;
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.id === last.id) {
    return [first];
  }

  return [first, last];
}

function buildAutoTicketNumber(args: {
  reservationId: number;
  touristId: number | null;
  flightNumber: string;
  legCode: "ARR" | "DEP";
}) {
  const safeFlight = args.flightNumber.replace(/\s+/g, "").slice(0, 12) || "FLT";
  const paxPart = args.touristId ? `P${args.touristId}` : "P0";
  return `${safeFlight}-${args.reservationId}-${paxPart}-${args.legCode}`;
}

async function prefillReservationServicesFromTourPackage(args: {
  reservationId: number;
  reservationDate: string;
  tourPackageId: string;
  ownerType: ReservationOwnerType;
  reservationCurrencyId?: string;
  currencyCodeById?: Record<string, string>;
}) {
  const parsedTourPackageId = Number.parseInt(args.tourPackageId, 10);
  if (!Number.isFinite(parsedTourPackageId)) {
    return { createdHotels: 0, createdTransfers: 0, createdTickets: 0 };
  }

  const tourPackage = await getAdminTourPackage(parsedTourPackageId);
  const checkInDate = formatDateInputValue(args.reservationDate) || new Date().toISOString().slice(0, 10);
  const checkOutDate = addDays(checkInDate, Math.max(tourPackage.nights, 1));

  const [existingHotels, existingTransfers, existingTickets, tourists, flightDetailsAll] = await Promise.all([
    listHotelBookings("admin", args.reservationId),
    listTransferServices("admin", args.reservationId),
    listFlightTickets(args.reservationId),
    listTourists("admin", { reservationId: args.reservationId }),
    loadFlightDetails(tourPackage.flights),
  ]);
  const selectedFlights = pickArrivalDepartureFlights(flightDetailsAll);

  const existingHotelRoomIds = new Set(existingHotels.map((booking) => booking.hotelRoomId));
  const existingTransferIds = new Set(existingTransfers.map((service) => service.transferCatalogId));

  const existingTicketKeys = new Set(
    existingTickets.map((ticket) => `${ticket.flightId}-${ticket.touristId}`)
  );

  let createdHotels = 0;
  let createdTransfers = 0;
  let createdTickets = 0;

  for (const hotelId of tourPackage.hotels) {
    const parsedHotelId = Number(hotelId);

    if (!Number.isFinite(parsedHotelId) || parsedHotelId <= 0) {
      continue;
    }

    const hotelRooms = await listHotelRooms(parsedHotelId);

    const selectedRoom =
      hotelRooms.find(
        (room) =>
          room.date_from <= checkInDate &&
          room.date_to >= checkOutDate &&
          room.availability_count > 0
      ) ??
      hotelRooms.find((room) => room.availability_count > 0) ??
      hotelRooms[0];

    if (!selectedRoom) {
      continue;
    }

    if (existingHotelRoomIds.has(selectedRoom.id)) {
      continue;
    }

    const hotelBasePriceRaw =
      args.ownerType === "AGENCY"
        ? selectedRoom.agency_price ?? selectedRoom.public_price ?? "0"
        : selectedRoom.public_price ?? selectedRoom.agency_price ?? "0";

    const convertedHotel = await convertToReservationCurrency({
      amount: String(hotelBasePriceRaw ?? "0"),
      sourceCurrencyId: selectedRoom.currency,
      sourceCurrencyCode: args.currencyCodeById?.[String(selectedRoom.currency)] ?? "",
      reservationCurrencyId: args.reservationCurrencyId,
      currencyCodeById: args.currencyCodeById,
    });

    await createHotelBooking("admin", {
      reservation: args.reservationId,
      hotel_room: selectedRoom.id,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      quantity: 1,
      status: "PENDING",
      is_paid: false,
      selling_currency: Number(convertedHotel.currencyId) || selectedRoom.currency,
      price: convertedHotel.amount,
      agency_price: convertedHotel.amount,
      cost_currency: selectedRoom.currency,
      cost: selectedRoom.cost_price ?? "0.00",
      cross_currency_rate: "1.0000000000",
      confirm_booking_number: "",
      agent_confirmation_number: "",
      hotel_cancellation_number: "",
      internal_note: "Created from tour package prefill.",
      remarks_for_hotel: "",
      tourists: [],
    });

    createdHotels += 1;
  }

  for (const transferId of tourPackage.transfers) {
    if (existingTransferIds.has(String(transferId))) {
      continue;
    }

    const transferDetail = await axiosInstance
      .get(`${INVENTORY_ENDPOINTS.adminTransfers}${transferId}/`)
      .then((response) => response.data as Record<string, unknown>)
      .catch(() => null);

    const transferPriceRaw = transferDetail?.agency_price ?? transferDetail?.public_price ?? "0";
    const transferCurrencyRaw = transferDetail?.currency ?? tourPackage.currency;
    const transferCurrency =
      typeof transferCurrencyRaw === "number"
        ? transferCurrencyRaw
        : Number.parseInt(String(transferCurrencyRaw ?? ""), 10) || tourPackage.currency;

    await createTransferService("admin", {
      reservation: args.reservationId,
      tour_package: parsedTourPackageId,
      transfer: transferId,
      service_name: String(transferDetail?.name ?? `Transfer #${transferId}`),
      service_date: checkInDate,
      on_arrival: true,
      on_departure: false,
      from_location_type: String(transferDetail?.from_location_type ?? "OTHER"),
      from_location_name: String(transferDetail?.from_location ?? ""),
      to_location_type: String(transferDetail?.to_location_type ?? "OTHER"),
      to_location_name: String(transferDetail?.to_location ?? ""),
      price: String(transferPriceRaw ?? "0"),
      currency: transferCurrency,
      passengers: [],
      external_note: "",
      driver_note: "",
    });

    createdTransfers += 1;
  }

  for (const [flightIndex, flight] of selectedFlights.entries()) {
    const legCode: "ARR" | "DEP" = selectedFlights.length > 1 && flightIndex === selectedFlights.length - 1 ? "DEP" : "ARR";
    if (tourists.length === 0) {
      // No tourists yet — create one unassigned placeholder ticket so the flight appears in the list.
      // Admin can edit/duplicate later to assign passengers.
      const key = `${flight.id}-unassigned`;
      if (!existingTicketKeys.has(key)) {
        const convertedFlight = await convertToReservationCurrency({
          amount: resolveFlightPriceForOwner(flight, args.ownerType),
          sourceCurrencyId: flight.currency,
          sourceCurrencyCode: flight.currencyCode,
          reservationCurrencyId: args.reservationCurrencyId,
          currencyCodeById: args.currencyCodeById,
        });

        await createFlightTicket({
          reservation: args.reservationId,
          flight: flight.id,
          tourist: null,
          departure_date: flight.departureDate || null,
          arrival_date: flight.arrivalDate || null,
          departing_date: flight.departureDate || null,
          arriving_date: flight.arrivalDate || null,
          ticket_number: buildAutoTicketNumber({
            reservationId: args.reservationId,
            touristId: null,
            flightNumber: flight.flightNumber,
            legCode,
          }),
          pnr: buildAutoTicketNumber({
            reservationId: args.reservationId,
            touristId: null,
            flightNumber: flight.flightNumber,
            legCode,
          }),
          price: convertedFlight.amount,
          currency: convertedFlight.currencyId,
          paid: false,
          is_paid: false,
        });
        existingTicketKeys.add(key);
        createdTickets += 1;
      }
    } else {
      // Create one ticket per tourist per flight
      for (const tourist of tourists) {
        const key = `${flight.id}-${tourist.id}`;
        if (existingTicketKeys.has(key)) {
          continue;
        }

        const convertedFlight = await convertToReservationCurrency({
          amount: resolveFlightPriceForOwner(flight, args.ownerType),
          sourceCurrencyId: flight.currency,
          sourceCurrencyCode: flight.currencyCode,
          reservationCurrencyId: args.reservationCurrencyId,
          currencyCodeById: args.currencyCodeById,
        });

        await createFlightTicket({
          reservation: args.reservationId,
          flight: flight.id,
          tourist: tourist.id,
          departure_date: flight.departureDate || null,
          arrival_date: flight.arrivalDate || null,
          departing_date: flight.departureDate || null,
          arriving_date: flight.arrivalDate || null,
          ticket_number: buildAutoTicketNumber({
            reservationId: args.reservationId,
            touristId: tourist.id,
            flightNumber: flight.flightNumber,
            legCode,
          }),
          pnr: buildAutoTicketNumber({
            reservationId: args.reservationId,
            touristId: tourist.id,
            flightNumber: flight.flightNumber,
            legCode,
          }),
          price: convertedFlight.amount,
          currency: convertedFlight.currencyId,
          paid: false,
          is_paid: false,
        });

        existingTicketKeys.add(key);
        createdTickets += 1;
      }
    }
  }

  return { createdHotels, createdTransfers, createdTickets };
}

async function syncReservationServiceCurrencies(args: {
  reservationId: number;
  reservationCurrencyId?: string;
  ownerType: ReservationOwnerType;
  currencyCodeById?: Record<string, string>;
}) {
  if (!args.reservationCurrencyId) {
    return;
  }

  const [tickets, hotels] = await Promise.all([
    listFlightTickets(args.reservationId),
    listHotelBookings("admin", args.reservationId),
  ]);

  if (tickets.length > 0) {
    const flightIds = tickets
      .map((ticket) => Number.parseInt(ticket.flightId, 10))
      .filter((id) => Number.isFinite(id));
    const uniqueFlightIds = Array.from(new Set(flightIds));
    const flightDetails = await loadFlightDetails(uniqueFlightIds);
    const flightById = new Map<number, FlightInventoryDetail>(flightDetails.map((f) => [f.id, f]));

    for (const ticket of tickets) {
      const flightId = Number.parseInt(ticket.flightId, 10);
      const detail = Number.isFinite(flightId) ? flightById.get(flightId) : undefined;

      const ticketPrice = Number.parseFloat(ticket.price);
      const fallbackPrice = detail ? Number.parseFloat(resolveFlightPriceForOwner(detail, args.ownerType)) : Number.NaN;
      const sourceAmount = Number.isFinite(ticketPrice) && ticketPrice > 0
        ? ticket.price
        : Number.isFinite(fallbackPrice)
          ? fallbackPrice.toFixed(2)
          : "0.00";

      const sourceCurrencyId = ticket.currencyId
        ? resolveCurrencyNumericId(ticket.currencyId, args.currencyCodeById)
        : detail?.currency ?? null;
      const sourceCurrencyCode = normalizeCurrencyCode(ticket.currencyId) || detail?.currencyCode || "";

      const converted = await convertToReservationCurrency({
        amount: sourceAmount,
        sourceCurrencyId,
        sourceCurrencyCode,
        reservationCurrencyId: args.reservationCurrencyId,
        currencyCodeById: args.currencyCodeById,
      });

      await updateFlightTicket(ticket.id, {
        reservation: args.reservationId,
        price: converted.amount,
        currency: converted.currencyId,
      });
    }
  }

  if (hotels.length > 0) {
    const hotelRoomIds = hotels
      .map((hotel) => hotel.hotelRoomId)
      .filter((id) => Number.isFinite(id));

    const uniqueHotelRoomIds = Array.from(new Set(hotelRoomIds));

    const hotelRoomDetails = await Promise.all(
      uniqueHotelRoomIds.map(async (hotelRoomId) => {
        const row = await axiosInstance
          .get(`${INVENTORY_ENDPOINTS.adminHotelRooms}${hotelRoomId}/`)
          .then((response) => response.data as Record<string, unknown>)
          .catch(() => null);

        return [hotelRoomId, row] as const;
      })
    );

    const hotelRoomById = new Map<number, Record<string, unknown> | null>(hotelRoomDetails);

    for (const hotel of hotels) {
      const detail = hotelRoomById.get(hotel.hotelRoomId) ?? null;

      const hotelPrice = Number.parseFloat(hotel.price ?? "");
      const fallbackPriceRaw =
        args.ownerType === "AGENCY"
          ? detail?.agency_price ?? detail?.public_price
          : detail?.public_price ?? detail?.agency_price;

      const fallbackPrice = Number.parseFloat(String(fallbackPriceRaw ?? ""));
      const sourceAmount =
        Number.isFinite(hotelPrice) && hotelPrice > 0
          ? String(hotel.price)
          : Number.isFinite(fallbackPrice)
            ? fallbackPrice.toFixed(2)
            : "0.00";

      const detailCurrencyRaw = detail?.currency;
      const detailCurrencyId = resolveCurrencyNumericId(detailCurrencyRaw, args.currencyCodeById);
      const detailCurrencyCode =
        typeof detailCurrencyRaw === "string"
          ? normalizeCurrencyCode(detailCurrencyRaw)
          : detailCurrencyRaw && typeof detailCurrencyRaw === "object"
            ? normalizeCurrencyCode(
              (detailCurrencyRaw as Record<string, unknown>).code ??
              (detailCurrencyRaw as Record<string, unknown>).currency_code ??
              (detailCurrencyRaw as Record<string, unknown>).iso_code
            )
            : "";

      const sourceCurrencyId = hotel.sellingCurrencyId
        ? resolveCurrencyNumericId(hotel.sellingCurrencyId, args.currencyCodeById)
        : detailCurrencyId;

      const sourceCurrencyCode = normalizeCurrencyCode(hotel.sellingCurrencyId) || detailCurrencyCode;

      const converted = await convertToReservationCurrency({
        amount: sourceAmount,
        sourceCurrencyId,
        sourceCurrencyCode,
        reservationCurrencyId: args.reservationCurrencyId,
        currencyCodeById: args.currencyCodeById,
      });

      await updateHotelBooking("admin", hotel.id, {
        reservation: args.reservationId,
        selling_currency: Number(converted.currencyId) || sourceCurrencyId || null,
        price: converted.amount,
        agency_price: converted.amount,
      });
    }
  }
}



function ReservationFormPanel({
  form,
  statusOptions,
  statusesLoading,
  currencyOptions,
  agencyOptions,
  customerOptions,
  selectedAgencyDetails,
  tourPackageOptions,
  currenciesLoading,
  relatedLoading,
  onChange,
  onSave,
  isSaving,
}: {
  form: ReservationFormState;
  statusOptions: Array<{ value: string; label: string }>;
  statusesLoading: boolean;
  currencyOptions: SelectOption[];
  agencyOptions: SelectOption[];
  customerOptions: SelectOption[];
  selectedAgencyDetails: AgencyDetails | null;
  tourPackageOptions: SelectOption[];
  currenciesLoading: boolean;
  relatedLoading: boolean;
  onChange: <K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Reservation Form</h2>
      </div>

      <form
        className="grid gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="reservationNo" className="mb-1 block text-xs font-medium text-slate-600">
              Reservation No
            </label>
            <input
              id="reservationNo"
              value={form.reservationNo}
              readOnly
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 outline-none"
            />
          </div>
          <div>
            <label htmlFor="reservationDate" className="mb-1 block text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              id="reservationDate"
              type="date"
              value={form.reservationDate}
              readOnly
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 outline-none"
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reservation Setup</p>
          <div className="grid gap-3">
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-600">Reservation Owner</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange("ownerType", "AGENCY")}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition ${form.ownerType === "AGENCY"
                    ? "border-[#0f2347] bg-[#0f2347] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  Agency
                </button>
                <button
                  type="button"
                  onClick={() => onChange("ownerType", "NORMAL")}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition ${form.ownerType === "NORMAL"
                    ? "border-[#0f2347] bg-[#0f2347] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  Normal Customer
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-600">Reservation Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange("bookingMode", "WITH_TOUR_PACKAGE")}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition ${form.bookingMode === "WITH_TOUR_PACKAGE"
                    ? "border-[#0f2347] bg-[#0f2347] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  With Tour Package
                </button>
                <button
                  type="button"
                  onClick={() => onChange("bookingMode", "STANDALONE_SERVICES")}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition ${form.bookingMode === "STANDALONE_SERVICES"
                    ? "border-[#0f2347] bg-[#0f2347] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  Standalone Services
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ownerId" className="mb-1 block text-xs font-medium text-slate-600">
              {form.ownerType === "AGENCY" ? "Agency" : "Normal Customer"}
            </label>
            <select
              id="ownerId"
              value={form.ownerType === "AGENCY" ? form.agencyId : form.customerId}
              onChange={(event) =>
                form.ownerType === "AGENCY"
                  ? onChange("agencyId", event.target.value)
                  : onChange("customerId", event.target.value)
              }
              disabled={relatedLoading}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {relatedLoading ? <option value="">Loading owners...</option> : null}
              {!relatedLoading && form.ownerType === "AGENCY" && agencyOptions.length === 0 ? (
                <option value="">No agencies available</option>
              ) : null}
              {!relatedLoading && form.ownerType === "NORMAL" && customerOptions.length === 0 ? (
                <option value="">No normal customers available</option>
              ) : null}
              {!relatedLoading && form.ownerType === "AGENCY"
                ? agencyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))
                : null}
              {!relatedLoading && form.ownerType === "NORMAL"
                ? customerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))
                : null}
            </select>
          </div>

          <div>
            {form.bookingMode === "WITH_TOUR_PACKAGE" ? (
              <>
                <label htmlFor="tourPackageId" className="mb-1 block text-xs font-medium text-slate-600">
                  Tour Package
                </label>
                <select
                  id="tourPackageId"
                  value={form.tourPackageId}
                  onChange={(event) => onChange("tourPackageId", event.target.value)}
                  disabled={relatedLoading}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {relatedLoading ? (
                    <option value="">Loading tour packages...</option>
                  ) : tourPackageOptions.length === 0 ? (
                    <option value="">No tour packages available</option>
                  ) : (
                    tourPackageOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              </>
            ) : (
              <div className="flex h-full items-end">
                <div className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                  Standalone mode — no tour package.
                </div>
              </div>
            )}
          </div>
        </div>

        {form.ownerType === "AGENCY" && selectedAgencyDetails ? (
          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Agency Details</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Name</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.name || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Agency Type</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.agencyType || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Contact Person</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.contactPerson || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Email</p>
                <p className="break-all text-[11px] font-medium text-slate-800">{selectedAgencyDetails.email || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Phone</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.phone || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Mobile Phone</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.mobilePhone || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Skype</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.skypeId || "-"}</p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">ICQ</p>
                <p className="text-[11px] font-medium text-slate-800">{selectedAgencyDetails.icq || "-"}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="status"
              value={form.status}
              onChange={(event) => onChange("status", event.target.value)}
              disabled={statusesLoading}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
            >
              {statusesLoading ? (
                <option value="">Loading statuses...</option>
              ) : statusOptions.length === 0 ? (
                <option value="">No statuses available</option>
              ) : (
                statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="currency" className="mb-1 block text-xs font-medium text-slate-600">
              Currency
            </label>
            <select
              id="currency"
              value={form.currencyId}
              onChange={(event) => onChange("currencyId", event.target.value)}
              disabled={currenciesLoading}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
            >
              {currenciesLoading ? (
                <option value="">Loading currencies...</option>
              ) : currencyOptions.length === 0 ? (
                <option value="">No currencies available</option>
              ) : (
                currencyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ReservationRecordsTable({
  rows,
  loading,
  selectedReservationId,
  onSelect,
  onAdd,
  onFinalize,
  canFinalize,
  isFinalizing,
  onTake,
  canTake,
  isTaking,
  onConfirm,
  canConfirm,
  isConfirming,
  ownerLabelById,
  tourPackageLabelById,
  currencyLabelById,
}: {
  rows: ReservationRecord[];
  loading: boolean;
  selectedReservationId: number | null;
  onSelect: (row: ReservationRecord) => void;
  onAdd: () => void;
  onFinalize: () => void;
  canFinalize: boolean;
  isFinalizing: boolean;
  onTake: () => void;
  canTake: boolean;
  isTaking: boolean;
  onConfirm: () => void;
  canConfirm: boolean;
  isConfirming: boolean;
  ownerLabelById: Record<string, string>;
  tourPackageLabelById: Record<string, string>;
  currencyLabelById: Record<string, string>;
}) {
  const statusClassName = (status: string) => {
    const normalized = status.trim().toUpperCase().replaceAll(" ", "_");

    if (normalized === "CONFIRMED") {
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    }

    if (normalized === "PENDING") {
      return "border-amber-300 bg-amber-50 text-amber-700";
    }

    if (normalized === "CANCELED" || normalized === "CANCELLED") {
      return "border-rose-300 bg-rose-50 text-rose-700";
    }

    if (normalized === "ON_PROCESS" || normalized === "IN_PROGRESS") {
      return "border-sky-300 bg-sky-50 text-sky-700";
    }

    if (normalized === "NEW") {
      return "border-violet-300 bg-violet-50 text-violet-700";
    }

    if (normalized === "DRAFT") {
      return "border-slate-300 bg-slate-100 text-slate-700";
    }

    return "border-indigo-300 bg-indigo-50 text-indigo-700";
  };

  const columns = useMemo(
    () => [
      tableColumnHelper.accessor("reservationNo", {
        header: "Reservation No",
        cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
      }),
      tableColumnHelper.accessor("owner", {
        header: "Owner",
        cell: (info) => (
          <span className="text-[11px] text-slate-700">
            {ownerLabelById[info.row.original.ownerId] || info.getValue()}
          </span>
        ),
      }),
      tableColumnHelper.accessor("tourPackage", {
        header: "Tour Package",
        cell: (info) => (
          <span
            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${info.row.original.tourPackageId
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
          >
            {info.row.original.tourPackageId
              ? tourPackageLabelById[info.row.original.tourPackageId] || info.getValue()
              : "No tour package"}
          </span>
        ),
      }),
      tableColumnHelper.accessor("currency", {
        header: "Currency",
        cell: (info) => (
          <span className="text-[11px] text-slate-700">
            {currencyLabelById[info.row.original.currencyId] || info.getValue()}
          </span>
        ),
      }),
      tableColumnHelper.accessor("total", {
        header: "Total",
        cell: (info) => <span className="text-right font-semibold text-slate-800">{info.getValue()}</span>,
      }),
      tableColumnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const value = info.getValue();

          return (
            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(value)}`}>
              {value}
            </span>
          );
        },
      }),
    ],
    [currencyLabelById, ownerLabelById, tourPackageLabelById]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="rounded-xl border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Table settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Filter"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Refresh"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.12-3.36L23 10" />
              <path d="M20.49 15a9 9 0 0 1-14.12 3.36L1 14" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#0f2347] bg-[#0f2347] px-3 text-[11px] font-semibold text-white hover:bg-[#0b1b38]"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>

          <Link
            href="/work-desk"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Work Desk
          </Link>

          <button
            type="button"
            onClick={onTake}
            disabled={!canTake || isTaking}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {isTaking ? "Taking..." : "Take"}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isConfirming}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-[#0f2347] bg-[#0f2347] px-3 text-[11px] font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            {isConfirming ? "Confirming..." : "Confirm"}
          </button>

          <h3 className="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-700">Reservations</h3>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">{rows.length} records</span>
            <button
              type="button"
              onClick={onFinalize}
              disabled={!canFinalize || isFinalizing}
              className="inline-flex h-8 items-center rounded border border-[#0f2347] bg-[#0f2347] px-3 text-[11px] font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFinalizing ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[42vh] overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="border-b border-slate-200 px-3 py-2 font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-5 text-xs text-slate-500" colSpan={columns.length}>
                  Loading reservations...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-xs text-slate-500" colSpan={columns.length}>
                  No reservations added yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => {
                const isSelected = row.original.id === selectedReservationId;

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect(row.original)}
                    className={`${isSelected
                      ? "bg-amber-200/80 hover:bg-amber-200"
                      : index % 2 === 0
                        ? "bg-white hover:bg-slate-50"
                        : "bg-slate-50/70 hover:bg-slate-100/80"
                      } cursor-pointer`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="border-b border-slate-100 px-3 py-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReservationTabsPanel({
  reservationId,
  ownerType,
  tourPackageId,
  currencyOptions,
  reservationCurrencyId,
  currencyCodeById,
  onHotelBookingSelected,
}: {
  reservationId: number | null;
  ownerType: ReservationOwnerType;
  tourPackageId?: string;
  currencyOptions: Array<{ id: string; label: string }>;
  reservationCurrencyId?: string;
  currencyCodeById?: Record<string, string>;
  onHotelBookingSelected?: (touristIds: number[] | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabLabel>("Hotel");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const hotelManagerRef = useRef<ReservationServiceManagerHandle | null>(null);
  const transferManagerRef = useRef<ReservationServiceManagerHandle | null>(null);
  const excursionManagerRef = useRef<ReservationServiceManagerHandle | null>(null);
  const flightTicketManagerRef = useRef<ReservationServiceManagerHandle | null>(null);
  const actionButtons = [
    { label: "Add", primary: true },
    { label: "Edit" },
    { label: "View" },
    { label: "Delete" },
    { label: "Copy" },
    { label: "Tourist" },
    { label: "Purchase" },
    { label: "Compose email" },
    { label: "Reports" },
    { label: "Set Confirmation" },
  ];

  const supportsActiveTabAdd = activeTab === "Hotel" || activeTab === "Transfer" || activeTab === "Excursion" || activeTab === "Flight Tickets";
  const supportsSelectedRowActions = activeTab === "Hotel" || activeTab === "Transfer" || activeTab === "Excursion" || activeTab === "Flight Tickets";

  const runSelectedRowAction = (action: "edit" | "view" | "delete") => {
    const manager =
      activeTab === "Hotel"
        ? hotelManagerRef.current
        : activeTab === "Excursion"
          ? excursionManagerRef.current
          : activeTab === "Flight Tickets"
            ? flightTicketManagerRef.current
            : transferManagerRef.current;

    if (!manager) {
      return;
    }

    if (action === "edit") {
      manager.openEdit();
      return;
    }

    if (action === "view") {
      manager.openView();
      return;
    }

    manager.deleteSelected();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-300 bg-white">
      <div className="overflow-x-auto border-b border-slate-200 px-2 py-1.5">
        <div className="flex min-w-max gap-1">
          {TAB_LABELS.map((tabLabel) => (
            <button
              key={tabLabel}
              type="button"
              onClick={() => {
                setActiveTab(tabLabel);
                setIsAddModalOpen(false);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${activeTab === tabLabel
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {tabLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200 px-2 py-1.5">
        <div className="flex min-w-max items-center gap-1.5">
          <button
            type="button"
            aria-label="Table settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Filter"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3" />
            </svg>
          </button>

          {actionButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              onClick={
                button.label === "Add"
                  ? () => setIsAddModalOpen(true)
                  : button.label === "Edit"
                    ? () => runSelectedRowAction("edit")
                    : button.label === "View"
                      ? () => runSelectedRowAction("view")
                      : button.label === "Delete"
                        ? () => runSelectedRowAction("delete")
                        : undefined
              }
              disabled={
                button.label === "Add"
                  ? !supportsActiveTabAdd || !reservationId
                  : button.label === "Edit" || button.label === "View" || button.label === "Delete"
                    ? !supportsSelectedRowActions || !reservationId
                    : true
              }
              className={`inline-flex h-8 items-center rounded border px-3 text-xs font-semibold transition ${button.primary
                ? "border-[#0f2347] bg-[#0f2347] text-white hover:bg-[#0b1b38]"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Hotel" ? (
        <HotelBookingManager
          ref={hotelManagerRef}
          key={`hotel-${reservationId ?? "none"}`}
          reservationId={reservationId}
          ownerType={ownerType}
          currencyOptions={currencyOptions}
          reservationCurrencyId={reservationCurrencyId}
          currencyCodeById={currencyCodeById}
          isAddOpen={isAddModalOpen}
          onCloseAdd={() => setIsAddModalOpen(false)}
          onSelectBooking={onHotelBookingSelected}
        />
      ) : activeTab === "Transfer" ? (
        <TransferServiceManager
          ref={transferManagerRef}
          key={`transfer-${reservationId ?? "none"}`}
          reservationId={reservationId}
          tourPackageId={tourPackageId}
          currencyOptions={currencyOptions}
          isAddOpen={isAddModalOpen}
          onCloseAdd={() => setIsAddModalOpen(false)}
        />
      ) : activeTab === "Excursion" ? (
        <ExcursionServiceManager
          ref={excursionManagerRef}
          isAddOpen={isAddModalOpen}
          onCloseAdd={() => setIsAddModalOpen(false)}
        />
      ) : activeTab === "Flight Tickets" ? (
        <FlightTicketManager
          ref={flightTicketManagerRef}
          key={`flight-ticket-${reservationId ?? "none"}`}
          reservationId={reservationId}
          ownerType={ownerType}
          currencyOptions={currencyOptions}
          reservationCurrencyId={reservationCurrencyId}
          currencyCodeById={currencyCodeById}
          isAddOpen={isAddModalOpen}
          onCloseAdd={() => setIsAddModalOpen(false)}
        />
      ) : activeTab === "Activity" ? (
        <ActivityTimeline reservationId={reservationId ?? 0} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Section</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{activeTab} Details</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Items</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">No entries yet</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">Use this tab to manage {activeTab.toLowerCase()} lines.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [currencyOptions, setCurrencyOptions] = useState<SelectOption[]>([]);
  // Derived map: DB currency ID → ISO code (e.g. "3" → "TRY"). Built from currencyOptions
  // so it always matches the same parse logic and is never stale.
  const currencyCodeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const option of currencyOptions) {
      // Labels are always "CODE - Name (symbol)" or just "CODE"
      const code = option.label.split(' - ')[0]?.trim().toUpperCase() ?? "";
      if (code && option.id) {
        map[option.id] = code;
      }
    }
    return map;
  }, [currencyOptions]);
  const [statusOptions, setStatusOptions] = useState<Array<{ value: string; label: string }>>(
    RESERVATION_STATUS_FALLBACK_OPTIONS
  );
  const [agencyOptions, setAgencyOptions] = useState<SelectOption[]>([]);
  const [agencyDetailsById, setAgencyDetailsById] = useState<Record<string, AgencyDetails>>({});
  const [customerOptions, setCustomerOptions] = useState<SelectOption[]>([]);
  const [tourPackageOptions, setTourPackageOptions] = useState<SelectOption[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [form, setForm] = useState<ReservationFormState>(EMPTY_RESERVATION_FORM);
  const [formError, setFormError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  // Tourist IDs assigned to the currently-selected hotel booking row.
  // null = no room selected → TouristManager shows all reservation tourists.
  const [selectedHotelRoomTouristIds, setSelectedHotelRoomTouristIds] = useState<number[] | null>(null);

  useEffect(() => {
    const loadStatusOptions = async () => {
      setStatusesLoading(true);
      try {
        const optionsResponse = await axiosInstance.options(RESERVATIONS_ENDPOINTS.adminReservations);
        const fromOptions = normalizeStatusOptions(optionsResponse.data);

        if (fromOptions.length > 0) {
          setStatusOptions(fromOptions);
          setForm((previous) =>
            fromOptions.some((option) => option.value === previous.status)
              ? previous
              : { ...previous, status: fromOptions[0].value }
          );
          return;
        }

        const reservationsResponse = await axiosInstance.get(RESERVATIONS_ENDPOINTS.adminReservations);
        const fromRows = statusesFromReservations(reservationsResponse.data);

        if (fromRows.length > 0) {
          setStatusOptions(fromRows);
          setForm((previous) =>
            fromRows.some((option) => option.value === previous.status)
              ? previous
              : { ...previous, status: fromRows[0].value }
          );
          return;
        }

        setStatusOptions(RESERVATION_STATUS_FALLBACK_OPTIONS);
        setForm((previous) =>
          RESERVATION_STATUS_FALLBACK_OPTIONS.some((option) => option.value === previous.status)
            ? previous
            : { ...previous, status: RESERVATION_STATUS_FALLBACK_OPTIONS[0].value }
        );
      } catch {
        setStatusOptions(RESERVATION_STATUS_FALLBACK_OPTIONS);
        setForm((previous) =>
          RESERVATION_STATUS_FALLBACK_OPTIONS.some((option) => option.value === previous.status)
            ? previous
            : { ...previous, status: RESERVATION_STATUS_FALLBACK_OPTIONS[0].value }
        );
      } finally {
        setStatusesLoading(false);
      }
    };

    void loadStatusOptions();
  }, []);

  useEffect(() => {
    const loadCurrencies = async () => {
      setCurrenciesLoading(true);
      try {
        const response = await fetch("/api/finance/currencies/");
        const payload: unknown = response.ok ? await response.json() : null;
        const options = normalizeCurrencyOptions(payload);
        setCurrencyOptions(options);
      } finally {
        setCurrenciesLoading(false);
      }
    };

    void loadCurrencies();
  }, []);

  useEffect(() => {
    const loadRelatedOptions = async () => {
      setRelatedLoading(true);
      try {
        const [agenciesResponse, tourPackagesResponse, usersResponse] = await Promise.all([
          axiosInstance.get(AGENCIES_ENDPOINTS.adminAgencies),
          axiosInstance.get(INVENTORY_ENDPOINTS.adminTourPackages),
          axiosInstance.get(ACCOUNTS_ENDPOINTS.adminUsers),
        ]);

        setAgencyOptions(normalizeGenericOptions(agenciesResponse.data, ["name"]));
        setAgencyDetailsById(normalizeAgencyDetailsById(agenciesResponse.data));
        setTourPackageOptions(normalizeGenericOptions(tourPackagesResponse.data, ["name", "destination"]));
        setCustomerOptions(normalizeNormalCustomerOptions(usersResponse.data));
      } finally {
        setRelatedLoading(false);
      }
    };

    void loadRelatedOptions();
  }, []);

  const reservationsQuery = useQuery({
    queryKey: ["reservations", "admin"],
    queryFn: async () => {
      const response = await axiosInstance.get(RESERVATIONS_ENDPOINTS.adminReservations);
      return normalizeReservations(response.data);
    },
  });

  const saveReservationMutation = useMutation({
    mutationFn: async (currentForm: ReservationFormState) => {
      const payload = buildReservationPayload(currentForm, []);

      if (currentForm.id) {
        const response = await axiosInstance.patch(`${RESERVATIONS_ENDPOINTS.adminReservations}${currentForm.id}/`, payload);
        return response.data;
      }

      const response = await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminReservations, payload);
      return response.data;
    },
    onSuccess: async (data, variables) => {
      const savedRows = normalizeReservations([data]);
      const savedRow = savedRows[0];

      if (savedRow) {
        setIsCreatingReservation(false);
        setSelectedReservationId(savedRow.id);
        setForm({
          id: savedRow.id,
          reservationNo: savedRow.reservationNo,
          reservationDate: savedRow.reservationDate || formatDateInputValue((data as Record<string, unknown>).created_at),
          status: String((data as Record<string, unknown>).status ?? "DRAFT").trim().toUpperCase() || "DRAFT",
          ownerType: savedRow.ownerType,
          agencyId: savedRow.ownerType === "AGENCY" ? savedRow.ownerId : "",
          customerId: savedRow.ownerType === "NORMAL" ? savedRow.ownerId : "",
          bookingMode: savedRow.tourPackageId ? "WITH_TOUR_PACKAGE" : "STANDALONE_SERVICES",
          tourPackageId: savedRow.tourPackageId,
          currencyId: savedRow.currencyId,
        });

        if (!variables.id && variables.bookingMode === "WITH_TOUR_PACKAGE" && savedRow.tourPackageId) {
          try {
            const prefillResult = await prefillReservationServicesFromTourPackage({
              reservationId: savedRow.id,
              reservationDate: savedRow.reservationDate || formatDateInputValue(new Date().toISOString()),
              tourPackageId: savedRow.tourPackageId,
              ownerType: variables.ownerType,
              reservationCurrencyId: savedRow.currencyId,
              currencyCodeById,
            });

            if (prefillResult.createdHotels > 0 || prefillResult.createdTransfers > 0 || prefillResult.createdTickets > 0) {
              const parts: string[] = [];
              if (prefillResult.createdHotels > 0) parts.push(`${prefillResult.createdHotels} hotel line(s)`);
              if (prefillResult.createdTransfers > 0) parts.push(`${prefillResult.createdTransfers} transfer line(s)`);
              if (prefillResult.createdTickets > 0) parts.push(`${prefillResult.createdTickets} flight ticket(s)`);
              setToastMessage(`Reservation saved. Auto-added ${parts.join(", ")} from tour package.`);
            }
          } catch {
            setToastMessage("Reservation saved, but some package services could not be auto-added.");
          }
        }

        // Keep existing service lines aligned with the reservation currency after save/edit.
        try {
          await syncReservationServiceCurrencies({
            reservationId: savedRow.id,
            reservationCurrencyId: savedRow.currencyId,
            ownerType: variables.ownerType,
            currencyCodeById,
          });
        } catch {
          // Non-blocking; user can still continue and manually adjust specific lines.
        }
      }

      if (!(!variables.id && variables.bookingMode === "WITH_TOUR_PACKAGE" && savedRow?.tourPackageId)) {
        setToastMessage("Reservation saved.");
      }
      setFormError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reservations", "admin"] }),
        savedRow?.id
          ? queryClient.invalidateQueries({ queryKey: ["reservation-service", "hotel", savedRow.id] })
          : Promise.resolve(),
        savedRow?.id
          ? queryClient.invalidateQueries({ queryKey: ["reservation-service", "transfer", savedRow.id] })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => {
      setFormError(resolveReservationSaveError(error));
    },
  });

  const finalizeReservationMutation = useMutation({
    mutationFn: async (currentForm: ReservationFormState) => {
      if (!currentForm.id) {
        throw new Error("Reservation must be created before final save.");
      }

      const tourists = await listTourists("admin", { reservationId: currentForm.id });

      return updateReservationWithTourists(
        "admin",
        currentForm.id,
        buildReservationPayload(
          currentForm,
          tourists.map((tourist) => ({
            id: tourist.id,
            first_name: tourist.first_name,
            last_name: tourist.last_name,
            sex: tourist.sex,
            age_type: tourist.age_type,
            passport_number: tourist.passport_number,
            nationality: tourist.nationality,
            birth_date: tourist.birth_date ?? undefined,
            passport_expiry_date: tourist.passport_expiry_date ?? undefined,
          }))
        )
      );
    },
    onSuccess: async () => {
      setToastMessage("Reservation and tourists saved in database.");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["reservations", "admin"] });
    },
    onError: (error) => {
      setFormError(resolveReservationSaveError(error));
    },
  });

  const takeReservationMutation = useMutation({
    mutationFn: async (reservationId: number) => {
      const response = await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminReservationTake(reservationId));
      return response.data;
    },
    onSuccess: async () => {
      setToastMessage("Reservation taken.");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["reservations", "admin"] });
    },
    onError: (error) => {
      setFormError(resolveReservationSaveError(error));
    },
  });

  const confirmReservationMutation = useMutation({
    mutationFn: async (reservationId: number) => {
      const response = await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminReservationConfirm(reservationId));
      return response.data;
    },
    onSuccess: async () => {
      setToastMessage("Reservation confirmed.");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["reservations", "admin"] });
    },
    onError: (error) => {
      setFormError(resolveReservationSaveError(error));
    },
  });

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastMessage("");
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toastMessage]);

  useEffect(() => {
    const rows = reservationsQuery.data ?? [];

    if (rows.length === 0) {
      if (!form.reservationNo && currencyOptions.length > 0) {
        const timer = window.setTimeout(() => {
          setForm((previous) => ({
            ...previous,
            status: previous.status || statusOptions[0]?.value || "DRAFT",
            reservationDate: previous.reservationDate || formatDateInputValue(new Date().toISOString()),
            currencyId: previous.currencyId || currencyOptions[0].id,
            agencyId: previous.agencyId || agencyOptions[0]?.id || "",
            customerId: previous.customerId || customerOptions[0]?.id || "",
            tourPackageId: previous.tourPackageId || tourPackageOptions[0]?.id || "",
          }));
        }, 0);

        return () => {
          window.clearTimeout(timer);
        };
      }
      return;
    }

    if (!isCreatingReservation && selectedReservationId === null) {
      const firstRow = rows[0];

      const timer = window.setTimeout(() => {
        setSelectedReservationId(firstRow.id);
        setForm({
          id: firstRow.id,
          reservationNo: firstRow.reservationNo,
          reservationDate: firstRow.reservationDate || formatDateInputValue(new Date().toISOString()),
          status:
            statusOptions.find((option) => option.label.toLowerCase() === firstRow.status.toLowerCase())?.value ??
            firstRow.status.toUpperCase(),
          ownerType: firstRow.ownerType,
          agencyId: firstRow.ownerType === "AGENCY" ? firstRow.ownerId : "",
          customerId: firstRow.ownerType === "NORMAL" ? firstRow.ownerId : "",
          bookingMode: firstRow.tourPackageId ? "WITH_TOUR_PACKAGE" : "STANDALONE_SERVICES",
          tourPackageId: firstRow.tourPackageId,
          currencyId: firstRow.currencyId,
        });
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [
    agencyOptions,
    customerOptions,
    currencyOptions,
    form.reservationNo,
    isCreatingReservation,
    reservationsQuery.data,
    selectedReservationId,
    statusOptions,
    tourPackageOptions,
  ]);

  const updateField = <K extends keyof ReservationFormState>(key: K, value: ReservationFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSelectReservation = (row: ReservationRecord) => {
    setIsCreatingReservation(false);
    setSelectedReservationId(row.id);
    // Clear hotel room selection when switching reservations
    setSelectedHotelRoomTouristIds(null);
    setForm({
      id: row.id,
      reservationNo: row.reservationNo,
      reservationDate: row.reservationDate || formatDateInputValue(new Date().toISOString()),
      status:
        statusOptions.find((option) => option.label.toLowerCase() === row.status.toLowerCase())?.value ??
        row.status.toUpperCase(),
      ownerType: row.ownerType,
      agencyId: row.ownerType === "AGENCY" ? row.ownerId : "",
      customerId: row.ownerType === "NORMAL" ? row.ownerId : "",
      bookingMode: row.tourPackageId ? "WITH_TOUR_PACKAGE" : "STANDALONE_SERVICES",
      tourPackageId: row.tourPackageId,
      currencyId: row.currencyId,
    });
  };

  const handleAddReservation = () => {
    const rows = reservationsQuery.data ?? [];
    setIsCreatingReservation(true);
    setSelectedReservationId(null);
    setForm({
      id: null,
      reservationNo: generateReservationNumber(rows),
      reservationDate: formatDateInputValue(new Date().toISOString()),
      status: statusOptions[0]?.value ?? "DRAFT",
      ownerType: "AGENCY",
      agencyId: agencyOptions[0]?.id ?? "",
      customerId: customerOptions[0]?.id ?? "",
      bookingMode: "WITH_TOUR_PACKAGE",
      tourPackageId: tourPackageOptions[0]?.id ?? "",
      currencyId: currencyOptions[0]?.id ?? "",
    });
    setFormError("");
  };

  const activeReservationId = form.id;
  const ownerLabelById = useMemo(
    () =>
      [...agencyOptions, ...customerOptions].reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
      }, {}),
    [agencyOptions, customerOptions]
  );

  const tourPackageLabelById = useMemo(
    () =>
      tourPackageOptions.reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
      }, {}),
    [tourPackageOptions]
  );

  const currencyLabelById = useMemo(
    () =>
      currencyOptions.reduce<Record<string, string>>((accumulator, option) => {
        accumulator[option.id] = option.label;
        return accumulator;
      }, {}),
    [currencyOptions]
  );

  const selectedAgencyDetails =
    form.ownerType === "AGENCY" && form.agencyId ? agencyDetailsById[form.agencyId] ?? null : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Reservations</h2>
        <p className="mt-1 text-sm text-slate-500">High-density reservation management workspace.</p>
      </div>

      {toastMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {formError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="lg:origin-top-left lg:scale-[0.96] lg:w-[104.1667%] xl:w-full xl:scale-100">
        <div className="grid h-[calc(100vh-12rem)] min-h-[620px] grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="min-h-0 lg:col-span-5">
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
              <div className="min-h-0 flex-[7] overflow-y-auto pr-1">
                <ReservationFormPanel
                  form={form}
                  statusOptions={statusOptions}
                  statusesLoading={statusesLoading}
                  currencyOptions={currencyOptions}
                  agencyOptions={agencyOptions}
                  customerOptions={customerOptions}
                  selectedAgencyDetails={selectedAgencyDetails}
                  tourPackageOptions={tourPackageOptions}
                  currenciesLoading={currenciesLoading}
                  relatedLoading={relatedLoading}
                  onChange={updateField}
                  onSave={() => void saveReservationMutation.mutateAsync(form)}
                  isSaving={saveReservationMutation.isPending}
                />
              </div>
              <div className="min-h-0 flex-[4] overflow-y-auto pr-1">
                <TouristManager
                  key={`tourists-${activeReservationId ?? "none"}`}
                  reservationId={activeReservationId}
                  filterTouristIds={selectedHotelRoomTouristIds}
                  onTouristAdded={async (tourist) => {
                    if (!activeReservationId || !form.tourPackageId) return;
                    const parsedPkgId = Number.parseInt(form.tourPackageId, 10);
                    if (!Number.isFinite(parsedPkgId)) return;
                    try {
                      const tourPackage = await getAdminTourPackage(parsedPkgId);
                      const [existing, flightDetailsAll] = await Promise.all([
                        listFlightTickets(activeReservationId),
                        loadFlightDetails(tourPackage.flights),
                      ]);
                      const selectedFlights = pickArrivalDepartureFlights(flightDetailsAll);
                      const existingKeys = new Set(existing.map((t) => `${t.flightId}-${t.touristId}`));
                      for (const [flightIndex, flight] of selectedFlights.entries()) {
                        const legCode: "ARR" | "DEP" = selectedFlights.length > 1 && flightIndex === selectedFlights.length - 1 ? "DEP" : "ARR";
                        const key = `${flight.id}-${tourist.id}`;
                        if (!existingKeys.has(key)) {
                          const convertedFlight = await convertToReservationCurrency({
                            amount: resolveFlightPriceForOwner(flight, form.ownerType),
                            sourceCurrencyId: flight.currency,
                            sourceCurrencyCode: flight.currencyCode,
                            reservationCurrencyId: form.currencyId,
                            currencyCodeById,
                          });

                          await createFlightTicket({
                            reservation: activeReservationId,
                            flight: flight.id,
                            tourist: tourist.id,
                            departure_date: flight.departureDate || null,
                            arrival_date: flight.arrivalDate || null,
                            departing_date: flight.departureDate || null,
                            arriving_date: flight.arrivalDate || null,
                            ticket_number: buildAutoTicketNumber({
                              reservationId: activeReservationId,
                              touristId: tourist.id,
                              flightNumber: flight.flightNumber,
                              legCode,
                            }),
                            pnr: buildAutoTicketNumber({
                              reservationId: activeReservationId,
                              touristId: tourist.id,
                              flightNumber: flight.flightNumber,
                              legCode,
                            }),
                            price: convertedFlight.amount,
                            currency: convertedFlight.currencyId,
                            paid: false,
                            is_paid: false,
                          });
                        }
                      }
                      await queryClient.invalidateQueries({ queryKey: ["reservation-service", "flight-ticket", activeReservationId] });
                    } catch {
                      // silently skip — tickets can be added manually
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 lg:col-span-7">
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
              <div className="min-h-0 flex-[6]">
                <ReservationRecordsTable
                  rows={reservationsQuery.data ?? []}
                  loading={reservationsQuery.isLoading}
                  selectedReservationId={selectedReservationId}
                  onSelect={handleSelectReservation}
                  onAdd={handleAddReservation}
                  onFinalize={() => {
                    void finalizeReservationMutation.mutateAsync(form);
                  }}
                  canFinalize={Boolean(form.id)}
                  isFinalizing={finalizeReservationMutation.isPending}
                  onTake={() => {
                    if (form.id) {
                      void takeReservationMutation.mutateAsync(form.id);
                    }
                  }}
                  canTake={Boolean(form.id)}
                  isTaking={takeReservationMutation.isPending}
                  onConfirm={() => {
                    if (form.id) {
                      void confirmReservationMutation.mutateAsync(form.id);
                    }
                  }}
                  canConfirm={Boolean(form.id)}
                  isConfirming={confirmReservationMutation.isPending}
                  ownerLabelById={ownerLabelById}
                  tourPackageLabelById={tourPackageLabelById}
                  currencyLabelById={currencyLabelById}
                />
              </div>
              <div className="min-h-0 flex-[4]">
                <ReservationTabsPanel
                  reservationId={activeReservationId}
                  ownerType={form.ownerType}
                  tourPackageId={form.bookingMode === "WITH_TOUR_PACKAGE" ? form.tourPackageId : undefined}
                  currencyOptions={currencyOptions}
                  reservationCurrencyId={form.currencyId}
                  currencyCodeById={currencyCodeById}
                  onHotelBookingSelected={setSelectedHotelRoomTouristIds}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
