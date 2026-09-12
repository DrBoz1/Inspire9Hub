"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHubClock } from "./use-hub-clock";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Overview", "/spaces": "Spaces", "/induction": "Induction",
  "/bookings": "Bookings", "/history": "Activity", "/support": "Help & support", "/profile": "My profile",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const now = useHubClock();
  const time = now?.toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit" });

  return <header className="hub-header">
    <SidebarTrigger className="hub-sidebar-trigger" aria-label="Toggle sidebar" />
    <div className="hub-breadcrumb"><span>Member hub</span><ChevronRight size={13} aria-hidden /><strong>{PAGE_LABELS[pathname] ?? "Inspire9"}</strong></div>
    <div className="hub-header-location"><MapPin size={13} /><span>Melbourne</span>{time && <><span className="hub-header-divider" /><time>{time}</time></>}</div>
    <ThemeToggle />
  </header>;
}
