"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/induction": "Induction",
  "/bookings": "Reserve Space",
  "/history": "History",
  "/support": "Hub Assistant",
  "/profile": "Profile",
};

// Real local time at the Hub, not the visitor's device clock — a small,
// genuinely live signal in a bar that otherwise never changes.
function useMelbourneTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-AU", {
          timeZone: "Australia/Melbourne",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  return time;
}

export function DashboardHeader() {
  const pathname = usePathname();
  const time = useMelbourneTime();
  const label = PAGE_LABELS[pathname] ?? "Inspire9 Hub";

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-4 border-b border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 transition-colors">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-[#E31E24]/40 to-transparent" />

      <SidebarTrigger className="rounded-xl text-gray-400 hover:bg-red-50 hover:text-[#E31E24] dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors" />

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-300 dark:text-slate-600 leading-none">
          Inspire9 Hub
        </p>
        <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white truncate">
          {label}
        </h2>
      </div>

      {time && (
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Melbourne · {time}
        </div>
      )}

      <ThemeToggle />
    </header>
  );
}
