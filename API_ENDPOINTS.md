# Jovira API Endpoints (Next.js Integration)

This file lists all current backend endpoints so you can copy them into your Next.js project.

## Base URLs

- Local API base URL: `http://127.0.0.1:8000`
- API version prefix: `/api/v1`
- Full base for app endpoints: `http://127.0.0.1:8000/api/v1`

Important:
- DRF router endpoints use trailing slashes (`/`).
- JWT-protected endpoints require: `Authorization: Bearer <access_token>`.

## Auth Endpoints

- `POST /api/v1/auth/register/`
- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`

Login payload uses email and password:
- `{"email": "user@example.com", "password": "..."}`

## API Docs Endpoints

- `GET /api/schema/`
- `GET /api/schema/swagger-ui/`

## Accounts

### Admin (IsAdminUser)
- `GET, POST /api/v1/accounts/admin/users/`
- `GET, PUT, PATCH, DELETE /api/v1/accounts/admin/users/{id}/`

Admin user payload includes role fields:
- `role`: `NORMAL | AGENCY | STAFF`
- `agency`: nullable agency id
- Admin can assign user role and agency.

### Client (IsAuthenticated, own user only by queryset)
- `GET, PUT, PATCH /api/v1/accounts/client/users/{id}/`

Client user payload is read-only for:
- `role`
- `agency`
- `is_active`

Registration behavior:
- `POST /api/v1/auth/register/` always creates `NORMAL` users.
- `role` and `agency` are not client-controlled in register.

## Agencies

### Admin (IsAdminUser)
- `GET, POST /api/v1/agencies/admin/agencies/`
- `GET, PUT, PATCH, DELETE /api/v1/agencies/admin/agencies/{id}/`

### Client (Public read-only)
- `GET /api/v1/agencies/client/agencies/`
- `GET /api/v1/agencies/client/agencies/{id}/`

Agency onboarding:
- `POST /api/v1/agencies/client/register/` (creates agency + agency user in pending state)
- New agency users are created with `role=AGENCY` and `is_active=false` until approval.
- Pending agencies are hidden from public client agencies list.

Agency register request payload:
- `name`
- `agency_type`
- `contact_person`
- `email` (optional; falls back to `account_email` if omitted)
- `phone` (optional)
- `mobile_phone` (optional)
- `skype_id` (optional)
- `icq` (optional)
- `account_email` (required; used for login)
- `account_first_name` (optional)
- `account_last_name` (optional)
- `account_phone_number` (optional)
- `password` (required)
- `password2` (required)

Agency login behavior:
- Login is email/password only via `POST /api/v1/auth/login/`.
- Newly registered agency users cannot log in until admin approval activates their account.

Admin approval:
- `POST /api/v1/agencies/admin/agencies/{id}/approve/`
- Sets `is_approved=true`, stamps `approved_at`, and activates linked agency users.

## Inventory


### Admin (IsAdminUser)
- `GET, POST /api/v1/inventory/admin/hotels/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/hotels/{id}/`
  - **Hotel fields:**
    - `name`, `city`, `stars`, `currency`
    - `price` (public price), `agency_price` (optional; agency/staff users see this instead)
    - `cost_price` (optional; internal procurement cost paid by Jovira — **admin only, never returned to client endpoints**)
    - `description` (multi-language)
    - `main_image` (image upload)
    - `features` (list of feature IDs)
    - `gallery_images` (list of images, each with `image`, `alt_text`, `order`)
- `GET, POST /api/v1/inventory/admin/hotel-features/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/hotel-features/{id}/`
- `GET, POST /api/v1/inventory/admin/hotel-images/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/hotel-images/{id}/`
  - Accepts `multipart/form-data` for image uploads.
  - Filter by hotel: `GET /api/v1/inventory/admin/hotel-images/?hotel=<id>`
  - **Payload fields:** `hotel` (integer FK, required), `image` (file, required), `alt_text` (string, optional), `order` (integer, optional)
- `GET, POST /api/v1/inventory/admin/flights/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/flights/{id}/`
  - **Flight fields:** `flight_number`, `airline`, `origin`, `destination`, `departure_time`, `arrival_time`, `currency`, `price`, `agency_price`, `cost_price` (internal cost — admin only)
- `GET, POST /api/v1/inventory/admin/tour-packages/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/tour-packages/{id}/`
  - **Tour package fields (admin):**
    - Core: `name`, `destination`, `days`, `nights`, `currency`
    - Prices: `public_price`, `agency_price`, `cost_price`
    - Optional component selectors (IDs): `flights`, `hotels`, `transfers`, `excursions`
    - Read-only guidance: `minimum_cost_floor`
  - **Validation rules:**
    - `cost_price`, `agency_price`, and `public_price` cannot be below `minimum_cost_floor`.
    - `public_price` cannot be below `agency_price`.
    - Component costs are auto-converted to package currency for floor calculation.
- `GET, POST /api/v1/inventory/admin/excursions/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/excursions/{id}/`
  - **Excursion fields:** `name`, `city`, `duration_hours`, `currency`, `public_price`, `agency_price`, `cost_price` (internal cost — admin only)
- `GET, POST /api/v1/inventory/admin/transfer-providers/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/transfer-providers/{id}/`
- `GET, POST /api/v1/inventory/admin/transfers/`
- `GET, PUT, PATCH, DELETE /api/v1/inventory/admin/transfers/{id}/`
  - **Transfer fields:** `provider` (FK), `name`, `from_location`, `to_location`, `vehicle_type`, `capacity`, `currency`, `public_price`, `agency_price`, `cost_price` (internal cost — admin only)

Tour package admin note:
- `/inventory/admin/tour-packages/` is accessible by admin and `STAFF` role users.
- Tour package admin payload includes `public_price`, `agency_price`, `cost_price`, optional component selectors (`flights`, `hotels`, `transfers`, `excursions`), and read-only `minimum_cost_floor`.
- `minimum_cost_floor` is a no-profit baseline calculated from selected components (hotel costs are multiplied by package `nights`) and converted to package currency when needed.
- Recommended admin form guidance text:
  - "This tour price cannot be less than minimum cost floor. The floor is cost-only (no profit)."

Tour package admin create payload example:
```json
{
  "name": "Istanbul Premium 3N",
  "destination": "Istanbul",
  "days": 4,
  "nights": 3,
  "currency": 1,
  "flights": [3, 8],
  "hotels": [2],
  "transfers": [4],
  "excursions": [1, 5],
  "cost_price": "9200.00",
  "agency_price": "10200.00",
  "public_price": "11800.00"
}
```

Agency pricing behavior (hotels, flights, tour packages, excursions, transfers):
- Admin endpoints always return `price`/`public_price`, `agency_price`, and `cost_price`.
- Client endpoints return a single `price` field resolved by the authenticated user's role:
  - `NORMAL` users and unauthenticated users → public price.
  - `AGENCY`, `STAFF`, and Django admin/staff users → `agency_price` (if set, otherwise falls back to public price).
- `cost_price` is **never** included in client endpoint responses — it is strictly internal to Jovira for margin/profit tracking.

### Client (Public read-only)
- `GET /api/v1/inventory/client/hotels/`
- `GET /api/v1/inventory/client/hotels/{id}/`
- `GET /api/v1/inventory/client/flights/`
- `GET /api/v1/inventory/client/flights/{id}/`
- `GET /api/v1/inventory/client/tour-packages/`
- `GET /api/v1/inventory/client/tour-packages/{id}/`
- `GET /api/v1/inventory/client/excursions/`
- `GET /api/v1/inventory/client/excursions/{id}/`
- `GET /api/v1/inventory/client/transfers/`
- `GET /api/v1/inventory/client/transfers/{id}/`

Transfer notes:
- `inventory.TransferProvider` — companies or individual drivers that provide transfers. Admin-managed.
- `inventory.Transfer` — catalog route item with `public_price`, `agency_price`, `currency`, linked to a provider.
- `reservations.TransferService` — the actual booking record. Optionally references a catalog `Transfer` FK; when set, prices/currency are auto-populated from the catalog but can be overridden.
- Client `transfers` endpoint requires `IsAuthenticated` (B2B/agency use).

Tour package client pricing behavior:
- Public and `NORMAL` users receive public price in `price`.
- `AGENCY`, `STAFF`, and Django admin/staff users receive `agency_price` in `price`.
- Applies to hotels, flights, and tour packages.
- Client tour package responses do not expose `minimum_cost_floor` or `cost_price`.

## Reservations

### Admin (IsAdminUser)
- `GET, POST /api/v1/reservations/admin/reservations/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/reservations/{id}/`
- `GET, POST /api/v1/reservations/admin/tourists/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/tourists/{id}/`
- `GET, POST /api/v1/reservations/admin/hotel-bookings/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/hotel-bookings/{id}/`
- `GET, POST /api/v1/reservations/admin/flight-tickets/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/flight-tickets/{id}/`
- `GET, POST /api/v1/reservations/admin/excursion-bookings/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/excursion-bookings/{id}/`
- `GET, POST /api/v1/reservations/admin/transfer-services/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/transfer-services/{id}/`
- `GET, POST /api/v1/reservations/admin/excursion-services/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/admin/excursion-services/{id}/`

### Client (IsAuthenticated)
- `GET, POST /api/v1/reservations/client/reservations/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/reservations/{id}/`
- `GET, POST /api/v1/reservations/client/tourists/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/tourists/{id}/`
- `GET, POST /api/v1/reservations/client/hotel-bookings/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/hotel-bookings/{id}/`
- `GET, POST /api/v1/reservations/client/flight-tickets/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/flight-tickets/{id}/`
- `GET, POST /api/v1/reservations/client/excursion-bookings/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/excursion-bookings/{id}/`
- `GET, POST /api/v1/reservations/client/transfer-services/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/transfer-services/{id}/`
- `GET, POST /api/v1/reservations/client/excursion-services/`
- `GET, PUT, PATCH, DELETE /api/v1/reservations/client/excursion-services/{id}/`

Excursion Service notes:
- `ExcursionService` is a **standalone excursion booking** (not tied to a `Reservation`). It is a B2B/agency operational record for tracking excursion sales with full financial detail.
- **Access:** `client/` endpoints require `IsAuthenticated`. This section is intended for **agency and staff users only** — normal/public users should not have UI access to it.
- Fields: `excursion_date`, `excursion` (FK), `is_combo`, `pickup_point`, `price`, `selling_currency` (FK), `cost`, `cost_currency` (FK), `cross_currency_rate`, `is_paid`, `confirm_booking_number`, `agent_confirmation_number`, `note`.
- `system_date` is auto-set (read-only).

Reservation and transfer notes:
- `reservation.tour_package` is optional (`null` allowed).
- `transfer_service.tour_package` is optional (`null` allowed).
- A reservation can include only hotel booking, only flight ticket, only transfer, or any combination.
- `transfer_service.agency_price` is optional; admin can set a separate agency price for transfers.

## Finance

### Admin (IsAdminUser)
- `GET, POST /api/v1/finance/admin/currencies/`
- `GET, PUT, PATCH, DELETE /api/v1/finance/admin/currencies/{id}/`
- `GET, POST /api/v1/finance/admin/exchange-rates/`
- `GET, PUT, PATCH, DELETE /api/v1/finance/admin/exchange-rates/{id}/`
- `GET, POST /api/v1/finance/admin/invoices/`
- `GET, PUT, PATCH, DELETE /api/v1/finance/admin/invoices/{id}/`

### Client
- Public read-only:
  - `GET /api/v1/finance/client/currencies/`
  - `GET /api/v1/finance/client/currencies/{id}/`
  - `GET /api/v1/finance/client/exchange-rates/`
  - `GET /api/v1/finance/client/exchange-rates/{id}/`
  - `GET /api/v1/finance/client/convert/?from=USD&to=TRY&amount=100`
- Authenticated read-only:
  - `GET /api/v1/finance/client/invoices/`
  - `GET /api/v1/finance/client/invoices/{id}/`

Currency convert response example:
```json
{
  "from": "USD",
  "to": "TRY",
  "amount": "100",
  "converted_amount": "3910.00",
  "effective_rate": "39.1000000000"
}
```

## Public Website Content

### Hero Section
- Public read:
  - `GET /api/v1/public-site/client/hero/`
- Admin update (IsAdminUser):
  - `GET /api/v1/public-site/admin/hero/`
  - `PUT /api/v1/public-site/admin/hero/`
  - `PATCH /api/v1/public-site/admin/hero/`

Hero payload fields:
- `badge_text`
- `logo` (optional upload / returned as media URL)
- `image` (optional upload / returned as media URL)
- `headline`
- `description`
- `search_placeholder`
- `search_button_text`
- `updated_at` (read-only)

Admin hero update accepts `application/json` for text fields and `multipart/form-data` for logo/image uploads.

## Next.js Example (copy-ready)

```ts
// lib/api-endpoints.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
export const API_V1 = `${API_BASE_URL}/api/v1`;

