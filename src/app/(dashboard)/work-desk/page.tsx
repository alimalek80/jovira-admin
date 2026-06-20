import { cookies } from "next/headers";
import Link from "next/link";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";

type WorkDeskFetchResult = {
  ok: boolean;
  status: number | null;
  payload: unknown;
  error: string | null;
};

function stripBearerPrefix(token: string) {
  return token.replace(/^Bearer\s+/i, "").trim();
}

async function fetchWorkDeskPayload(accessToken: string | undefined): Promise<WorkDeskFetchResult> {
  if (!accessToken) {
    return {
      ok: false,
      status: null,
      payload: null,
      error: "Missing access token.",
    };
  }

  try {
    const response = await fetch(RESERVATIONS_ENDPOINTS.adminWorkDesk, {
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
        payload,
        error: "Backend returned an error.",
      };
    }

    return {
      ok: true,
      status: response.status,
      payload,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      payload: null,
      error: error instanceof Error ? error.message : "Failed to fetch Work Desk data.",
    };
  }
}

export default async function WorkDeskPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access")?.value;
  const workDeskResult = await fetchWorkDeskPayload(accessToken);

  const payloadPreview =
    workDeskResult.payload === null
      ? "null"
      : JSON.stringify(workDeskResult.payload, null, 2);

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
              This is the first Work Desk route. For now, it only connects to the backend endpoint
              and shows the raw response preview.
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              workDeskResult.ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {workDeskResult.ok ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Endpoint
          </p>
          <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-700">
            {RESERVATIONS_ENDPOINTS.adminWorkDesk}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Response Status
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {workDeskResult.status ?? "--"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            HTTP status returned by the backend.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next Step
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            P02-S11 — Create Work Desk table UI
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            After this route is confirmed, we will render the data as an operational table.
          </p>
        </div>
      </div>

      {!workDeskResult.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {workDeskResult.error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Raw Response Preview
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Temporary preview for validating the backend response shape.
            </p>
          </div>

          <Link
            href="/reservations"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open Reservations
          </Link>
        </div>

        <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {payloadPreview}
        </pre>
      </div>
    </section>
  );
}