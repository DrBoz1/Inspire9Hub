import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import BookingClient from "./BookingClient";
import BookingsHero from "@/app/(dashboard)/bookings/BookingsHero";
import SupportClient from "./SupportClient";
import DashboardClient from "./DashboardClient";
import HistoryPreview from "./HistoryPreview";
import { rooms, bookings, activity } from "./data";
import "@/app/(dashboard)/member-hub.css";
import "@/app/(dashboard)/member-pages.css";
export default async function Preview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return <TooltipProvider><SidebarProvider style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}><div className="hub-shell"><AppSidebar userProfile={{ full_name: "Sam Taylor", member_status: "Active", induction_status: "Complete" }} /><SidebarInset className="hub-inset"><DashboardHeader /><main className="hub-main">{params.page === "support" ? <SupportClient firstName="Sam" /> : params.page === "history" ? <HistoryPreview searchParams={Promise.resolve(params)} /> : params.page === "dashboard" ? <DashboardClient firstName="Sam" memberStatus="Active" isInducted isSubmitted={false} isAdmin={false} nextBooking={null} announcements={[]} history={activity} /> : <div className="hub-page"><BookingsHero roomCount={rooms.length} /><BookingClient rooms={rooms} initialBookings={bookings} /></div>}</main></SidebarInset></div></SidebarProvider></TooltipProvider>;
}
