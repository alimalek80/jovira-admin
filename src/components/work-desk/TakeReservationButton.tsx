"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";

type TakeReservationButtonProps = {
  reservationId: number;
};

export default function TakeReservationButton({ reservationId }: TakeReservationButtonProps) {
  const router = useRouter();
  const [isTaking, setIsTaking] = useState(false);
  const [error, setError] = useState("");

  async function handleTake() {
    setIsTaking(true);
    setError("");

    try {
      await axiosInstance.post(RESERVATIONS_ENDPOINTS.adminReservationTake(reservationId));
      router.refresh();
    } catch {
      setError("Already assigned to another user.");
    } finally {
      setIsTaking(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleTake}
        disabled={isTaking}
        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isTaking ? "Taking..." : "Take"}
      </button>
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </div>
  );
}