"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";

type ConfirmReservationButtonProps = {
  reservationId: number;
};

export default function ConfirmReservationButton({ reservationId }: ConfirmReservationButtonProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setIsConfirming(true);
    setError("");

    try {
      await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminReservationConfirm(reservationId));
      router.refresh();
    } catch {
      setError("Not allowed to confirm this reservation.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isConfirming}
        className="inline-flex items-center gap-1.5 rounded border border-[#0f2347] bg-[#0f2347] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConfirming ? "Confirming..." : "Confirm"}
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </div>
  );
}