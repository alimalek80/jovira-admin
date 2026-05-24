"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminAgencies, useApproveAgency, useUpdateAgency } from "@/hooks/use-agencies";
import { agencyKeys } from "@/hooks/use-agencies";
import type { Agency, AgencyUpdatePayload } from "@/lib/api/agencies";

type AgencyFilter = "all" | "pending" | "approved";
type ModalMode = "view" | "edit";
type AgencyFormState = AgencyUpdatePayload;

const filters: Array<{ value: AgencyFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not approved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function compareAgencies(left: Agency, right: Agency) {
  if (left.is_approved !== right.is_approved) {
    return left.is_approved ? 1 : -1;
  }

  return left.name.localeCompare(right.name);
}

function filterAgencies(rows: Agency[], filter: AgencyFilter) {
  if (filter === "pending") {
    return rows.filter((agency) => !agency.is_approved);
  }

  if (filter === "approved") {
    return rows.filter((agency) => agency.is_approved);
  }

  return rows;
}

function StatusBadge({ approved }: { approved: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
      }`}
    >
      {approved ? "Approved" : "Pending"}
    </span>
  );
}

function toFormState(agency: Agency): AgencyFormState {
  return {
    name: agency.name,
    agency_type: agency.agency_type,
    contact_person: agency.contact_person,
    email: agency.email,
    phone: agency.phone,
    mobile_phone: agency.mobile_phone,
    skype_id: agency.skype_id,
    icq: agency.icq,
  };
}

function AgencyDetailsModal({
  agency,
  mode,
  form,
  isSubmitting,
  submitError,
  approvingAgencyId,
  onClose,
  onModeChange,
  onChange,
  onSubmit,
  onApprove,
}: {
  agency: Agency;
  mode: ModalMode;
  form: AgencyFormState;
  isSubmitting: boolean;
  submitError: string;
  approvingAgencyId: number | null;
  onClose: () => void;
  onModeChange: (mode: ModalMode) => void;
  onChange: (field: keyof AgencyFormState, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onApprove: (id: number) => void;
}) {
  const fields = [
    { label: "Name", key: "name" },
    { label: "Agency Type", key: "agency_type" },
    { label: "Contact Person", key: "contact_person" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Mobile", key: "mobile_phone" },
    { label: "Skype", key: "skype_id" },
    { label: "ICQ", key: "icq" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{agency.name}</h2>
              <StatusBadge approved={agency.is_approved} />
            </div>
            <p className="mt-1 text-sm text-slate-500">Agency ID #{agency.id}</p>
            <p className="mt-1 text-sm text-slate-500">Approved at: {formatDateTime(agency.approved_at)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onModeChange("view")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === "view"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => onModeChange("edit")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === "edit"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Edit
            </button>
            {!agency.is_approved ? (
              <button
                type="button"
                onClick={() => onApprove(agency.id)}
                disabled={approvingAgencyId === agency.id}
                className="rounded-lg border border-[#0f2347] bg-[#0f2347] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approvingAgencyId === agency.id ? "Approving..." : "Approve"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-5">
          {submitError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          ) : null}

          {mode === "view" ? (
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <div key={field.key} className="rounded-xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
                  <dd className="mt-1 break-words text-sm text-slate-900">{agency[field.key] || "-"}</dd>
                </div>
              ))}
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval Status</dt>
                <dd className="mt-1 text-sm text-slate-900">{agency.is_approved ? "Approved" : "Pending"}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved At</dt>
                <dd className="mt-1 text-sm text-slate-900">{formatDateTime(agency.approved_at)}</dd>
              </div>
            </dl>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className={field.key === "email" ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </span>
                  <input
                    value={form[field.key]}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              ))}

              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onModeChange("view")}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgenciesPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<AgencyFilter>("all");
  const [toastMessage, setToastMessage] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("view");
  const [formState, setFormState] = useState<AgencyFormState | null>(null);
  const [submitError, setSubmitError] = useState("");
  const agenciesQuery = useAdminAgencies();
  const approveMutation = useApproveAgency({
    onSuccess: (_, approvedId) => {
      queryClient.setQueryData<Agency[]>(agencyKeys.adminList(), (previous) => {
        if (!previous) {
          return previous;
        }

        return previous.map((agency) =>
          agency.id === approvedId
            ? {
                ...agency,
                is_approved: true,
                approved_at: agency.approved_at ?? new Date().toISOString(),
              }
            : agency
        );
      });

      if (selectedAgencyId === approvedId) {
        closeModal();
      }

      setToastMessage("Agency approved successfully.");
    },
  });
  const updateMutation = useUpdateAgency({
    onSuccess: (agency) => {
      queryClient.setQueryData<Agency[]>(agencyKeys.adminList(), (previous) => {
        if (!previous) {
          return previous;
        }

        return previous.map((row) => (row.id === agency.id ? agency : row));
      });

      setToastMessage(`Agency "${agency.name}" updated successfully.`);
      closeModal();
      setSubmitError("");
    },
  });

  const sortedAgencies = useMemo(() => {
    const rows = agenciesQuery.data ?? [];
    return [...rows].sort(compareAgencies);
  }, [agenciesQuery.data]);

  const filteredAgencies = useMemo(
    () => filterAgencies(sortedAgencies, activeFilter),
    [activeFilter, sortedAgencies]
  );

  const pendingAgencies = useMemo(
    () => filteredAgencies.filter((agency) => !agency.is_approved),
    [filteredAgencies]
  );
  const approvedAgencies = useMemo(
    () => filteredAgencies.filter((agency) => agency.is_approved),
    [filteredAgencies]
  );
  const selectedAgency = useMemo(
    () => sortedAgencies.find((agency) => agency.id === selectedAgencyId) ?? null,
    [selectedAgencyId, sortedAgencies]
  );

  const approvingAgencyId = approveMutation.isPending ? (approveMutation.variables ?? null) : null;

  const openAgency = (agency: Agency, mode: ModalMode = "view") => {
    setSelectedAgencyId(agency.id);
    setModalMode(mode);
    setFormState(toFormState(agency));
    setSubmitError("");
  };

  const closeModal = () => {
    setSelectedAgencyId(null);
    setModalMode("view");
    setFormState(null);
    setSubmitError("");
  };

  const handleApprove = (id: number) => {
    setToastMessage("");
    setSubmitError("");
    void approveMutation.mutateAsync(id);
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Agencies</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review new agency registration requests, approve pending agencies, and monitor approved partners.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => {
              const active = filter.value === activeFilter;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending Requests</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">{pendingAgencies.length}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved Agencies</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{approvedAgencies.length}</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visible In Filter</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{filteredAgencies.length}</p>
          </div>
        </div>
      </header>

      {toastMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {agenciesQuery.error instanceof Error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {agenciesQuery.error.message}
        </div>
      ) : null}

      {approveMutation.error instanceof Error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {approveMutation.error.message}
        </div>
      ) : null}

      {agenciesQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Loading agencies...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Agency Review Queue</h2>
              <span className="ml-auto text-xs text-slate-500">Pending items are shown first by default.</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Name</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Type</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Contact</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Email</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Approved At</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      No agencies match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredAgencies.map((agency, index) => (
                    <tr
                      key={agency.id}
                      className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-slate-50`}
                    >
                      <td className="border-b border-slate-100 px-4 py-2.5 font-medium text-slate-900">{agency.name}</td>
                      <td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">{agency.agency_type || "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">{agency.contact_person || "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">{agency.email || "-"}</td>
                      <td className="border-b border-slate-100 px-4 py-3"><StatusBadge approved={agency.is_approved} /></td>
                      <td className="border-b border-slate-100 px-4 py-2.5 text-slate-700">{formatDateTime(agency.approved_at)}</td>
                      <td className="border-b border-slate-100 px-4 py-2.5">
                        <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openAgency(agency, "view")}
                            className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openAgency(agency, "edit")}
                            className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          {!agency.is_approved ? (
                            <button
                              type="button"
                              onClick={() => handleApprove(agency.id)}
                              disabled={approvingAgencyId === agency.id}
                              className="inline-flex rounded-md border border-[#0f2347] bg-[#0f2347] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {approvingAgencyId === agency.id ? "Approving..." : "Approve"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedAgency && formState ? (
        <AgencyDetailsModal
          agency={selectedAgency}
          mode={modalMode}
          form={formState}
          isSubmitting={updateMutation.isPending}
          submitError={submitError || (updateMutation.error instanceof Error ? updateMutation.error.message : "")}
          approvingAgencyId={approvingAgencyId}
          onClose={closeModal}
          onModeChange={(mode) => {
            setModalMode(mode);
            setSubmitError("");
            setFormState(toFormState(selectedAgency));
          }}
          onChange={(field, value) => {
            setFormState((previous) => (previous ? { ...previous, [field]: value } : previous));
          }}
          onSubmit={(event) => {
            event.preventDefault();

            if (!selectedAgency || !formState) {
              return;
            }

            setToastMessage("");
            setSubmitError("");
            void updateMutation.mutateAsync({
              id: selectedAgency.id,
              payload: {
                name: formState.name.trim(),
                agency_type: formState.agency_type.trim(),
                contact_person: formState.contact_person.trim(),
                email: formState.email.trim(),
                phone: formState.phone.trim(),
                mobile_phone: formState.mobile_phone.trim(),
                skype_id: formState.skype_id.trim(),
                icq: formState.icq.trim(),
              },
            });
          }}
          onApprove={(id) => {
            handleApprove(id);
          }}
        />
      ) : null}
    </section>
  );
}
