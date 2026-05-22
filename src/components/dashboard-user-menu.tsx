"use client";

import { useEffect, useRef, useState } from "react";

export default function DashboardUserMenu() {
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      document.cookie = "access=; path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "refresh=; path=/; Max-Age=0; SameSite=Lax";
      window.location.assign("/login");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white transition hover:bg-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
      >
        AU
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-start rounded-md px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
