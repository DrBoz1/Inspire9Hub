"use client";

import { useState, useTransition } from "react";
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
import { Search, UserCog, Mail, Trash2, AlertTriangle } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { Button } from "@/components/ui/button";
import { revokeAdminAccess } from "../../actions";
import { toast } from "sonner"; // Import from sonner
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ManagementClient({
  initialStaff,
}: {
  initialStaff: any[];
}) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredStaff = initialStaff.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRevoke = async (adminId: string, adminName: string) => {
    startTransition(async () => {
      const result = await revokeAdminAccess(adminId);
      if (result.success) {
        toast.success("Access Revoked", {
          description: `${adminName} has been removed from the system.`,
        });
      } else {
        toast.error("Operation Failed", {
          description: result.message,
        });
      }
    });
  };

  return (
    <div className="space-y-8 font-poppins">
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
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Status
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((admin) => (
                <TableRow
                  key={admin.id}
                  className="hover:bg-slate-50/30 transition-colors group"
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
                      className={`font-black text-[9px] px-3 py-1 rounded-full uppercase ${admin.role === "super_admin" ? "border-amber-200 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-500"}`}
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
                  <TableCell className="p-8 text-right">
                    {admin.role !== "super_admin" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
                          <AlertDialogHeader>
                            <div className="h-12 w-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-black uppercase">
                              Security Warning
                            </AlertDialogTitle>
                            <AlertDialogDescription className="font-medium text-slate-500">
                              Are you sure you want to revoke access for{" "}
                              <span className="text-slate-900 font-bold">
                                {admin.full_name}
                              </span>
                              ? This action cannot be undone from this
                              dashboard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6">
                            <AlertDialogCancel className="rounded-xl font-bold">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRevoke(admin.id, admin.full_name)
                              }
                              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest"
                            >
                              Confirm Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest mr-4">
                        System Owner
                      </span>
                    )}
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
