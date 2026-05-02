import { redirect } from "next/navigation";

// This page has been merged into /admin/approvals — keep this redirect
// so any saved links or browser history still land in the right place.
export default function HistoryRedirect() {
  redirect("/admin/approvals?view=history");
}
