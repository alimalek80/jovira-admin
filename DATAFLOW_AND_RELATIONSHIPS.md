# Jovira Admin — Complete Data Flow & Relationships Guide

This document explains every flow, data model, relationship, page, and API interaction in the Jovira Admin Next.js application. It is intended to allow an external AI or developer to fully understand the system and propose or implement modifications.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Data Model Relationships](#4-data-model-relationships)
5. [Page Inventory](#5-page-inventory)
6. [Reservation Creation Flow](#6-reservation-creation-flow)
7. [Tourist Management](#7-tourist-management)
8. [Hotel Booking Flow](#8-hotel-booking-flow)
9. [Transfer Service Flow](#9-transfer-service-flow)
10. [Flight Ticket Flow](#10-flight-ticket-flow)
11. [Excursion Booking (within Reservation)](#11-excursion-booking-within-reservation)
12. [Standalone Excursion Services](#12-standalone-excursion-services)
13. [Cancellation Flow](#13-cancellation-flow)
14. [Inventory Management Pages](#14-inventory-management-pages)
15. [Agency Management Flow](#15-agency-management-flow)
16. [Finance & Currencies](#16-finance--currencies)
17. [Web Sections / CMS](#17-web-sections--cms)
18. [Pricing Logic](#18-pricing-logic)
19. [API Endpoint Reference](#19-api-endpoint-reference)
20. [Frontend File Structure](#20-frontend-file-structure)

---

## 1. Architecture Overview

```
Browser
  │
  ├─ Next.js App (src/app/)
  │    ├─ /login               → Public login page
  │    ├─ /api/auth/*          → Next.js Route Handlers (BFF proxy for auth)
  │    └─ /(dashboard)/*       → All protected admin pages
  │
  └─ Django REST Framework backend (http://127.0.0.1:8000)
       ├─ /api/v1/auth/        → JWT auth endpoints
       ├─ /api/v1/accounts/    → User management
       ├─ /api/v1/agencies/    → Agency management
       ├─ /api/v1/inventory/   → Hotels, Rooms, Flights, Transfers, Excursions, Tour Packages
       ├─ /api/v1/reservations/→ Reservations, Tourists, Bookings, Services
       ├─ /api/v1/finance/     → Currencies, Exchange Rates, Invoices
       └─ /api/v1/public-site/ → Hero section CMS
```

**Key libraries:**
- `@tanstack/react-query` — server state management (queries + mutations)
- `axios` — HTTP client (configured with JWT interceptor in `src/lib/axios.ts`)
- `zod` — form validation schemas
- `@tanstack/react-table` — table rendering in reservations page

**Auth storage:** JWT tokens are stored as HTTP-only cookies (`access`, `refresh`). The Next.js API Route Handlers (`/api/auth/*`) set and clear cookies server-side, preventing JavaScript access to tokens.

---

## 2. Authentication Flow

### Login
```
User fills email + password
  → POST /api/auth/login (Next.js route handler)
    → POST /api/v1/auth/login/ (Django backend)
      ← { access: "...", refresh: "..." }
    → Sets cookies: access=<JWT>, refresh=<JWT> (httpOnly)
    → Fetches GET /api/v1/auth/me/ to verify user role
    → Checks canAccessAdminApp(user):
        - Allowed: is_superuser OR is_staff OR role === "STAFF"
        - Blocked: role === "NORMAL" OR role === "AGENCY"
  → Redirects to "/" (dashboard home) on success
  → Shows error message on failure
```

### Token Refresh
```
axios interceptor in src/lib/axios.ts
  → On 401 response: POST /api/auth/refresh (Next.js route handler)
    → POST /api/v1/auth/refresh/ (Django backend)
      ← { access: "..." }
    → Overwrites access cookie
  → Retries original request
```

### Logout
```
User clicks "Sign Out" (dashboard-user-menu.tsx)
  → POST /api/auth/logout (Next.js route handler)
    → Clears access and refresh cookies
  → Redirects to /login
```

### Dashboard Layout Guard
```
src/app/(dashboard)/layout.tsx
  → Calls GET /api/auth/me (Next.js route handler)
    → GET /api/v1/auth/me/ (Django backend)
  → If not authenticated or not allowed role → redirect to /login
  → If allowed → renders DashboardShell with sidebar navigation
```

---

## 3. User Roles & Permissions

| Role | Description | Admin App Access | Pricing Visible |
|---|---|---|---|
| `is_superuser` | Django superuser | Full access | All (public + agency + cost) |
| `is_staff` | Django staff flag | Full access | All (public + agency + cost) |
| `STAFF` | Jovira app staff role | Full access | All (public + agency + cost) |
| `AGENCY` | Agency user | Blocked from admin app | Agency price (never cost) |
| `NORMAL` | Regular public user | Blocked from admin app | Public price only |

**Cost price** (`cost_price`) is **never exposed to clients or agencies**. It is admin/staff internal only.

**Agency price** is returned to agency users as the single `price` field on client endpoints. If `agency_price` is not set, it falls back to `public_price`.

---

## 4. Data Model Relationships

### Core Hierarchy
```
Agency
  └─ has many Users (role=AGENCY)

Reservation
  ├─ belongs to Agency (ownerType=AGENCY) OR Customer/User (ownerType=NORMAL)
  ├─ optionally links to TourPackage
  ├─ has Currency (FK)
  ├─ has many Tourists (inline on create; separate endpoint after)
  ├─ has many HotelBookings
  ├─ has many FlightTickets
  ├─ has many TransferServices
  └─ has many ExcursionBookings (within-reservation excursions)

Tourist
  └─ belongs to Reservation (1 Reservation → many Tourists)
  └─ can be assigned to HotelBookings (many-to-many via tourists array)
  └─ can be assigned to TransferServices as passengers (many-to-many)

HotelBooking
  ├─ belongs to Reservation
  ├─ belongs to HotelRoom (FK — NOT directly to Hotel)
  └─ has many Tourists (assigned from Reservation.tourists)

HotelRoom
  ├─ belongs to Hotel (FK)
  ├─ has room_type: SINGLE | DOUBLE | TRIPLE | FAMILY | SUITE
  ├─ has board_type: RO | BB | HB | FB | ALL | UALL
  ├─ has availability_count (decremented atomically on booking)
  └─ has pricing: public_price, agency_price, cost_price, currency

Hotel
  ├─ has many HotelRooms
  ├─ has many HotelImages (gallery)
  └─ has many HotelFeatures (tags)

TransferService
  ├─ belongs to Reservation
  ├─ optionally links to TourPackage
  ├─ optionally links to Transfer (catalog item, for auto-fill)
  └─ has many passengers (Tourists from Reservation)

Transfer (catalog item)
  └─ belongs to TransferProvider (FK)

TransferProvider
  └─ has many Transfers

FlightTicket
  ├─ belongs to Reservation
  └─ links to Flight (catalog item)

Flight (catalog item)
  └─ standalone inventory item

ExcursionBooking (within reservation)
  ├─ belongs to Reservation
  └─ links to Excursion (catalog item)

ExcursionService (standalone — NOT tied to a Reservation)
  └─ links to Excursion (catalog item)

Excursion (catalog item)
  └─ standalone inventory item

TourPackage
  ├─ has many Flights (optional, M2M)
  ├─ has many Hotels (optional, M2M)
  ├─ has many Transfers (optional, M2M)
  ├─ has many Excursions (optional, M2M)
  └─ has minimum_cost_floor (read-only, calculated from flights + transfers + excursions costs)

Currency
  └─ used as FK on HotelRoom, Flight, Excursion, Transfer, Reservation, HotelBooking, TransferService, ExcursionService
```

### Availability Tracking (HotelRoom)
```
HotelRoom.availability_count is decremented/incremented atomically:
  - Create HotelBooking (non-cancelled) → availability_count -= quantity
  - Cancel HotelBooking → availability_count += quantity
  - Delete HotelBooking → availability_count += quantity
  - Change quantity → availability_count -= (new_qty - old_qty)
  - Change room → old room restored, new room deducted
```

### Tourist Capacity Validation (HotelBooking)
```
Room capacity per room_type:
  SINGLE  → 1 tourist
  DOUBLE  → 2 tourists
  TRIPLE  → 3 tourists
  FAMILY  → 4 tourists
  SUITE   → 4 tourists

Max tourists = room_type_capacity × quantity
```

---

## 5. Page Inventory

| Route | File | Purpose |
|---|---|---|
| `/login` | `src/app/login/page.tsx` | Login form |
| `/` | `src/app/(dashboard)/page.tsx` | Dashboard home |
| `/reservations` | `src/app/(dashboard)/reservations/page.tsx` | Full reservation management |
| `/agencies` | `src/app/(dashboard)/agencies/page.tsx` | Agency list, approval, edit |
| `/hotels` | `src/app/(dashboard)/hotels/page.tsx` | Hotel inventory CRUD |
| `/hotel-rooms` | `src/app/(dashboard)/hotel-rooms/page.tsx` | Hotel room inventory CRUD |
| `/flights` | `src/app/(dashboard)/flights/page.tsx` | Flight inventory CRUD |
| `/tour-packages` | `src/app/(dashboard)/tour-packages/page.tsx` | Tour package CRUD |
| `/excursions` | `src/app/(dashboard)/excursions/page.tsx` | Excursion inventory CRUD |
| `/transfers` | `src/app/(dashboard)/transfers/page.tsx` | Transfer catalog CRUD |
| `/transfer-providers` | `src/app/(dashboard)/transfer-providers/page.tsx` | Transfer provider CRUD |
| `/excursion-services` | `src/app/(dashboard)/excursion-services/page.tsx` | Standalone excursion bookings |
| `/web-sections` | `src/app/(dashboard)/web-sections/page.tsx` | Hero section CMS |

---

## 6. Reservation Creation Flow

The `/reservations` page is the most complex page in the application. It manages the full lifecycle of a reservation and all its associated services.

### Step 1 — Fill Reservation Header Form

Fields:
- `reservation_number` — free text identifier
- `reservation_date` — date
- `status` — DRAFT | CONFIRMED | PENDING (fetched dynamically from backend OPTIONS)
- `owner_type` — AGENCY or NORMAL (determines whether `agency` or `customer/user` FK is used)
- `agency_id` — FK (if owner_type=AGENCY); populated from dropdown
- `customer_id` — FK (if owner_type=NORMAL); populated from dropdown
- `booking_mode` — WITH_TOUR_PACKAGE | STANDALONE_SERVICES
- `tour_package_id` — FK (only used if booking_mode=WITH_TOUR_PACKAGE)
- `currency_id` — FK to Currency

### Step 2 — Add Tourists inline (on create)

Before calling the backend, tourist rows are collected in the form state. Each tourist has:
- `first_name`, `last_name`
- `sex`: MALE | FEMALE
- `age_type`: ADULT | CHILD | INFANT
- `passport_number`, `nationality`, `birth_date`, `passport_expiry_date`

### Step 3 — Submit Reservation

```
POST /api/v1/reservations/admin/reservations/
  Payload:
    {
      "reservation_number": "RES-001",
      "currency": 1,
      "status": "DRAFT",
      "tour_package": 3,        ← null if STANDALONE_SERVICES
      "agency": 5,              ← null if ownerType=NORMAL
      "customer": null,         ← null if ownerType=AGENCY
      "user": null,             ← null if ownerType=AGENCY
      "tourists": [
        { "first_name": "John", "last_name": "Doe", "sex": "MALE", "age_type": "ADULT", ... }
      ]
    }

  ← { id: 12, reservation_number: "RES-001", ... }
```

The returned `id` becomes the `reservationId` used for all subsequent service creation.

### Step 4 — Add Services (tabs on the reservation detail panel)

After saving, a 7-tab panel appears:

| Tab | Service Type | Notes |
|---|---|---|
| Hotel | HotelBooking | Link hotel room + dates + tourists |
| Arrival | TransferService | on_arrival=true, on_departure=false |
| Departure | TransferService | on_arrival=false, on_departure=true |
| Transfer | TransferService | Generic transfer |
| Flight Tickets | FlightTicket | Link to flight catalog item |
| Other | (misc) | — |
| Excursion | ExcursionBooking | Link to excursion catalog item |

### Payload flow for each service — see individual sections below.

### Edit Reservation
```
PATCH /api/v1/reservations/admin/reservations/{id}/
  Payload: same fields as create, partial
```

### Delete Reservation
```
DELETE /api/v1/reservations/admin/reservations/{id}/
```

---

## 7. Tourist Management

Tourists are created **inline with the reservation** on first save. After the reservation exists, they are managed via the `TouristManager` component.

### Add Tourist (after reservation exists)
```
POST /api/v1/reservations/admin/tourists/
  Payload:
    {
      "reservation": 12,
      "first_name": "Jane",
      "last_name": "Smith",
      "sex": "FEMALE",
      "age_type": "ADULT",
      "passport_number": "AB123456",
      "nationality": "GB",
      "birth_date": "1990-05-15",
      "passport_expiry_date": "2030-01-01"
    }
```

### Edit Tourist
```
PATCH /api/v1/reservations/admin/tourists/{id}/
  Payload: same fields, partial
```

### Delete Tourist
```
DELETE /api/v1/reservations/admin/tourists/{id}/
```

### List Tourists for a Reservation
```
GET /api/v1/reservations/admin/tourists/?reservation={id}
  OR
GET /api/v1/reservations/admin/reservations/{id}/
  ← response may include nested "tourists" array
```

The frontend tries multiple query param names (`reservation`, `reservation_id`, `reservationId`) as a compatibility strategy, then falls back to reading nested tourists from the reservation detail endpoint.

### Tourist filtering in UI
When a hotel booking row is selected in the Hotel tab, the Tourist panel filters to show only tourists assigned to that room (`filterTouristIds` prop).

---

## 8. Hotel Booking Flow

### Creating a Hotel Booking

**Form fields (`HotelBookingForm`):**
1. Select hotel (fetched from `/inventory/admin/hotels/`)
2. Select hotel room (fetched from `/inventory/admin/hotel-rooms/?hotel={id}`)
   - Room options show: `room_type / board_type [date_from - date_to] (avail: N)`
3. `check_in_date` — must be within room's `date_from`/`date_to` window
4. `check_out_date` — must be within window
5. `quantity` — number of rooms (integer ≥ 1)
6. `status` — PENDING | CONFIRMED | CANCELLED
7. `is_paid` — boolean
8. **Financial fields:**
   - `selling_currency` (FK to Currency)
   - `price` (selling price)
   - `agency_price`
   - `cost_currency` (FK to Currency)
   - `cost` (internal cost)
   - `cross_currency_rate`
9. **Tracking fields:** `confirm_booking_number`, `agent_confirmation_number`, `hotel_cancellation_number`
10. **Notes:** `internal_note`, `remarks_for_hotel`
11. **Tourists** — multi-select from tourists belonging to this reservation

**Availability check (before/during form):**
```
GET /api/v1/inventory/admin/hotel-rooms/{id}/availability/?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD
  ← {
      "hotel_room": 7,
      "check_in": "2026-07-15",
      "check_out": "2026-07-22",
      "total_count": 10,
      "confirmed_count": 4,
      "pending_count": 2,
      "booked_count": 6,
      "available_count": 4
    }
```

**Create booking:**
```
POST /api/v1/reservations/admin/hotel-bookings/
  Payload:
    {
      "reservation": 12,
      "hotel_room": 7,
      "check_in_date": "2026-07-15",
      "check_out_date": "2026-07-22",
      "quantity": 2,
      "status": "PENDING",
      "tourists": [1, 5],
      "selling_currency": 1,
      "price": "240.00",
      "agency_price": "200.00",
      "cost_currency": 1,
      "cost": "160.00",
      "cross_currency_rate": "1.0000000000",
      "confirm_booking_number": "",
      "agent_confirmation_number": "JOV-H-0099",
      "hotel_cancellation_number": "",
      "internal_note": "VIP client, sea view preferred",
      "remarks_for_hotel": "Late check-in after 22:00",
      "is_paid": false
    }
```

**Edit booking:**
```
PATCH /api/v1/reservations/admin/hotel-bookings/{id}/
  Payload: same fields, partial
```

**Delete booking:**
```
DELETE /api/v1/reservations/admin/hotel-bookings/{id}/
  ← automatically restores availability_count (backend handles this)
```

**Cancel booking (status change to CANCELLED):**
```
PATCH /api/v1/reservations/admin/hotel-bookings/{id}/
  Payload: { "status": "CANCELLED" }
  ← automatically restores availability_count (backend handles this)
  ← hotel_cancellation_number can be set here
```

### HotelBooking Status Lifecycle
```
PENDING → CONFIRMED (supervisor approves)
PENDING → CANCELLED (staff cancels)
CONFIRMED → CANCELLED (cancellation after confirmation)
```

---

## 9. Transfer Service Flow

A `TransferService` is a pickup/dropoff service for tourists in a reservation. It can optionally reference a catalog `Transfer` item for auto-fill.

### Form fields (`TransferServiceForm`):**
1. `transfer_catalog` — optional FK to Transfer catalog; selecting auto-fills price, currency, name, locations
2. `service_name` — free text name
3. `service_date` — date
4. `on_arrival` — boolean (used in the "Arrival" tab)
5. `on_departure` — boolean (used in the "Departure" tab)
6. `from_location_type` — AIRPORT | HOTEL | CITY | OTHER
7. `from_location_name` — free text
8. `to_location_type` — AIRPORT | HOTEL | CITY | OTHER
9. `to_location_name` — free text
10. `price` — selling price
11. `currency` — FK to Currency
12. `passengers` — multi-select from reservation tourists (checkboxes)
13. `external_note` — visible to external parties
14. `driver_note` — visible to the driver

**Create:**
```
POST /api/v1/reservations/admin/transfer-services/
  Payload:
    {
      "reservation": 12,
      "tour_package": null,
      "transfer": 4,         ← optional catalog FK
      "service_name": "Airport Pickup",
      "service_date": "2026-07-15",
      "on_arrival": true,
      "on_departure": false,
      "from_location_type": "AIRPORT",
      "from_location_name": "Istanbul Airport",
      "to_location_type": "HOTEL",
      "to_location_name": "Grand Hotel",
      "price": "50.00",
      "currency": 1,
      "passengers": [1, 2],
      "external_note": "",
      "driver_note": "Flight TK123 arrives at 14:00"
    }
```

**Edit:**
```
PATCH /api/v1/reservations/admin/transfer-services/{id}/
```

**Delete:**
```
DELETE /api/v1/reservations/admin/transfer-services/{id}/
```

### Catalog Auto-fill Flow
When user selects a catalog transfer:
```
GET /api/v1/inventory/admin/transfers/{catalogId}/
  ← { name, from_location, to_location, agency_price, public_price, currency, ... }
  → Pre-fills: service_name, from_location_name, to_location_name, price, currency
```

---

## 10. Flight Ticket Flow

A `FlightTicket` links a reservation to a catalog `Flight` item.

**Create:**
```
POST /api/v1/reservations/admin/flight-tickets/
  Payload:
    {
      "reservation": 12,
      "flight": 3,           ← FK to Flight catalog
      "ticket_number": "TK-0099",
      "seat_class": "ECONOMY",
      "price": "450.00",
      "currency": 1,
      "is_paid": false,
      "note": ""
    }
```

**The FlightTicketManager** component handles the same CRUD pattern as other service managers (list, add via form, edit, delete) with the same table/modal pattern.

**Edit:**
```
PATCH /api/v1/reservations/admin/flight-tickets/{id}/
```

**Delete:**
```
DELETE /api/v1/reservations/admin/flight-tickets/{id}/
```

---

## 11. Excursion Booking (within Reservation)

An `ExcursionBooking` ties an excursion catalog item to a reservation.

**Create:**
```
POST /api/v1/reservations/admin/excursion-bookings/
  Payload:
    {
      "reservation": 12,
      "excursion": 5,
      "excursion_date": "2026-07-17",
      "quantity": 2,
      "price": "80.00",
      "currency": 1,
      "is_paid": false,
      "note": ""
    }
```

**Edit / Delete** follow the same pattern.

---

## 12. Standalone Excursion Services

The `/excursion-services` page manages `ExcursionService` records — these are **NOT** tied to a reservation. They are B2B operational records for tracking excursion sales with full financial detail.

**Intended users:** Agency and STAFF users only (NORMAL users should not see this section in the UI).

**Form fields (`ExcursionServiceForm`):**
1. `excursion_date` — date
2. `is_paid` — boolean
3. `excursion` — FK to Excursion catalog; selecting auto-fills cost, cost_currency, selling_currency
4. `is_combo` — boolean (grouped/combo excursion)
5. `pickup_point` — free text
6. `price` — selling price
7. `selling_currency` — FK to Currency (auto-syncs to cost_currency on change)
8. `cost` — internal cost (required)
9. `cost_currency` — FK to Currency (required)
10. `cross_currency_rate` — decimal
11. `confirm_booking_number` — supplier confirmation
12. `agent_confirmation_number` — agent's reference
13. `note` — free text

**Excursion auto-fill:**
```
GET /api/v1/inventory/admin/excursions/{id}/
  ← { agency_price, public_price, cost_price, currency, ... }
  → Pre-fills: price (agency_price or public_price), cost (cost_price), cost_currency, selling_currency
```

**Create:**
```
POST /api/v1/reservations/admin/excursion-services/
  Payload:
    {
      "excursion_date": "2026-07-17",
      "is_paid": false,
      "excursion": 5,
      "is_combo": false,
      "pickup_point": "Grand Hotel lobby",
      "price": "45.00",
      "selling_currency": 1,
      "cost": "30.00",
      "cost_currency": 1,
      "cross_currency_rate": "1.0000000000",
      "confirm_booking_number": "EXC-990",
      "agent_confirmation_number": "JOV-E-0021",
      "note": ""
    }
```

**Edit:**
```
PATCH /api/v1/reservations/admin/excursion-services/{id}/
```

**Delete:**
```
DELETE /api/v1/reservations/admin/excursion-services/{id}/
```

**List (paginated with filters):**
```
GET /api/v1/reservations/admin/excursion-services/
  Query params:
    excursion_date_after=YYYY-MM-DD
    excursion_date_before=YYYY-MM-DD
    is_paid=true|false
    is_combo=true|false
    page=1
    page_size=20
  ← { count, next, previous, results: [...] }
```

---

## 13. Cancellation Flow

### Cancel a Hotel Booking
```
1. User selects a hotel booking row in the Hotel tab
2. Clicks "Cancel" button
3. PATCH /api/v1/reservations/admin/hotel-bookings/{id}/
   Payload: { "status": "CANCELLED", "hotel_cancellation_number": "CXL-001" }
4. Backend atomically restores HotelRoom.availability_count += quantity
5. Query cache is invalidated:
   - ["reservation-service", "hotel", reservationId]
   - ["room-availability"]
6. Toast notification: "Hotel booking cancelled. Availability restored."
```

### Delete a Hotel Booking
```
1. User selects a hotel booking row
2. Clicks "Delete" (destructive — confirmation prompt appears)
3. DELETE /api/v1/reservations/admin/hotel-bookings/{id}/
4. Backend atomically restores HotelRoom.availability_count += quantity
5. Query cache invalidated
```

### Cancel/Delete Other Services
Transfer services, flight tickets, and excursion bookings all use DELETE only (no status-based cancel). Same pattern: select row → confirm → DELETE → invalidate cache.

---

## 14. Inventory Management Pages

All inventory pages (except `/hotel-rooms`, `/transfers`, `/tour-packages`) use the shared `InventoryManagementPage` component driven by a config object. The custom pages (`/hotel-rooms`, `/transfers`, `/tour-packages`) have their own full implementations.

### Hotels (`/hotels`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/hotels/`
- **Fields:** `name` (multi-lang: `name_en`, `name_tr`, `name_ru`), `city` (multi-lang), `stars`, `description` (multi-lang), `main_image` (file upload), `features` (multi-select feature IDs), `gallery_images` (multi file upload)
- **Row action:** "Rooms" button links to `/hotel-rooms?hotel={id}` to filter rooms by hotel

### Hotel Rooms (`/hotel-rooms`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/hotel-rooms/`
- **Filter by hotel:** query param `?hotel={id}` (set via URL search param from Hotels page link)
- **Fields:**
  - `hotel` — FK (dropdown)
  - `room_type` — SINGLE | DOUBLE | TRIPLE | FAMILY | SUITE
  - `board_type` — RO | BB | HB | FB | ALL | UALL
  - `date_from` / `date_to` — validity window for this room record
  - `availability_count` — integer ≥ 0
  - `currency` — FK (dropdown)
  - `public_price` — required
  - `agency_price` — optional
  - `cost_price` — internal cost, optional
  - `note` — multi-lang

### Flights (`/flights`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/flights/`
- **Fields:** `flight_number`, `airline`, `origin`, `destination`, `departure_time`, `arrival_time`, `currency`, `price`, `agency_price`, `cost_price` (internal)

### Tour Packages (`/tour-packages`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/tour-packages/`
- **Fields:**
  - `name`, `destination`, `days`, `nights`, `currency`
  - `flights` — array of Flight IDs
  - `hotels` — array of Hotel IDs
  - `transfers` — array of Transfer IDs
  - `excursions` — array of Excursion IDs
  - `public_price`, `agency_price`, `cost_price`
  - `minimum_cost_floor` — read-only, calculated by backend from component costs (flights + transfers + excursions only; hotel costs are per-room)
- **Validation:**
  - `cost_price`, `agency_price`, `public_price` cannot be below `minimum_cost_floor`
  - `public_price` cannot be below `agency_price`

### Excursions (`/excursions`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/excursions/`
- **Fields:** `name` (multi-lang), `city` (multi-lang), `duration_hours`, `currency`, `public_price`, `agency_price`, `cost_price` (internal)

### Transfers (`/transfers`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/transfers/`
- **Fields:** `provider` (FK to TransferProvider), `name` (multi-lang), `from_location` (multi-lang), `to_location` (multi-lang), `vehicle_type` (multi-lang), `capacity`, `currency`, `public_price`, `agency_price`, `cost_price`
- **Pagination:** page_size=20

### Transfer Providers (`/transfer-providers`)
- **Endpoint:** `GET/POST/PUT/PATCH/DELETE /api/v1/inventory/admin/transfer-providers/`
- **Fields:** `name`, `provider_type` (COMPANY | INDIVIDUAL), `contact_person`, `phone`, `email`, `notes`

---

## 15. Agency Management Flow

### List Agencies
```
GET /api/v1/agencies/admin/agencies/
  ← [{ id, name, agency_type, contact_person, email, phone, mobile_phone, skype_id, icq, is_approved, approved_at }, ...]
```

**Filters in UI:** All | Pending | Approved (client-side filter)

**Sort:** Pending agencies shown first, then alphabetical.

### Approve an Agency
```
POST /api/v1/agencies/admin/agencies/{id}/approve/
  ← Sets is_approved=true, stamps approved_at, activates linked agency users (is_active=true)
```

After approval, the agency's users can log in.

### Edit Agency Details
```
PATCH /api/v1/agencies/admin/agencies/{id}/
  Payload:
    {
      "name": "...",
      "agency_type": "...",
      "contact_person": "...",
      "email": "...",
      "phone": "...",
      "mobile_phone": "...",
      "skype_id": "...",
      "icq": "..."
    }
```

### Agency Registration (client-side / public)
```
POST /api/v1/agencies/client/register/
  Creates Agency + linked User with role=AGENCY, is_active=false
  User cannot log in until admin approves
```

---

## 16. Finance & Currencies

### Currencies
```
GET /api/v1/finance/admin/currencies/         ← list all
POST /api/v1/finance/admin/currencies/        ← create
PATCH /api/v1/finance/admin/currencies/{id}/  ← edit
DELETE /api/v1/finance/admin/currencies/{id}/ ← delete

Currency fields: code (e.g. "USD"), name_en, name_tr, name_ru, is_active
```

Currencies are used as FK throughout: hotel rooms, flights, excursions, transfers, tour packages, hotel bookings, transfer services, excursion services.

Active currencies (`is_active=true`) are fetched when building dropdowns.

### Exchange Rates
```
GET /api/v1/finance/admin/exchange-rates/
POST /api/v1/finance/admin/exchange-rates/
PATCH/DELETE /api/v1/finance/admin/exchange-rates/{id}/
```

### Currency Conversion
```
GET /api/v1/finance/client/convert/?from=USD&to=TRY&amount=100
  ← {
      "from": "USD",
      "to": "TRY",
      "amount": "100",
      "converted_amount": "3910.00",
      "effective_rate": "39.1000000000"
    }
```

This is used in reservation/booking forms when auto-converting prices between currencies.

### Invoices
```
GET/POST /api/v1/finance/admin/invoices/
GET/PUT/PATCH/DELETE /api/v1/finance/admin/invoices/{id}/
```
(Invoice management UI not yet implemented in Next.js frontend.)

---

## 17. Web Sections / CMS

The `/web-sections` page manages public website content.

### Hero Section

**Read:**
```
GET /api/v1/public-site/admin/hero/
  ← {
      "badge_text": "...",
      "logo": "http://.../media/logo.png",
      "image": "http://.../media/hero.jpg",
      "headline": "...",
      "description": "...",
      "search_placeholder": "...",
      "search_button_text": "...",
      "updated_at": "2026-06-01T12:00:00Z"
    }
```

**Update (text fields):**
```
PATCH /api/v1/public-site/admin/hero/
  Content-Type: application/json
  Payload: { badge_text, headline, description, search_placeholder, search_button_text }
```

**Update (with image upload):**
```
PATCH /api/v1/public-site/admin/hero/
  Content-Type: multipart/form-data
  Fields: logo (file), image (file), + any text fields
```

### Coming-soon sections (not yet implemented):
- Featured Destinations
- Testimonials

---

## 18. Pricing Logic

### Three price tiers
Every inventory item (HotelRoom, Flight, Excursion, Transfer, TourPackage) has:
- `public_price` — shown to NORMAL/unauthenticated users
- `agency_price` — shown to AGENCY, STAFF, is_staff users (falls back to public_price if not set)
- `cost_price` — **internal only**, never sent to clients or agencies; used for profit tracking

### Client endpoint behavior
Client endpoints (for public/agency access) return a single `price` field:
```
If user is AGENCY or STAFF or is_staff → price = agency_price (or public_price fallback)
If user is NORMAL or unauthenticated   → price = public_price
cost_price is NEVER included in client responses
```

### Hotel pricing note
Hotels themselves have no pricing. All pricing is on `HotelRoom` records (each room type/board type combination has its own prices).

### TourPackage minimum_cost_floor
```
minimum_cost_floor = sum of cost_prices of linked:
  - Flights
  - Transfers
  - Excursions
  (Hotel costs are excluded — they are tracked per HotelRoom)

Constraint: cost_price >= minimum_cost_floor
            agency_price >= minimum_cost_floor
            public_price >= minimum_cost_floor
            public_price >= agency_price
```

---

## 19. API Endpoint Reference

**Base URL:** `http://127.0.0.1:8000/api/v1` (configured via `NEXT_PUBLIC_API_BASE_URL`)

### Auth
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/auth/login/` | `{ email, password }` → `{ access, refresh }` |
| POST | `/auth/refresh/` | `{ refresh }` → `{ access }` |
| GET | `/auth/me/` | Current user info |
| POST | `/auth/register/` | Creates NORMAL user |

### Accounts
| Method | Endpoint |
|---|---|
| GET, POST | `/accounts/admin/users/` |
| GET, PUT, PATCH, DELETE | `/accounts/admin/users/{id}/` |

### Agencies
| Method | Endpoint |
|---|---|
| GET, POST | `/agencies/admin/agencies/` |
| GET, PUT, PATCH, DELETE | `/agencies/admin/agencies/{id}/` |
| POST | `/agencies/admin/agencies/{id}/approve/` |
| GET | `/agencies/client/agencies/` |
| POST | `/agencies/client/register/` |

### Inventory — Hotels
| Method | Endpoint |
|---|---|
| GET, POST | `/inventory/admin/hotels/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/hotels/{id}/` |
| GET, POST | `/inventory/admin/hotel-rooms/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/hotel-rooms/{id}/` |
| GET | `/inventory/admin/hotel-rooms/{id}/availability/?check_in=&check_out=` |
| GET, POST | `/inventory/admin/hotel-images/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/hotel-images/{id}/` |
| GET, POST | `/inventory/admin/hotel-features/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/hotel-features/{id}/` |

### Inventory — Flights, Excursions, Transfers
| Method | Endpoint |
|---|---|
| GET, POST | `/inventory/admin/flights/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/flights/{id}/` |
| GET, POST | `/inventory/admin/excursions/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/excursions/{id}/` |
| GET, POST | `/inventory/admin/transfer-providers/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/transfer-providers/{id}/` |
| GET, POST | `/inventory/admin/transfers/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/transfers/{id}/` |

### Inventory — Tour Packages
| Method | Endpoint |
|---|---|
| GET, POST | `/inventory/admin/tour-packages/` |
| GET, PUT, PATCH, DELETE | `/inventory/admin/tour-packages/{id}/` |
| GET | `/inventory/admin/tour-packages/{id}/hotels/` |

### Reservations
| Method | Endpoint |
|---|---|
| GET, POST | `/reservations/admin/reservations/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/reservations/{id}/` |
| GET, POST | `/reservations/admin/tourists/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/tourists/{id}/` |
| GET, POST | `/reservations/admin/hotel-bookings/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/hotel-bookings/{id}/` |
| GET, POST | `/reservations/admin/flight-tickets/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/flight-tickets/{id}/` |
| GET, POST | `/reservations/admin/excursion-bookings/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/excursion-bookings/{id}/` |
| GET, POST | `/reservations/admin/transfer-services/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/transfer-services/{id}/` |
| GET, POST | `/reservations/admin/excursion-services/` |
| GET, PUT, PATCH, DELETE | `/reservations/admin/excursion-services/{id}/` |

### Finance
| Method | Endpoint |
|---|---|
| GET, POST | `/finance/admin/currencies/` |
| GET, PUT, PATCH, DELETE | `/finance/admin/currencies/{id}/` |
| GET, POST | `/finance/admin/exchange-rates/` |
| GET, PUT, PATCH, DELETE | `/finance/admin/exchange-rates/{id}/` |
| GET, POST | `/finance/admin/invoices/` |
| GET, PUT, PATCH, DELETE | `/finance/admin/invoices/{id}/` |
| GET | `/finance/client/convert/?from=USD&to=TRY&amount=100` |

### Public Site
| Method | Endpoint |
|---|---|
| GET | `/public-site/client/hero/` |
| GET, PUT, PATCH | `/public-site/admin/hero/` |

---

## 20. Frontend File Structure

```
src/
├── app/
│   ├── globals.css                         ← Tailwind base styles
│   ├── layout.tsx                          ← Root layout (QueryProvider, fonts)
│   ├── login/
│   │   └── page.tsx                        ← Login page (email + password form)
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts              ← BFF: proxies login, sets cookies, checks role
│   │       ├── logout/route.ts             ← BFF: clears cookies
│   │       ├── me/route.ts                 ← BFF: proxies GET /auth/me/
│   │       └── refresh/route.ts            ← BFF: proxies token refresh
│   └── (dashboard)/
│       ├── layout.tsx                      ← Auth guard + DashboardShell wrapper
│       ├── page.tsx                        ← Dashboard home (stats/overview)
│       ├── reservations/page.tsx           ← Full reservation CRUD + service managers
│       ├── agencies/page.tsx               ← Agency list, approve, edit
│       ├── hotels/page.tsx                 ← Hotel CRUD (uses InventoryManagementPage)
│       ├── hotel-rooms/page.tsx            ← Hotel room CRUD (custom full page)
│       ├── flights/page.tsx                ← Flight CRUD (uses InventoryManagementPage)
│       ├── tour-packages/page.tsx          ← Tour package CRUD (uses TourPackageForm)
│       ├── excursions/page.tsx             ← Excursion CRUD (uses InventoryManagementPage)
│       ├── transfers/page.tsx              ← Transfer CRUD (custom full page)
│       ├── transfer-providers/page.tsx     ← Transfer provider CRUD
│       ├── excursion-services/page.tsx     ← Standalone excursion services
│       └── web-sections/page.tsx           ← Hero section CMS
│
├── components/
│   ├── dashboard-shell.tsx                 ← Sidebar + topbar layout wrapper
│   ├── dashboard-sidebar-nav.tsx           ← Navigation links grouped by section
│   ├── dashboard-user-menu.tsx             ← User avatar menu (logout)
│   ├── inventory-management-page.tsx       ← Reusable CRUD table+form component
│   ├── providers/
│   │   └── query-provider.tsx              ← TanStack Query client provider
│   ├── reservations/
│   │   ├── ReservationServiceManagers.tsx  ← HotelBookingManager, TransferServiceManager,
│   │   │                                      ExcursionServiceManager, FlightTicketManager
│   │   ├── HotelBookingForm.tsx            ← Hotel booking add/edit form
│   │   ├── TransferServiceForm.tsx         ← Transfer service add/edit form
│   │   ├── ExcursionServiceForm.tsx        ← Excursion service add/edit form (standalone)
│   │   ├── TouristForm.tsx                 ← Tourist add/edit form
│   │   └── TouristManager.tsx              ← Tourist list + CRUD panel
│   ├── tour-packages/
│   │   └── TourPackageForm.tsx             ← Tour package form (multi-select components)
│   └── web-sections/
│       └── hero-section-settings.tsx       ← Hero section edit form
│
├── hooks/
│   ├── use-agencies.ts                     ← useAdminAgencies, useApproveAgency, useUpdateAgency
│   ├── use-public-site-settings.ts         ← useAdminHeroSection, useUpdateAdminHeroSection
│   ├── use-tour-packages.ts                ← useAdminTourPackages, useAdminTourPackageDetail,
│   │                                          useCreateTourPackage, useUpdateTourPackage
│   └── use-tourists.ts                     ← useTourists, useCreateTourist, useUpdateTourist,
│                                              useDeleteTourist
│
└── lib/
    ├── api-endpoints.ts                    ← All endpoint constants + USER_ROLES
    ├── axios.ts                            ← Axios instance + JWT interceptor + refresh logic
    ├── api/
    │   ├── agencies.ts                     ← Agency API functions
    │   ├── hotel-rooms.ts                  ← HotelRoom list/create/update/delete + availability
    │   ├── public-site.ts                  ← Hero section get/update
    │   ├── reservation-services.ts         ← HotelBooking, TransferService, FlightTicket,
    │   │                                      ExcursionService CRUD + normalization
    │   ├── tour-packages.ts                ← TourPackage CRUD + currency conversion
    │   ├── tourists.ts                     ← Tourist CRUD + createReservationWithTourists
    │   ├── transfer-providers.ts           ← TransferProvider CRUD
    │   └── transfers.ts                    ← Transfer inventory CRUD
    ├── auth/
    │   ├── roles.ts                        ← canAccessAdminApp(), hasBlockedAdminRole()
    │   ├── server-auth.ts                  ← fetchCurrentUser() (server-side)
    │   └── types.ts                        ← AuthenticatedUser type
    ├── forms/
    │   └── backend-errors.ts              ← mapBackendValidationErrors()
    ├── reservations/
    │   └── admin-reservations.ts          ← buildReservationPayload(), resolveTourPackageId()
    └── validation/
        ├── tour-package.ts                ← Zod schema + form ↔ payload converters
        └── tourist.ts                     ← Zod schema + sanitizeTouristInput()
```

---

## Key Patterns to Know When Modifying Code

### Adding a new field to a form
1. Add the field to the Zod schema in the relevant validation file or inline schema
2. Add the field to the `FormValues` type
3. Add the field to `emptyValues()` / `initialValues` function
4. Add the field to the `input → payload` conversion (e.g. `buildReservationPayload`)
5. Add the field to the `payload → form` hydration (e.g. `bookingToValues`)
6. Add the JSX input in the form component
7. If it's a new FK field, add its dropdown query and options

### Adding a new service tab to reservations
1. Add a new manager component in `ReservationServiceManagers.tsx` (follow `HotelBookingManager` pattern)
2. Add a new form component in `src/components/reservations/`
3. Add CRUD functions to `src/lib/api/reservation-services.ts`
4. Add the tab label to `TAB_LABELS` in `reservations/page.tsx`
5. Add the tab panel case to the tab content renderer in `reservations/page.tsx`

### Adding a new inventory page (simple)
1. Define a `config` object matching `InventoryPageConfig` type from `inventory-management-page.tsx`
2. Create the page file at `src/app/(dashboard)/your-page/page.tsx`
3. Return `<InventoryManagementPage config={yourConfig} />`
4. Add the link to `navigationGroups` in `dashboard-sidebar-nav.tsx`

### Cancellation vs Deletion
- **Hotel bookings:** use `PATCH` with `{ status: "CANCELLED" }` to preserve the record + restore availability. Use `DELETE` only to fully remove.
- **All other services (transfers, flights, excursion bookings):** only `DELETE` is used.

### Query cache keys
```
["reservation-service", "hotel", reservationId]
["reservation-service", "transfer", reservationId]
["reservation-service", "flight-ticket", reservationId]
["reservation-service", "excursion-booking", reservationId]
["tourists-for-reservation", reservationId]
["excursion-services"]
["inventory-hotels", "admin"]
["inventory-excursions", "admin"]
["transfer-catalog", "admin"]
["finance-currencies"]
["finance-currencies", "admin"]
["room-availability"]
["admin-tour-packages"]
["admin-tour-package-detail", id]
["agencies"]
["transfer-providers"]
["admin-hero-section"]
```
