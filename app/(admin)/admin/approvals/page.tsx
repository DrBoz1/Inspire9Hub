import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { rejectInduction, approveInduction } from "../../actions";
import { INDUCTION_STATUS } from "@/lib/constants";
import Link from "next/link";

export default async function AdminApprovalsPage(props: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const view = searchParams.view ?? "pending";
  const page = parseInt(searchParams.page || "1");
  const pageSize = 10;

  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Pending inductions and audit history are independent of each other —
  // run them in parallel instead of paying for two sequential round-trips.
  const [{ data: pending, error }, { data: entries, count }] = await Promise.all([
    supabase
      .from("members")
      .select(
        `id, full_name, email, company_name, mobile_number, induction_status,
       induction_records!inner (health_emergency_info, completion_date, approval_status)`,
      )
      .eq("induction_status", INDUCTION_STATUS.SUBMITTED),
    supabase
      .from("community_entries")
      .select(
        `id, tags, entry_date, entry_description, members (full_name, email, company_name)`,
        { count: "exact" },
      )
      .eq("entry_type", "Induction")
      .range(from, to)
      .order("entry_date", { ascending: false }),
  ]);

  if (error) console.error("Fetch Error:", error.message);

  const totalPages = Math.ceil((count || 0) / pageSize);

  const views = [
    { key: "pending", label: "Pending Approvals" },
    { key: "history", label: "Approval History" },
  ];

  return (
    <div className="space-y-8 font-poppins pb-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
            Compliance
          </h1>
          <p className="text-slate-500 font-medium italic mt-1">
            Review induction submissions and browse the decision history.
          </p>
        </div>

        {view === "pending" ? (
          <Badge className="bg-amber-100 text-amber-700 border-none px-5 py-2 font-black text-[10px] uppercase tracking-widest rounded-full">
            {pending?.length ?? 0} Awaiting
          </Badge>
        ) : (
          <Badge className="rounded-full px-5 py-2 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase">
            {count ?? 0} Total
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {views.map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/approvals?view=${key}`}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              view === key
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Pending view ─────────────────────────────────────── */}
      {view === "pending" && (
        <Card className="rounded-[32px] shadow-sm border-slate-100 overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-slate-800 uppercase">
                  New Submissions
                </CardTitle>
                <CardDescription>
                  Members awaiting safety verification.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                    Resident
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                    Workplace
                  </TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                    Emergency & Medical
                  </TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!pending || pending.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-64 text-center text-slate-300 font-bold italic"
                    >
                      No pending inductions at the moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((m: any) => {
                    const record = Array.isArray(m.induction_records)
                      ? m.induction_records[0]
                      : m.induction_records;
                    const medicalInfo = record?.health_emergency_info;

                    return (
                      <TableRow
                        key={m.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <TableCell className="p-8">
                          <div className="space-y-1">
                            <p className="font-black text-slate-900 text-lg group-hover:text-[#E31E24] transition-colors">
                              {m.full_name}
                            </p>
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                              <Mail className="w-3 h-3" /> {m.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                              <Phone className="w-3 h-3" /> {m.mobile_number}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-8">
                          <div className="flex items-center gap-2 font-bold text-slate-600 text-sm">
                            <Building2 className="w-4 h-4" /> {m.company_name}
                          </div>
                        </TableCell>
                        <TableCell className="p-8">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-xs">
                            <p className="text-xs text-slate-600 leading-relaxed italic font-medium">
                              {medicalInfo
                                ? `"${medicalInfo}"`
                                : "No emergency info provided."}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="p-8 text-right">
                          <div className="flex justify-end gap-3">
                            <form action={rejectInduction}>
                              <input
                                type="hidden"
                                name="memberId"
                                value={m.id}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all h-12 w-12"
                              >
                                <XCircle className="w-6 h-6" />
                              </Button>
                            </form>
                            <form action={approveInduction}>
                              <input
                                type="hidden"
                                name="memberId"
                                value={m.id}
                              />
                              <Button
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-8 h-12 font-black shadow-md shadow-emerald-100 transition-all active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                Approve
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── History view ─────────────────────────────────────── */}
      {view === "history" && (
        <>
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
                  {!entries || entries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-64 text-center text-slate-300 font-bold italic"
                      >
                        No decisions recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry: any) => (
                      <TableRow
                        key={entry.id}
                        className="hover:bg-slate-50/30 transition-colors group"
                      >
                        <TableCell className="p-8">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-md group-hover:text-red-600 transition-colors">
                              {entry.members?.full_name || "Deleted Member"}
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              {entry.members?.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="p-8 text-center">
                          {entry.tags === "Approved" ? (
                            <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase">
                              <CheckCircle2 className="w-3 h-3 mr-1" />{" "}
                              Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-600 border-none font-black text-[10px] px-3 py-1 rounded-full uppercase">
                              <XCircle className="w-3 h-3 mr-1" /> Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-8 font-black text-slate-600 text-sm">
                          {entry.members?.company_name}
                        </TableCell>
                        <TableCell className="p-8">
                          <p className="text-[11px] text-slate-500 max-w-xs italic line-clamp-2 leading-relaxed">
                            &ldquo;{entry.entry_description || "N/A"}&rdquo;
                          </p>
                        </TableCell>
                        <TableCell className="p-8 text-right font-black text-slate-400 text-[10px] uppercase tracking-wider">
                          {entry.entry_date}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Page {page} of {totalPages || 1}
            </p>
            <div className="flex gap-3">
              <Button
                asChild
                variant="outline"
                disabled={page <= 1}
                className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs transition-all active:scale-95"
              >
                <Link
                  href={`/admin/approvals?view=history&page=${Math.max(1, page - 1)}`}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                disabled={page >= totalPages}
                className="rounded-2xl border-slate-200 h-12 px-6 font-black text-xs transition-all active:scale-95"
              >
                <Link
                  href={`/admin/approvals?view=history&page=${Math.min(totalPages, page + 1)}`}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
