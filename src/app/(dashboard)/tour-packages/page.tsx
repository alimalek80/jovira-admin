"use client";

import { useMemo, useState } from "react";
import TourPackageForm from "@/components/tour-packages/TourPackageForm";
import {
  useAdminTourPackageDetail,
  useAdminTourPackages,
  useCreateTourPackage,
  useUpdateTourPackage,
} from "@/hooks/use-tour-packages";
import { toTourPackageFormValues, toTourPackagePayload, type TourPackageFormValues } from "@/lib/validation/tour-package";
import type { AdminTourPackage } from "@/lib/api/tour-packages";

type ModalState = {
  open: boolean;
  mode: "create" | "edit";
  editingId: number | null;
};

function statusLabel(days: number, nights: number) {
  return `${days}D / ${nights}N`;
}

export default function TourPackagesPage() {
  const packagesQuery = useAdminTourPackages();
  const createMutation = useCreateTourPackage();
  const updateMutation = useUpdateTourPackage();
  const [toastMessage, setToastMessage] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    editingId: null,
  });

  const detailQuery = useAdminTourPackageDetail(modal.mode === "edit" ? modal.editingId : null, {
    enabled: modal.open && modal.mode === "edit" && typeof modal.editingId === "number",
  });

  const rows = useMemo(() => packagesQuery.data ?? [], [packagesQuery.data]);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const formInitialValues = useMemo(
    () => (modal.mode === "edit" ? toTourPackageFormValues(detailQuery.data) : toTourPackageFormValues()),
    [detailQuery.data, modal.mode]
  );
  const minimumCostFloor = useMemo(
    () => (modal.mode === "edit" ? detailQuery.data?.minimum_cost_floor ?? "0" : "0"),
    [detailQuery.data?.minimum_cost_floor, modal.mode]
  );

  const openCreateModal = () => {
    setModal({
      open: true,
      mode: "create",
      editingId: null,
    });
  };

  const openEditModal = (item: AdminTourPackage) => {
    setModal({
      open: true,
      mode: "edit",
      editingId: item.id,
    });
  };

  const handleSubmit = async (values: TourPackageFormValues) => {
    const payload = toTourPackagePayload(values);

    // Payload is strictly backend contract; no unsupported fields are sent.
    if (modal.mode === "edit" && modal.editingId) {
      await updateMutation.mutateAsync({ id: modal.editingId, payload });
      setToastMessage("Tour package updated.");
    } else {
      await createMutation.mutateAsync(payload);
      setToastMessage("Tour package created.");
    }

    setModal((previous) => ({ ...previous, open: false }));
  };

  const tableContent = useMemo(() => {
    if (packagesQuery.isLoading) {
      return <p className="px-3 py-5 text-xs text-slate-500">Loading tour packages...</p>;
    }

    if (!rows.length) {
      return <p className="px-3 py-5 text-xs text-slate-500">No tour packages added yet.</p>;
    }

    return (
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">ID</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Name</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Destination</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Duration</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Public Price</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Agency Price</th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
              <td className="border-b border-slate-100 px-3 py-2">{row.id}</td>
              <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">{row.name}</td>
              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.destination}</td>
              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{statusLabel(row.days, row.nights)}</td>
              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.public_price}</td>
              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.agency_price}</td>
              <td className="border-b border-slate-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => openEditModal(row)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [packagesQuery.isLoading, rows]);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Tour Packages</h2>
          <p className="mt-0.5 text-xs text-slate-500">Manage backend-aligned tour package records.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Create New
        </button>
      </div>

      {toastMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {toastMessage}
        </div>
      ) : null}

      {packagesQuery.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          Unable to load tour packages.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[68vh] overflow-auto">{tableContent}</div>
      </div>

      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center">
          <div className="my-auto flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {modal.mode === "edit" ? "Edit Tour Package" : "Create Tour Package"}
              </h3>
              <button
                type="button"
                onClick={() => setModal((previous) => ({ ...previous, open: false }))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4">
              {modal.mode === "edit" && detailQuery.isLoading ? (
                <p className="text-xs text-slate-500">Loading package details...</p>
              ) : modal.mode === "edit" && detailQuery.isError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Unable to load selected package details.
                </div>
              ) : (
                <TourPackageForm
                  initialValues={formInitialValues}
                  minimumCostFloor={minimumCostFloor}
                  isSubmitting={isSubmitting}
                  onCancel={() => setModal((previous) => ({ ...previous, open: false }))}
                  onSubmit={handleSubmit}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
