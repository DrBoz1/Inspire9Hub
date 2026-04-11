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
import { CheckCircle2, XCircle } from "lucide-react";
import { approveInduction, rejectInduction } from "../../actions";

export default async function AdminApprovalsPage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("members")
    .select(
      `
      id, 
      full_name, 
      email, 
      company_name,
      induction_records (health_emergency_info, completion_date)
    `,
    )
    .eq("induction_status", "Submitted");

  return (
    <div className="space-y-6 font-poppins">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Compliance
        </h1>
        <p className="text-muted-foreground italic text-sm mt-1">
          Review and approve new member safety briefings.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-bold">
                Pending Approvals
              </CardTitle>
              <CardDescription>
                Awaiting admin verification for site access.
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-4 py-1"
            >
              {pending?.length || 0} Waiting
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                  Member
                </TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                  Company
                </TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                  Submitted
                </TableHead>
                <TableHead className="text-right font-bold text-slate-400 uppercase text-[10px] tracking-widest">
                  Decision
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!pending || pending.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-40 text-center text-slate-400 font-medium italic"
                  >
                    All clear! No pending inductions to review.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((m) => (
                  <TableRow
                    key={m.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 group-hover:text-[#E31E24] transition-colors">
                          {m.full_name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {m.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {m.company_name}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {m.induction_records?.[0]?.completion_date || "Today"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3">
                        <form action={rejectInduction}>
                          <input type="hidden" name="memberId" value={m.id} />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-9 w-9 p-0"
                            title="Reject Submission"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                        </form>

                        <form action={approveInduction}>
                          <input type="hidden" name="memberId" value={m.id} />
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-4 h-9 font-bold shadow-sm"
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
