"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sendReservationEmail } from "@/lib/api/email-config";
import { listHotelBookings } from "@/lib/api/reservation-services";
import { listTourists } from "@/lib/api/tourists";

interface ReservationEmailModalProps {
  reservationId: number;
  reservationNo: string;
  currency: string;
  onClose: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB").replace(/\//g, ".");
}

function formatBirthDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return `(${formatDate(dateStr)})`;
}

function titlePrefix(sex: string, ageType: string): string {
  if (ageType === "CHILD") return "Child";
  if (ageType === "INFANT") return "Infant";
  return sex === "FEMALE" ? "Mrs." : "Mr.";
}

export default function ReservationEmailModal({
  reservationId,
  reservationNo,
  currency,
  onClose,
}: ReservationEmailModalProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Reservation request ${reservationNo}`);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hotelsQuery = useQuery({
    queryKey: ["email-modal-hotels", reservationId],
    queryFn: () => listHotelBookings("admin", reservationId),
    staleTime: 0,
  });

  const touristsQuery = useQuery({
    queryKey: ["email-modal-tourists", reservationId],
    queryFn: () => listTourists("admin", { reservationId }),
    staleTime: 0,
  });

  const generatedBody = useMemo(() => {
    const hotels = hotelsQuery.data ?? [];
    const tourists = touristsQuery.data ?? [];

    if (hotels.length === 0 && tourists.length === 0) {
      return `Dear Sir/Madam,\n\nWould you please reserve:\n\n\n\nKindly acknowledge.\n\nBest regards,`;
    }

    const lines: string[] = ["Dear Sir/Madam,", "", "Would you please reserve:", ""];

    for (const hotel of hotels) {
      const nights =
        hotel.checkInDate && hotel.checkOutDate
          ? Math.round(
              (new Date(hotel.checkOutDate).getTime() -
                new Date(hotel.checkInDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

      lines.push(
        `${hotel.quantity > 1 ? hotel.quantity + " x " : ""}${hotel.roomLabel} for the guests of our company${nights ? ` for ${nights} night${nights !== 1 ? "s" : ""} stay` : ""}`
      );
      lines.push("");

      if (hotel.checkInDate || hotel.checkOutDate) {
        lines.push(
          `Check in: ${formatDate(hotel.checkInDate)}    Check out: ${formatDate(hotel.checkOutDate)}`
        );
        lines.push("");
      }

      // List tourists assigned to this booking
      const assignedTourists =
        hotel.tourists.length > 0
          ? tourists.filter((t) => hotel.tourists.includes(t.id))
          : tourists;

      assignedTourists.forEach((t, i) => {
        const birth = t.age_type !== "ADULT" ? ` ${formatBirthDate(t.birth_date)}` : "";
        lines.push(
          `${i + 1}. ${titlePrefix(t.sex, t.age_type)} ${t.first_name} ${t.last_name}${birth}`
        );
      });

      lines.push("");

      const total =
        hotel.price
          ? `Total Stay Amount: ${hotel.price} ${currency} NET Kindly acknowledge.`
          : null;

      if (total) {
        lines.push(total);
      }

      lines.push("--------------------------------------------------");
      lines.push("");
    }

    lines.push("Best regards,");

    return lines.join("\n");
  }, [hotelsQuery.data, touristsQuery.data, currency]);

  const body = bodyOverride ?? generatedBody;
  const isLoading = hotelsQuery.isLoading || touristsQuery.isLoading;

  const sendMutation = useMutation({
    mutationFn: sendReservationEmail,
    onSuccess: (data) => {
      setSuccessMessage(data.detail);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    sendMutation.mutate({ to, cc: cc || undefined, subject, body });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Compose Email</h2>
            <p className="text-xs text-slate-500 mt-0.5">Reservation {reservationNo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          {/* To */}
          <div className="flex items-center gap-3">
            <label className="w-14 shrink-0 text-right text-xs font-medium text-slate-500">To</label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@hotel.com"
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-3">
            <label className="w-14 shrink-0 text-right text-xs font-medium text-slate-500">CC</label>
            <input
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="optional"
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="w-14 shrink-0 text-right text-xs font-medium text-slate-500">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            />
          </div>

          {/* Body */}
          <div className="flex gap-3">
            <label className="w-14 shrink-0 pt-1.5 text-right text-xs font-medium text-slate-500">Body</label>
            <div className="flex-1">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs text-slate-400">
                  Loading booking details...
                </div>
              ) : (
                <textarea
                  required
                  rows={14}
                  value={body}
                  onChange={(e) => setBodyOverride(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
                />
              )}
            </div>
          </div>

          {/* Error */}
          {sendMutation.isError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {(sendMutation.error as { response?: { data?: { detail?: string } } })
                ?.response?.data?.detail ?? "Failed to send email."}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {successMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={sendMutation.isPending || isLoading}
              className="inline-flex items-center gap-1.5 rounded bg-[#0f2347] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1a3560] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {sendMutation.isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
