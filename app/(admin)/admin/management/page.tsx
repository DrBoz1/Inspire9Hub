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
import { AdminDialog } from "./AdminDialog";
import { ShieldCheck, UserCog } from "lucide-react";

export default async function ManagementPage() {
  const supabase = await createClient();

  //fetch all the admins from database
  const { data: staff } = await supabase
    .from("admins")
    .select("*")
    .order("role", { ascending: false });

  return (
    <div className="space-y-8 font-poppins">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Staff Management
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Manage platform administrators and permissions.
          </p>
        </div>
        <AdminDialog />
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Admin Member
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Access Level
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Status
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right">
                  System ID
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff?.map((admin) => (
                <TableRow
                  key={admin.id}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <TableCell className="p-8">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-3 rounded-2xl ${admin.role === "super_admin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}
                      >
                        <UserCog className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900">
                          {admin.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          {admin.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-8">
                    <Badge
                      variant="outline"
                      className={`font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-tighter ${admin.role === "super_admin" ? "border-amber-200 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-500"}`}
                    >
                      {admin.role.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-8">
                    <div className="flex items-center gap-2 font-bold text-emerald-500 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {admin.active_status}
                    </div>
                  </TableCell>
                  <TableCell className="p-8 text-right font-mono text-[10px] text-slate-300">
                    {admin.id.substring(0, 18)}...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
