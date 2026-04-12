import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

export default async function HistoryPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch anyone who isn't 'Pending' or 'Submitted' (meaning Approved or Rejected)
  const { data: members, count } = await supabase
    .from("members")
    .select(
      `
      id, full_name, email, mobile_number, company_name, induction_status,
      induction_records ( health_emergency_info, completion_date )
    `,
      { count: "exact" },
    )
    .in("induction_status", ["Complete", "Rejected"])
    .range(from, to)
    .order("full_name");

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight text-uppercase">
            Audit Trail
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1 font-poppins">
            Historical log of all admin decisions.
          </p>
        </div>
        <Badge className="rounded-full px-5 py-2 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase">
          {count || 0} Total Actions
        </Badge>
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Resident
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-center">
                  Outcome
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Workplace
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Medical Brief
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right text-slate-400">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((m) => (
                <TableRow
                  key={m.id}
                  className="hover:bg-slate-50/30 transition-colors group"
                >
                  <TableCell className="p-8">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-md group-hover:text-red-600 transition-colors">
                        {m.full_name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {m.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-8 text-center">
                    {m.induction_status === "Complete" ? (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-600 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase">
                        <XCircle className="w-3 h-3 mr-1" /> Rejected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="p-8 font-black text-slate-600 text-sm">
                    {m.company_name}
                  </TableCell>
                  <TableCell className="p-8">
                    <p className="text-[11px] text-slate-500 max-w-xs italic line-clamp-2">
                      "
                      {m.induction_records?.[0]?.health_emergency_info || "N/A"}
                      "
                    </p>
                  </TableCell>
                  <TableCell className="p-8 text-right font-black text-slate-400 text-[10px] uppercase tracking-wider">
                    {m.induction_records?.[0]?.completion_date || "Today"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 mt-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs"
          >
            <Link href={`/admin/history?page=${Math.max(1, page - 1)}`}>
              Prev
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs"
          >
            <Link
              href={`/admin/history?page=${Math.min(totalPages, page + 1)}`}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
