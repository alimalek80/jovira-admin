const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

const normalizedBaseUrl = RAW_BASE_URL.endsWith("/")
  ? RAW_BASE_URL.slice(0, -1)
  : RAW_BASE_URL;

export const API_V1 = normalizedBaseUrl.endsWith("/api/v1")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api/v1`;

export const USER_ROLES = {
  NORMAL: "NORMAL",
  AGENCY: "AGENCY",
  ADMIN: "ADMIN",
  SALES: "SALES",
  RESERVATION: "RESERVATION",
  INVENTORY: "INVENTORY",
  FINANCE: "FINANCE",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ACCOUNTS_ENDPOINTS = {
  adminUsers: `${API_V1}/accounts/admin/users/`,
  clientUsers: `${API_V1}/accounts/client/users/`,
};

export const INVENTORY_ENDPOINTS = {
  adminHotels: `${API_V1}/inventory/admin/hotels/`,
  adminHotelRooms: `${API_V1}/inventory/admin/hotel-rooms/`,
  adminHotelRoomAvailability: (id: number, checkIn: string, checkOut: string) =>
    `${API_V1}/inventory/admin/hotel-rooms/${id}/availability/?check_in=${checkIn}&check_out=${checkOut}`,
  adminHotelImages: `${API_V1}/inventory/admin/hotel-images/`,
  adminFlights: `${API_V1}/inventory/admin/flights/`,
  adminTourPackages: `${API_V1}/inventory/admin/tour-packages/`,
  adminExcursions: `${API_V1}/inventory/admin/excursions/`,
  adminTransferProviders: `${API_V1}/inventory/admin/transfer-providers/`,
  adminTransfers: `${API_V1}/inventory/admin/transfers/`,

  clientHotels: `${API_V1}/inventory/client/hotels/`,
  clientHotelRooms: `${API_V1}/inventory/client/hotel-rooms/`,
  clientHotelRoomAvailability: (id: number, checkIn: string, checkOut: string) =>
    `${API_V1}/inventory/client/hotel-rooms/${id}/availability/?check_in=${checkIn}&check_out=${checkOut}`,
  clientFlights: `${API_V1}/inventory/client/flights/`,
  clientTourPackages: `${API_V1}/inventory/client/tour-packages/`,
  clientExcursions: `${API_V1}/inventory/client/excursions/`,
  clientTransfers: `${API_V1}/inventory/client/transfers/`,
};

export const AGENCIES_ENDPOINTS = {
  adminAgencies: `${API_V1}/agencies/admin/agencies/`,
  clientAgencies: `${API_V1}/agencies/client/agencies/`,
  registerAgency: `${API_V1}/agencies/client/register/`,
};

export const RESERVATIONS_ENDPOINTS = {
  adminReservations: `${API_V1}/reservations/admin/reservations/`,
  adminWorkDesk: `${API_V1}/reservations/admin/reservations/work-desk/`,
  adminTourists: `${API_V1}/reservations/admin/tourists/`,
  adminHotelBookings: `${API_V1}/reservations/admin/hotel-bookings/`,
  adminFlightTickets: `${API_V1}/reservations/admin/flight-tickets/`,
  adminExcursionBookings: `${API_V1}/reservations/admin/excursion-bookings/`,
  adminTransferServices: `${API_V1}/reservations/admin/transfer-services/`,
  adminExcursionServices: `${API_V1}/reservations/admin/excursion-services/`,
  adminReservationActivityLogs: `${API_V1}/reservations/admin/reservation-activity-logs/`,
};

export const FINANCE_ENDPOINTS = {
  adminCurrencies: `${API_V1}/finance/admin/currencies/`,
  adminExchangeRates: `${API_V1}/finance/admin/exchange-rates/`,
  adminInvoices: `${API_V1}/finance/admin/invoices/`,

  clientCurrencies: `${API_V1}/finance/client/currencies/`,
  clientExchangeRates: `${API_V1}/finance/client/exchange-rates/`,
  clientInvoices: `${API_V1}/finance/client/invoices/`,
  clientConvert: `${API_V1}/finance/client/convert/`,
};

export const PUBLIC_SITE_ENDPOINTS = {
  clientHero: `${API_V1}/public-site/client/hero/`,
  adminHero: `${API_V1}/public-site/admin/hero/`,
};