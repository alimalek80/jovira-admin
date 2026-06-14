# Project Structure — jovira-admin

Next.js 14+ admin dashboard for managing travel/tourism operations (reservations, tours, hotels, transfers, agencies, and public-site content).

---

## Root

| Path | Description |
|------|-------------|
| `next.config.ts` | Next.js configuration file (build, env, rewrites, etc.). |
| `tsconfig.json` | TypeScript compiler options and path aliases (`@/*`). |
| `package.json` | Project dependencies, scripts (`dev`, `build`, `test`). |
| `package-lock.json` | Locked dependency tree for reproducible installs. |
| `eslint.config.mjs` | ESLint flat-config rules for the project. |
| `postcss.config.mjs` | PostCSS configuration (used by Tailwind CSS). |
| `vitest.config.ts` | Vitest test runner configuration (unit tests). |
| `next-env.d.ts` | Auto-generated Next.js TypeScript ambient declarations. |
| `.gitignore` | Files and folders excluded from version control. |
| `README.md` | Project overview and getting-started instructions. |
| `AGENTS.md` | AI agent rules — instructs agents to read Next.js docs before writing code. |
| `CLAUDE.md` | Alias that re-exports `AGENTS.md` for Claude-based agents. |
| `API_ENDPOINTS.md` | Human-readable reference of all backend API endpoints used. |
| `DATAFLOW_AND_RELATIONSHIPS.md` | Documents data flow and entity relationships across the app. |

---

## `public/`

Static assets served directly by Next.js at the root URL path.

| Path | Description |
|------|-------------|
| `public/globe.svg` | Globe SVG icon (used in default Next.js template). |
| `public/file.svg` | File SVG icon (used in default Next.js template). |
| `public/next.svg` | Next.js logo SVG. |
| `public/vercel.svg` | Vercel logo SVG. |
| `public/window.svg` | Window SVG icon (used in default Next.js template). |

---

## `src/app/`

Next.js App Router — pages, layouts, and API route handlers.

| Path | Description |
|------|-------------|
| `src/app/layout.tsx` | Root layout; sets up global fonts, metadata, and wraps the app in `QueryProvider`. |
| `src/app/globals.css` | Global CSS styles and Tailwind base/component/utility directives. |
| `src/app/favicon.ico` | Browser tab favicon for the admin app. |

### `src/app/login/`

| Path | Description |
|------|-------------|
| `src/app/login/page.tsx` | Login page with email/password form that calls `/api/auth/login`. |

### `src/app/(dashboard)/`

Route group for all protected dashboard pages; shares the dashboard layout.

| Path | Description |
|------|-------------|
| `src/app/(dashboard)/layout.tsx` | Dashboard layout — checks auth cookie, resolves the current user, and renders `DashboardShell`; redirects to `/login` if unauthenticated. |
| `src/app/(dashboard)/page.tsx` | Dashboard home page — displays key metrics (reservations, agencies, inventory counts). |
| `src/app/(dashboard)/agencies/page.tsx` | Agencies management page — list, create, and edit travel agencies. |
| `src/app/(dashboard)/hotel-rooms/page.tsx` | Hotel rooms inventory page — manage hotel room availability and pricing. |
| `src/app/(dashboard)/hotels/page.tsx` | Hotels inventory page — manage hotel listings. |
| `src/app/(dashboard)/excursions/page.tsx` | Excursions inventory page — manage excursion offerings. |
| `src/app/(dashboard)/excursion-services/page.tsx` | Excursion services page — manage service variants attached to excursions. |
| `src/app/(dashboard)/flights/page.tsx` | Flights inventory page — manage flight inventory items. |
| `src/app/(dashboard)/transfers/page.tsx` | Transfers inventory page — manage transfer inventory items. |
| `src/app/(dashboard)/transfer-providers/page.tsx` | Transfer providers page — manage companies/individuals that supply transfer services. |
| `src/app/(dashboard)/tour-packages/page.tsx` | Tour packages page — create, edit, and list bundled tour packages. |
| `src/app/(dashboard)/reservations/page.tsx` | Reservations management page — create and manage customer reservations with tourists and services. |
| `src/app/(dashboard)/web-sections/page.tsx` | Web sections page — edit public-site content (e.g., hero section). |

### `src/app/api/`

Next.js API route handlers (BFF/proxy layer between the browser and the Django backend).

| Path | Description |
|------|-------------|
| `src/app/api/auth/login/route.ts` | `POST` — authenticates credentials against the backend, sets `access`/`refresh` cookies, and enforces admin role check. |
| `src/app/api/auth/logout/route.ts` | `POST` — clears auth cookies to log the user out. |
| `src/app/api/auth/me/route.ts` | `GET` — returns the current authenticated user's profile from the access token cookie. |
| `src/app/api/auth/refresh/route.ts` | `POST` — exchanges the refresh token for a new access token and updates the cookie. |
| `src/app/api/finance/currencies/route.ts` | `GET` — proxies the list of available currencies from the backend finance API. |
| `src/app/api/public-site/admin/hero/route.ts` | `GET`/`PATCH` — proxies read and update of the public-site hero section settings. |

---

## `src/components/`

Reusable React components shared across pages.

