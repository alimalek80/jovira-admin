"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function WorkDeskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOnlyMe = searchParams.get("only_me") === "true";
  const initialRfNumber = searchParams.get("rf_number") ?? "";

  const [onlyMe, setOnlyMe] = useState(initialOnlyMe);
  const [rfNumber, setRfNumber] = useState(initialRfNumber);

  function buildQueryString(nextOnlyMe: boolean, nextRfNumber: string) {
    const params = new URLSearchParams();

    if (nextOnlyMe) {
      params.set("only_me", "true");
    }

    if (nextRfNumber.trim()) {
      params.set("rf_number", nextRfNumber.trim());
    }

    return params.toString();
  }

  function handleOnlyMeToggle() {
    const next = !onlyMe;
    setOnlyMe(next);

    const query = buildQueryString(next, rfNumber);
    router.replace(query ? `/work-desk?${query}` : "/work-desk", { scroll: false });
  }

  function handleRfNumberSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = buildQueryString(onlyMe, rfNumber);
    router.replace(query ? `/work-desk?${query}` : "/work-desk", { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleOnlyMeToggle}
        aria-pressed={onlyMe}
        className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold leading-tight transition ${
          onlyMe
            ? "border-[#0f2347] bg-[#0f2347] text-white"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        Only Me
      </button>

      <form onSubmit={handleRfNumberSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={rfNumber}
          onChange={(event) => setRfNumber(event.target.value)}
          placeholder="RF Number"
          className="w-48 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1.5 rounded border border-[#0f2347] bg-[#0f2347] px-3 text-[11px] font-semibold text-white hover:bg-[#0b1b38]"
        >
          Search
        </button>
      </form>
    </div>
  );
}