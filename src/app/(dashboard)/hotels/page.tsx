"use client";

import InventoryManagementPage, { type InventoryPageConfig } from "@/components/inventory-management-page";
import { INVENTORY_ENDPOINTS } from "@/lib/api-endpoints";

const hotelsConfig: InventoryPageConfig = {
  title: "Hotels",
  description: "Manage hotel inventory records with compact controls.",
  endpoint: INVENTORY_ENDPOINTS.adminHotels,
  tableFields: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "stars", label: "Stars" },
    { key: "currency", label: "Currency" },
    { key: "price", label: "Price" },
  ],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Hotel Name" },
    { key: "city", label: "City", type: "text", required: true, placeholder: "City" },
    { key: "stars", label: "Stars", type: "number", step: "1", required: true, placeholder: "1 - 5" },
    { key: "currency", label: "Currency", type: "select", source: "currencies", required: true },
    { key: "price", label: "Price", type: "number", step: "0.01", required: true, placeholder: "0.00" },
  ],
};

export default function HotelsPage() {
  return <InventoryManagementPage config={hotelsConfig} />;
}
