const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const normalizedBaseUrl = RAW_BASE_URL.endsWith("/") ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL;

export const API_V1 = normalizedBaseUrl.endsWith("/api/v1")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api/v1`;

export const USER_ROLES = {
  NORMAL: "NORMAL",
  AGENCY: "AGENCY",
  STAFF: "STAFF",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ACCOUNTS_ENDPOINTS = {
  adminUsers: `${API_V1}/accounts/admin/users/`,
};

export const INVENTORY_ENDPOINTS = {
  adminHotels: `${API_V1}/inventory/admin/hotels/`,
  adminFlights: `${API_V1}/inventory/admin/flights/`,
  adminTourPackages: `${API_V1}/inventory/admin/tour-packages/`,
  adminExcursions: `${API_V1}/inventory/admin/excursions/`,
};

export const AGENCIES_ENDPOINTS = {
  adminAgencies: `${API_V1}/agencies/admin/agencies/`,
};

export const RESERVATIONS_ENDPOINTS = {
  adminReservations: `${API_V1}/reservations/admin/reservations/`,
  adminTourists: `${API_V1}/reservations/admin/tourists/`,
  adminHotelBookings: `${API_V1}/reservations/admin/hotel-bookings/`,
  adminFlightTickets: `${API_V1}/reservations/admin/flight-tickets/`,
  adminExcursionBookings: `${API_V1}/reservations/admin/excursion-bookings/`,
  adminTransferServices: `${API_V1}/reservations/admin/transfer-services/`,
};

export const FINANCE_ENDPOINTS = {
  adminCurrencies: `${API_V1}/finance/admin/currencies/`,
  adminExchangeRates: `${API_V1}/finance/admin/exchange-rates/`,
  adminInvoices: `${API_V1}/finance/admin/invoices/`,
};

export const PUBLIC_SITE_ENDPOINTS = {
  clientHero: `${API_V1}/public-site/client/hero/`,
  adminHero: `${API_V1}/public-site/admin/hero/`,
};