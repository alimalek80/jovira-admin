"use client";

import InventoryManagementPage, { type InventoryPageConfig } from "@/components/inventory-management-page";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

const flightsConfig: InventoryPageConfig = {
  title: "Flights",
  description: "Manage flight schedules and fare information.",
  endpoint: INVENTORY_ENDPOINTS.adminFlights,
  tableFields: [
    { key: "id", label: "ID" },
    { key: "airline", label: "Airline" },
    { key: "flight_number", label: "Flight No" },
    { key: "origin", label: "Departure" },
    { key: "destination", label: "Arrival" },
    { key: "price", label: "Public Price" },
    { key: "agency_price", label: "Agency Price" },
  ],
  formFields: [
    { key: "airline", label: "Airline", type: "text", required: true, placeholder: "Airline" },
    { key: "flight_number", label: "Flight Number", type: "text", required: true, placeholder: "XY123" },
    { key: "origin", label: "Departure City", type: "text", required: true, placeholder: "Departure city" },
    { key: "destination", label: "Arrival City", type: "text", required: true, placeholder: "Arrival city" },
    { key: "departure_time", label: "Departure Time", type: "datetime-local", required: true },
    { key: "arrival_time", label: "Arrival Time", type: "datetime-local", required: true },
    { key: "currency", label: "Currency", type: "select", source: "currencies", required: true },
    { key: "price", label: "Public Price", type: "number", step: "0.01", required: true, placeholder: "0.00" },
    { key: "agency_price", label: "Agency Price", type: "number", step: "0.01", required: false, placeholder: "0.00" },
  ],
};

export default function FlightsPage() {
  return <InventoryManagementPage config={flightsConfig} />;
}
