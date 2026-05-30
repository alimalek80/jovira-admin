"use client";

import InventoryManagementPage, { type InventoryPageConfig } from "@/components/inventory-management-page";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

const excursionsConfig: InventoryPageConfig = {
  title: "Excursions",
  description: "Manage excursion inventory with pricing for public and agency channels.",
  endpoint: INVENTORY_ENDPOINTS.adminExcursions,
  tableFields: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "duration_hours", label: "Duration (h)" },
    { key: "currency", label: "Currency" },
    { key: "public_price", label: "Public Price" },
    { key: "agency_price", label: "Agency Price" },
  ],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Excursion name" },
    { key: "name_en", label: "Name [EN]", type: "text", placeholder: "Name (English)" },
    { key: "name_tr", label: "Name [TR]", type: "text", placeholder: "Name (Turkish)" },
    { key: "name_ru", label: "Name [RU]", type: "text", placeholder: "Name (Russian)" },
    { key: "city", label: "City", type: "text", required: true, placeholder: "City" },
    { key: "city_en", label: "City [EN]", type: "text", placeholder: "City (English)" },
    { key: "city_tr", label: "City [TR]", type: "text", placeholder: "City (Turkish)" },
    { key: "city_ru", label: "City [RU]", type: "text", placeholder: "City (Russian)" },
    {
      key: "duration_hours",
      label: "Duration (hours)",
      type: "number",
      step: "0.5",
      required: true,
      placeholder: "e.g. 3.5",
    },
    {
      key: "currency",
      label: "Currency",
      type: "select",
      source: "currencies",
      required: false,
    },
    {
      key: "public_price",
      label: "Public Price",
      type: "number",
      step: "0.01",
      required: false,
      placeholder: "0.00",
    },
    {
      key: "agency_price",
      label: "Agency Price",
      type: "number",
      step: "0.01",
      required: false,
      placeholder: "0.00",
      note: "Shown to AGENCY and STAFF users. Falls back to Public Price if not set.",
    },
  ],
};

export default function ExcursionsPage() {
  return <InventoryManagementPage config={excursionsConfig} />;
}
