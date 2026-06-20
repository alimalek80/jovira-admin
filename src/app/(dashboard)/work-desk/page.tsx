import { cookies } from "next/headers";
import Link from "next/link";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";

type WorkDeskHotelBooking = {
  id: number;
  reservation: number;
  hotel_room: number;
  check_in_date: string;
  check_out_date: string;
  quantity: number;
  status: string;
  is_paid: boolean;
};

type WorkDeskReservation = {
  id: number;
  reservation_number: string;
  created_at: string;
  currency: number | null;
  status: string;
  agency: number | null;
  assigned_to: number | null;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  tour_package: number | null;
  tourists: unknown[];
  hotel_bookings: WorkDeskHotelBooking[];
  flight_tickets: unknown[];
  transfer_services: unknown[];
  is_locked_by_finance: boolean;
};

type WorkDeskFetchResult = {
  ok: boolean;
  status: number | null;
  data: WorkDeskReservation[];
  error: string | null;
};

type WorkDeskPageProps = {
  searchParams?: Promise<{
    only_me?: string;
  }>;
};

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700";
    case "ON_PROCESS":
    case "PROCESSING":
      return "bg-amber-50 text-amber-700";
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-700";
    case "CANCELED":
    case "CANCELLED":
      return "bg-rose-50 text-rose-700";
    case "PENDING_INVOICE":
      return "bg-indigo-50 text-indigo-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

async function fetchWorkDeskReservations(
  accessToken: string | undefined,
  queryString = ""
): Promise<WorkDeskFetchResult> {
  if (!accessToken) {
    return {
      ok: false,
      status: null,
      data: [],
      error: "Missing access token.",
    };
  }

  try {
    const endpoint = queryString
      ? `${RESERVATIONS_ENDPOINTS.adminWorkDesk}?${queryString}`
      : RESERVATIONS_ENDPOINTS.adminWorkDesk;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripBearerPrefix(accessToken)}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: [],
        error: "Backend returned an error.",
      };
    }

    if (!Array.isArray(payload)) {
      return {
        ok: false,
        status: response.status,
        data: [],
        error: "Unexpected Work Desk response format.",
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload as WorkDeskReservation[],
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: [],
      error: error instanceof Error ? error.message : "Failed to fetch Work Desk data.",
    };
  }
}

export default async function WorkDeskPage({ searchParams }: WorkDeskPageProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;
  const resolvedSearchParams = await searchParams;

  const queryParams = new URLSearchParams();

  if (resolvedSearchParams?.only_me) {
    queryParams.set("only_me", resolvedSearchParams.only_me);
  }

  const workDeskResult = await fetchWorkDeskReservations(
    accessToken,
    queryParams.toString()
  );

  const reservations = workDeskResult.data;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Operations
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Work Desk
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Active operational reservations that need attention from the reservation team.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                workDeskResult.ok
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {workDeskResult.ok ? "Connected" : "Not connected"}
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {reservations.length} tasks
            </div>
          </div>
        </div>
      </div>

      {!workDeskResult.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {workDeskResult.error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Reservation Tasks
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Simple Work Desk table based on the current backend response.
          </p>
        </div>

        {reservations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-900">No active tasks found.</p>
            <p className="mt-1 text-sm text-slate-500">
              New active reservations will appear here when the backend returns them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    RF Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Agency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tour Package
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tourists
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hotels
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Flights
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Transfers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Finance
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-900">
                      {reservation.reservation_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {formatDateTime(reservation.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                          reservation.status
                        )}`}
                      >
                        {reservation.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {reservation.agency ? `Agency #${reservation.agency}` : "Direct"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {reservation.tour_package
                        ? `Package #${reservation.tour_package}`
                        : "Standalone"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                      {reservation.tourists.length}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                      {reservation.hotel_bookings.length}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                      {reservation.flight_tickets.length}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                      {reservation.transfer_services.length}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          reservation.is_locked_by_finance
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {reservation.is_locked_by_finance ? "Locked" : "Open"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <Link
                        href="/reservations"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}