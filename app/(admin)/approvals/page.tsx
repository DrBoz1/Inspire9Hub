// app/(admin)/approvals/page.tsx

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
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { approveInduction } from "../actions"; // We will create this

export default async function AdminApprovalsPage() {
  const supabase = await createClient();

  // Fetch members waiting for approval
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
        <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground italic text-sm">
          Review and approve new member inductions.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Pending Approvals</CardTitle>
              <CardDescription>
                Members who have submitted their briefing.
              </CardDescription>
            </div>
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"
            >
              {pending?.length || 0} Waiting
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="font-bold">Member</TableHead>
                <TableHead className="font-bold">Company</TableHead>
                <TableHead className="font-bold">Submitted Date</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-slate-400"
                  >
                    No pending inductions found. All clear!
                  </TableCell>
                </TableRow>
              ) : (
                pending?.map((m) => (
                  <TableRow
                    key={m.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">
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
                      {m.induction_records?.[0]?.completion_date || "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form action={approveInduction}>
                          <input type="hidden" name="memberId" value={m.id} />
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
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
