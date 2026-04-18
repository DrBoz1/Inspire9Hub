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
import { CheckCircle2, XCircle, Mail, Phone, Building2 } from "lucide-react";
import { rejectInduction, approveInduction } from "../../actions";
import { INDUCTION_STATUS } from "@/lib/constants";

export default async function AdminApprovalsPage() {
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("members")
    .select(
      `
      id, 
      full_name, 
      email, 
      company_name,
      mobile_number,
      induction_status,
      induction_records!inner (
        health_emergency_info, 
        completion_date,
        approval_status
      )
    `,
    )
    .eq("induction_status", INDUCTION_STATUS.SUBMITTED);

  if (error) console.error("Fetch Error:", error.message);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
          Compliance Queue
        </h1>
        <p className="text-slate-500 font-medium italic mt-2">
          Verify member submissions to grant building access.
        </p>
      </div>

      <Card className="rounded-[32px] shadow-sm border-slate-100 overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold font-poppins text-slate-800 uppercase">
                New Submissions
              </CardTitle>
              <CardDescription>
                Members awaiting safety verification.
              </CardDescription>
            </div>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-4 py-1.5 font-black text-xs uppercase tracking-widest">
              {pending?.length || 0} Awaiting
            </Badge>
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
                  // LOGIC FIX: Handle if induction_records is an array or a single object
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
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold font-poppins">
                            <Mail className="w-3 h-3" /> {m.email}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold font-poppins">
                            <Phone className="w-3 h-3" /> {m.mobile_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="p-8">
                        <div className="flex items-center gap-2 font-bold text-slate-600 font-poppins text-sm">
                          <Building2 className="w-4 h-4" /> {m.company_name}
                        </div>
                      </TableCell>
                      <TableCell className="p-8">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-w-xs">
                          <p className="text-xs text-slate-600 leading-relaxed italic font-medium">
                            {/* IF STATEMENT FIX: If RLS is working, this will show the data */}
                            {medicalInfo
                              ? `"${medicalInfo}"`
                              : "Access Denied: Check Database Permissions"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="p-8 text-right">
                        <div className="flex justify-end gap-3">
                          <form action={rejectInduction}>
                            <input type="hidden" name="memberId" value={m.id} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all h-12 w-12"
                            >
                              <XCircle className="w-6 h-6" />
                            </Button>
                          </form>
                          <form action={approveInduction}>
                            <input type="hidden" name="memberId" value={m.id} />
                            <Button
                              size="sm"
                              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-8 h-12 font-black shadow-md shadow-emerald-100 transition-all active:scale-95"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
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
    </div>
  );
}
