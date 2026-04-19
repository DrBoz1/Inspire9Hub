"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserCog, Mail } from "lucide-react";
import { AdminDialog } from "./AdminDialog";

export default function ManagementClient({
  initialStaff,
}: {
  initialStaff: any[];
}) {
  const [search, setSearch] = useState("");

  const filteredStaff = initialStaff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tight">
          Active Administrators
        </h2>
        <AdminDialog />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name or email..."
          className="pl-11 h-12 rounded-2xl border-slate-100 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Admin Name
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Access Level
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right">
                  User ID (Short)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((admin) => (
                <TableRow
                  key={admin.id}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <TableCell className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
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
                      className={`font-black text-[9px] px-3 py-1 rounded-full uppercase ${admin.role === "super_admin" ? "border-amber-200 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-500"}`}
                    >
                      {admin.role.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-8 text-right font-mono text-[10px] text-slate-300">
                    {admin.id.substring(0, 8)}...
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
