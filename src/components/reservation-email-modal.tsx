"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendReservationEmail } from "@/lib/api/email-config";

interface ReservationEmailModalProps {
  reservationNo: string;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onClose: () => void;
}

export default function ReservationEmailModal({
  reservationNo,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  onClose,
}: ReservationEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
            <textarea
              required
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#0f2347]"
            />
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
              disabled={sendMutation.isPending}
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