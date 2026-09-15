import type { Metadata } from "next";
import { ScheduleView } from "./ScheduleView";
import { loadSchedule } from "./bookings-data";

export const metadata: Metadata = { title: "Booking schedule | Inspire9 Hub" };

type SearchParams = Promise<{ filter?: string; page?: string; q?: string }>;

export default async function AdminBookingsPage(props: { searchParams: SearchParams }) {
  return <ScheduleView data={await loadSchedule(await props.searchParams)} />;
}
