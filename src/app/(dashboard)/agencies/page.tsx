"use client";

import InventoryManagementPage, { type InventoryPageConfig } from "@/components/inventory-management-page";
import { AGENCIES_ENDPOINTS } from "@/lib/api-endpoints";

const agenciesConfig: InventoryPageConfig = {
  title: "Agencies",
  description: "Manage partner agencies and full contact directory details.",
  endpoint: AGENCIES_ENDPOINTS.adminAgencies,
  tableFields: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "agency_type", label: "Type" },
    { key: "contact_person", label: "Contact" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "mobile_phone", label: "Mobile" },
    { key: "skype_id", label: "Skype" },
    { key: "icq", label: "ICQ" },
  ],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Agency name" },
    { key: "agency_type", label: "Agency Type", type: "text", required: true, placeholder: "Tour Operator" },
    { key: "contact_person", label: "Contact Person", type: "text", required: true, placeholder: "Full name" },
    { key: "email", label: "Email", type: "text", required: true, placeholder: "name@agency.com" },
    { key: "phone", label: "Phone", type: "text", required: true, placeholder: "+90 ..." },
    { key: "mobile_phone", label: "Mobile Phone", type: "text", placeholder: "+90 ..." },
    { key: "skype_id", label: "Skype ID", type: "text", placeholder: "agency.skype" },
    { key: "icq", label: "ICQ", type: "text", placeholder: "7001001" },
  ],
};

export default function AgenciesPage() {
  return <InventoryManagementPage config={agenciesConfig} />;
}