export const AUTH_ENDPOINTS = {
  register: `${API_V1}/auth/register/`,
  login: `${API_V1}/auth/login/`,
  refresh: `${API_V1}/auth/refresh/`,
};

export const USER_ROLE = {
  NORMAL: "NORMAL",
  AGENCY: "AGENCY",
  STAFF: "STAFF",
} as const;

export const ACCOUNTS_ENDPOINTS = {
  adminUsers: `${API_V1}/accounts/admin/users/`,
  clientUsers: `${API_V1}/accounts/client/users/`,
};

export const AGENCIES_ENDPOINTS = {
  admin: `${API_V1}/agencies/admin/agencies/`,
  client: `${API_V1}/agencies/client/agencies/`,
  register: `${API_V1}/agencies/client/register/`,
};

export const INVENTORY_ENDPOINTS = {
  adminHotels: `${API_V1}/inventory/admin/hotels/`,
  adminFlights: `${API_V1}/inventory/admin/flights/`,
  adminTourPackages: `${API_V1}/inventory/admin/tour-packages/`,
  adminExcursions: `${API_V1}/inventory/admin/excursions/`,
  adminTransferProviders: `${API_V1}/inventory/admin/transfer-providers/`,
  adminTransfers: `${API_V1}/inventory/admin/transfers/`,
  clientHotels: `${API_V1}/inventory/client/hotels/`,
  clientFlights: `${API_V1}/inventory/client/flights/`,
  clientTourPackages: `${API_V1}/inventory/client/tour-packages/`,
  clientExcursions: `${API_V1}/inventory/client/excursions/`,
  clientTransfers: `${API_V1}/inventory/client/transfers/`,
};

