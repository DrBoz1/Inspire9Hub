import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Fetch members whose status is 'Submitted'
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

  if (error) {
    console.error("Fetch Error:", error.message);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          Compliance Queue
        </h1>
        <p className="text-slate-500 font-medium italic mt-2">
          Verify member submissions to grant building access.
        </p>
      </div>

      <Card className="rounded-[32px] shadow-sm border-slate-100 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold">Pending Reviews</CardTitle>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-4 py-1.5 font-black text-xs uppercase tracking-widest">
              {pending?.length || 0} Awaiting Action
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                  Resident Info
                </TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                  Workplace
                </TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                  Emergency & Medical
                </TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] tracking-[0.2em] p-8 text-slate-400">
                  Decision
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!pending || pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-slate-300 font-bold italic">
                        No pending inductions found.
                      </p>
                      <p className="text-slate-300 text-xs">
                        Verify your database records show induction_status =
                        'Submitted'
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((m) => (
                  <TableRow
                    key={m.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="p-8">
                      <div className="space-y-1">
                        <p className="font-black text-slate-900 text-lg">
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
                      <div className="flex items-center gap-2 font-bold text-slate-600">
                        <Building2 className="w-4 h-4" /> {m.company_name}
                      </div>
                    </TableCell>
                    <TableCell className="p-8 max-w-xs">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-500 leading-relaxed italic">
                          "
                          {m.induction_records?.[0]?.health_emergency_info ||
                            "No health info provided"}
                          "
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