| Path | Description |
|------|-------------|
| `src/components/dashboard-shell.tsx` | Outer dashboard layout shell — renders the collapsible sidebar and top header around page content. |
| `src/components/dashboard-sidebar-nav.tsx` | Sidebar navigation links with active-state highlighting based on the current route. |
| `src/components/dashboard-user-menu.tsx` | User avatar/menu dropdown in the header that handles logout. |
| `src/components/inventory-management-page.tsx` | Generic, reusable CRUD table page component used by all inventory section pages. |

### `src/components/providers/`

| Path | Description |
|------|-------------|
| `src/components/providers/query-provider.tsx` | Wraps the app with TanStack Query `QueryClientProvider` for server-state management. |

### `src/components/reservations/`

| Path | Description |
|------|-------------|
| `src/components/reservations/TouristForm.tsx` | Form for creating or editing a single tourist record within a reservation. |
| `src/components/reservations/TouristManager.tsx` | Manages the list of tourists on a reservation — add, edit, delete tourists via `TouristForm`. |
| `src/components/reservations/ReservationServiceManagers.tsx` | Orchestrates hotel bookings, transfer services, and excursion services within a reservation. |
| `src/components/reservations/HotelBookingForm.tsx` | Form for adding or editing a hotel room booking attached to a reservation. |
| `src/components/reservations/TransferServiceForm.tsx` | Form for adding or editing a transfer service line on a reservation. |
| `src/components/reservations/ExcursionServiceForm.tsx` | Form for adding or editing an excursion service line on a reservation. |

### `src/components/tour-packages/`

| Path | Description |
|------|-------------|
| `src/components/tour-packages/TourPackageForm.tsx` | Form for creating or editing a tour package (name, destination, days, flights, hotels, transfers, excursions, pricing). |

### `src/components/web-sections/`

| Path | Description |
|------|-------------|
| `src/components/web-sections/hero-section-settings.tsx` | Settings form for editing the public-site hero section fields (title, tagline, image, etc.). |

---

## `src/hooks/`

Custom React hooks (TanStack Query wrappers for data fetching and mutations).

| Path | Description |
|------|-------------|
| `src/hooks/use-agencies.ts` | Hooks for fetching the agency list and creating/updating/deleting agencies. |
| `src/hooks/use-tour-packages.ts` | Hooks for fetching tour packages, form option data (currencies, inventory), and mutations. |
| `src/hooks/use-tourists.ts` | Hooks for fetching, creating, updating, and deleting tourists scoped to a reservation. |
| `src/hooks/use-public-site-settings.ts` | Hooks for reading and updating public-site section settings (hero, etc.). |

---

## `src/lib/`

Core business logic, API clients, utilities, and validation.

| Path | Description |
|------|-------------|
| `src/lib/axios.ts` | Configured Axios instance with base URL, auth header injection, and automatic token refresh on 401. |
| `src/lib/api-endpoints.ts` | Central registry of all backend API endpoint URL strings, grouped by domain. |

### `src/lib/api/`

API client functions (typed wrappers around Axios calls to the backend REST API).

| Path | Description |
|------|-------------|
| `src/lib/api/agencies.ts` | CRUD functions and types for the agencies resource. |
| `src/lib/api/hotel-rooms.ts` | CRUD functions and types for hotel room inventory. |
| `src/lib/api/tour-packages.ts` | CRUD functions and types for tour packages, including currency conversion helpers. |
| `src/lib/api/tourists.ts` | CRUD functions and types for tourists associated with reservations. |
| `src/lib/api/transfers.ts` | CRUD functions and types for transfer inventory items. |
| `src/lib/api/transfer-providers.ts` | CRUD functions and types for transfer provider companies/individuals. |
| `src/lib/api/reservation-services.ts` | Functions and types for hotel bookings, transfer services, and excursion services on reservations. |
| `src/lib/api/reservation-services.test.ts` | Unit tests for reservation-services API helper functions. |
| `src/lib/api/public-site.ts` | Types and API calls for reading/updating public-site content (hero section, etc.). |

### `src/lib/auth/`

Authentication and authorization utilities.

| Path | Description |
|------|-------------|
| `src/lib/auth/types.ts` | TypeScript types for the authenticated user object (`AuthenticatedUser`). |
| `src/lib/auth/roles.ts` | Role-check helpers — determines if a user is allowed to access the admin app. |
| `src/lib/auth/roles.test.ts` | Unit tests for role-check helper functions. |
| `src/lib/auth/server-auth.ts` | Server-side utilities to decode the JWT, fetch the current user profile, and validate admin access. |

### `src/lib/forms/`

| Path | Description |
|------|-------------|
| `src/lib/forms/backend-errors.ts` | Maps Django REST Framework validation error responses into a flat `FieldErrorMap` for form display. |

### `src/lib/reservations/`

| Path | Description |
|------|-------------|
| `src/lib/reservations/admin-reservations.ts` | State types and business logic for the admin reservation form (owner type, booking mode, form state). |
| `src/lib/reservations/admin-reservations.test.ts` | Unit tests for the reservation form logic helpers. |

### `src/lib/validation/`

Zod schemas used for client-side form validation before submitting to the API.

| Path | Description |
|------|-------------|
| `src/lib/validation/tourist.ts` | Zod schema and sanitization for tourist form input (name, sex, age type, passport, etc.). |
| `src/lib/validation/tour-package.ts` | Zod schema and payload conversion helpers for tour package form input. |
