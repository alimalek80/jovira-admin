"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import axiosInstance from "@/lib/axios";
import { RESERVATIONS_ENDPOINTS } from "@/lib/api-endpoints";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

type PingPongDirection = "ping" | "pong";

type PingPongButtonProps = {
  reservationId: number;
  isLockedByFinance: boolean;
  onSuccess?: () => void;
};

function resolvePingPongError(error: unknown): string {
  const responseData = (error as AxiosError)?.response?.data;

  if (typeof responseData === "string" && responseData.trim().length > 0) {
    return responseData;
  }

  if (responseData && typeof responseData === "object") {
    const detail = (responseData as Record<string, unknown>).detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }

  return "Unable to update finance status. Please try again.";
}

export default function PingPongButton({ reservationId, isLockedByFinance, onSuccess }: PingPongButtonProps) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();

  const isAdmin = Boolean(
    currentUser?.is_superuser || currentUser?.is_staff || currentUser?.role === "ADMIN"
  );
  const isReservationRole = currentUser?.role === "RESERVATION";
  const isFinanceRole = currentUser?.role === "FINANCE";

  const pingPongMutation = useMutation({
    mutationFn: async (direction: PingPongDirection) => {
      const response = await axiosInstance.post(
        RESERVATIONS_ENDPOINTS.adminReservationPingPong(reservationId),
        { direction }
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reservations", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["reservation-financial-summary", reservationId] });
      onSuccess?.();
    },
  });

  if (!isLockedByFinance) {
    if (!isReservationRole && !isAdmin) {
      return null;
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => pingPongMutation.mutate("ping")}
          disabled={pingPongMutation.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-[#0f2347] bg-[#0f2347] px-3 text-[11px] font-semibold text-white hover:bg-[#0b1b38] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pingPongMutation.isPending ? "Sending..." : "Send to Finance"}
        </button>
        {pingPongMutation.isError ? (
          <span className="text-[11px] font-medium text-red-600">
            {resolvePingPongError(pingPongMutation.error)}
          </span>
        ) : null}
      </div>
    );
  }

  if (!isFinanceRole && !isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => pingPongMutation.mutate("pong")}
        disabled={pingPongMutation.isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded border border-amber-500 bg-amber-500 px-3 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pingPongMutation.isPending ? "Returning..." : "Return to Reservation"}
      </button>
      {pingPongMutation.isError ? (
        <span className="text-[11px] font-medium text-red-600">
          {resolvePingPongError(pingPongMutation.error)}
        </span>
      ) : null}
    </div>
  );
}
