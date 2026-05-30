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
    { key: "price", label: "Public Price" },
    { key: "agency_price", label: "Agency Price" },
  ],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Hotel Name" },
    { key: "name_en", label: "Name [EN]", type: "text", placeholder: "Hotel Name (English)" },
    { key: "name_tr", label: "Name [TR]", type: "text", placeholder: "Hotel Name (Turkish)" },
    { key: "name_ru", label: "Name [RU]", type: "text", placeholder: "Hotel Name (Russian)" },
    { key: "city", label: "City", type: "text", required: true, placeholder: "City" },
    { key: "city_en", label: "City [EN]", type: "text", placeholder: "City (English)" },
    { key: "city_tr", label: "City [TR]", type: "text", placeholder: "City (Turkish)" },
    { key: "city_ru", label: "City [RU]", type: "text", placeholder: "City (Russian)" },
    { key: "stars", label: "Stars", type: "number", step: "1", required: true, placeholder: "1 - 5" },
    { key: "currency", label: "Currency", type: "select", source: "currencies", required: true },
    { key: "price", label: "Public Price", type: "number", step: "0.01", required: true, placeholder: "0.00" },
    { key: "agency_price", label: "Agency Price", type: "number", step: "0.01", required: false, placeholder: "0.00" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Description (default language)" },
    { key: "description_en", label: "Description [EN]", type: "textarea", placeholder: "Description (English)" },
    { key: "description_tr", label: "Description [TR]", type: "textarea", placeholder: "Description (Turkish)" },
    { key: "description_ru", label: "Description [RU]", type: "textarea", placeholder: "Description (Russian)" },
    { key: "main_image", label: "Main Image", type: "file", required: false },
    { key: "features", label: "Features", type: "select", required: false, options: [], multi: true },
    { key: "gallery_images", label: "Gallery Images", type: "file", required: false, multi: true },
  ],
};

export default function HotelsPage() {
  return <InventoryManagementPage config={hotelsConfig} />;
}