// Suggested admin form payload model for tour package create/update
export type AdminTourPackagePayload = {
  name: string;
  destination: string;
  days: number;
  nights: number;
  currency: number;
  flights?: number[];
  hotels?: number[];
  transfers?: number[];
  excursions?: number[];
  cost_price?: string;
  agency_price?: string;
  public_price?: string;
};

// Suggested admin UI guidance flow:
// 1) Admin selects optional components.
// 2) UI reads `minimum_cost_floor` from API response.
// 3) Show warning text above price fields: "No-profit minimum floor: {minimum_cost_floor}".
// 4) Prevent submit if entered prices are below floor.

export const RESERVATIONS_ENDPOINTS = {
  adminReservations: `${API_V1}/reservations/admin/reservations/`,
  clientReservations: `${API_V1}/reservations/client/reservations/`,
  adminTourists: `${API_V1}/reservations/admin/tourists/`,
  clientTourists: `${API_V1}/reservations/client/tourists/`,
  adminHotelBookings: `${API_V1}/reservations/admin/hotel-bookings/`,
  clientHotelBookings: `${API_V1}/reservations/client/hotel-bookings/`,
  adminFlightTickets: `${API_V1}/reservations/admin/flight-tickets/`,
  clientFlightTickets: `${API_V1}/reservations/client/flight-tickets/`,
  adminExcursionBookings: `${API_V1}/reservations/admin/excursion-bookings/`,
  clientExcursionBookings: `${API_V1}/reservations/client/excursion-bookings/`,
  adminTransferServices: `${API_V1}/reservations/admin/transfer-services/`,
  clientTransferServices: `${API_V1}/reservations/client/transfer-services/`,
  adminExcursionServices: `${API_V1}/reservations/admin/excursion-services/`,
  clientExcursionServices: `${API_V1}/reservations/client/excursion-services/`,
};

export const FINANCE_ENDPOINTS = {
  adminCurrencies: `${API_V1}/finance/admin/currencies/`,
  clientCurrencies: `${API_V1}/finance/client/currencies/`,
  adminExchangeRates: `${API_V1}/finance/admin/exchange-rates/`,
  clientExchangeRates: `${API_V1}/finance/client/exchange-rates/`,
  adminInvoices: `${API_V1}/finance/admin/invoices/`,
  clientInvoices: `${API_V1}/finance/client/invoices/`,
};

export const PUBLIC_SITE_ENDPOINTS = {
  clientHero: `${API_V1}/public-site/client/hero/`,
  adminHero: `${API_V1}/public-site/admin/hero/`,
};
```
