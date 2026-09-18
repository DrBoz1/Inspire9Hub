import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { bookingsCsv, csvFilename } from "@/lib/admin-insights";
import { loadInsights } from "../insights-data";

export const dynamic = "force-dynamic";

/**
 * The bookings behind the report, as a spreadsheet. The admin proxy already
 * covers /admin, but this reads member names and money with the service-role
 * client, so it checks the caller itself as well.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const data = await loadInsights({ range: params.get("range") ?? undefined, room: params.get("room") ?? undefined });

  return new NextResponse(bookingsCsv(data.bookings, data.range, data.rooms), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(data.range, data.room?.name)}"`,
      // Member names and payments: never kept by a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
