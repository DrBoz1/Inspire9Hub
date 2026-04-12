import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { INDUCTION_STATUS } from "@/lib/constants";

export default async function ApprovalHistoryPage() {
  const supabase = await createClient();

  // Fetch members who are already Complete
  const { data: approvedMembers } = await supabase
    .from("members")
    .select(
      `
      id, 
      full_name, 
      email, 
      company_name,
      induction_status,
      induction_records (completion_date)
    `,
    )
    .eq("induction_status", INDUCTION_STATUS.COMPLETE)
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Approval History
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          A log of all members who have successfully completed their induction.
        </p>
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest p-6">
                  Member
                </TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest p-6">
                  Company
                </TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest p-6">
                  Approved On
                </TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest p-6">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedMembers?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-40 text-center text-slate-400 italic"
                  >
                    No approved records found yet.
                  </TableCell>
                </TableRow>
              ) : (
                approvedMembers?.map((m) => (
                  <TableRow
                    key={m.id}
                    className="hover:bg-slate-50/30 transition-colors"
                  >
                    <TableCell className="p-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">
                          {m.full_name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {m.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-6 text-slate-600 font-semibold">
                      {m.company_name}
                    </TableCell>
                    <TableCell className="p-6 text-slate-500 text-sm">
                      {m.induction_records?.[0]?.completion_date || "N/A"}
                    </TableCell>
                    <TableCell className="p-6">
                      <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold px-3">
                        Verified
                      </Badge>
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
