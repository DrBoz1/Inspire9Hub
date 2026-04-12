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
import { INDUCTION_STATUS } from "@/lib/constants";
import Link from "next/link";
import { ChevronLeft, ChevronRight, UserCircle2 } from "lucide-react";

export default async function HistoryPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1");
  const pageSize = 8;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch verified members with full details
  const { data: members, count } = await supabase
    .from("members")
    .select(
      `
      id, 
      full_name, 
      email, 
      mobile_number,
      company_name,
      induction_status,
      induction_records!inner (
        health_emergency_info, 
        completion_date,
        acknowledged_terms
      )
    `,
      { count: "exact" },
    )
    .eq("induction_status", INDUCTION_STATUS.COMPLETE)
    .range(from, to)
    .order("full_name");

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Verified Residents
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            Historical audit log of all site-approved members.
          </p>
        </div>
        <Badge className="rounded-full px-5 py-2 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase">
          Total Records: {count || 0}
        </Badge>
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Resident Details
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Workplace
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-center">
                  Safety
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Emergency & Medical Brief
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right text-slate-400">
                  Verified On
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((m) => (
                <TableRow
                  key={m.id}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <TableCell className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
                        <UserCircle2 className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900">
                          {m.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold mt-0.5">
                          {m.email}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          {m.mobile_number}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-8 font-black text-slate-600 text-sm">
                    {m.company_name}
                  </TableCell>
                  <TableCell className="p-8 text-center">
                    <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-3">
                      SAFE
                    </Badge>
                  </TableCell>
                  <TableCell className="p-8">
                    <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed italic font-medium">
                      "{m.induction_records?.[0]?.health_emergency_info}"
                    </p>
                  </TableCell>
                  <TableCell className="p-8 text-right font-black text-slate-400 text-[10px] uppercase tracking-wider">
                    {m.induction_records?.[0]?.completion_date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <Button
              asChild
              variant="outline"
              disabled={page === 1}
              className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs uppercase tracking-widest disabled:opacity-30 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Link href={`/admin/history?page=${page - 1}`}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              disabled={page === totalPages}
              className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs uppercase tracking-widest disabled:opacity-30 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Link href={`/admin/history?page=${page + 1}`}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
