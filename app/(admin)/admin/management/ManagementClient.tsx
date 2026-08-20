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
import { Search, UserCog, Trash2, AlertTriangle, UserX } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { Button } from "@/components/ui/button";
import { revokeAdminAccess, purgeOrphanedAdmins } from "../../actions";
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

type Staff = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  active_status: string | null;
  /** false once the matching Supabase Auth login has been deleted */
  hasAuthUser: boolean;
};

export default function ManagementClient({
  initialStaff,
  currentAdminId,
}: {
  initialStaff: Staff[];
  currentAdminId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Rows whose login was deleted in Supabase Auth aren't staff any more — they
  // can't sign in. Keep them out of the roster and offer a one-click cleanup.
  const active = initialStaff.filter((s) => s.hasAuthUser);
  const orphaned = initialStaff.filter((s) => !s.hasAuthUser);

  const term = search.toLowerCase();
  const filteredStaff = active.filter(
    (s) =>
      (s.full_name ?? "").toLowerCase().includes(term) ||
      (s.email ?? "").toLowerCase().includes(term),
  );

  const handleRevoke = (adminId: string, adminName: string) => {
    startTransition(async () => {
      const result = await revokeAdminAccess(adminId);
      if (result.success) {
        toast.success("Access Revoked", {
          description: `${adminName} has been removed from the system.`,
        });
      } else {
        toast.error("Operation Failed", { description: result.message });
      }
    });
  };

  const handlePurge = () => {
    startTransition(async () => {
      const result = await purgeOrphanedAdmins(orphaned.map((s) => s.id));
      if (result.success) {
        toast.success("Records Cleaned Up", {
          description: `Removed ${result.removed} stale admin record${result.removed === 1 ? "" : "s"}.`,
        });
      } else {
        toast.error("Cleanup Failed", { description: result.message });
      }
    });
  };

  return (
    <div className="space-y-8 font-poppins">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
          Active Administrators
        </h2>
        <AdminDialog />
      </div>

      {/* Stale rows left behind by a deletion in the Supabase Auth dashboard */}
      {orphaned.length > 0 && (
        <div className="rounded-[28px] border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <UserX className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm text-amber-900 dark:text-amber-200 uppercase tracking-tight">
                {orphaned.length} stale record{orphaned.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400/80 mt-1">
                These admin rows point at login accounts that no longer exist in
                Supabase Auth. They can&apos;t sign in, so they&apos;re hidden
                from the roster below.
              </p>
              <ul className="mt-3 space-y-1">
                {orphaned.map((s) => (
                  <li
                    key={s.id}
                    className="text-[11px] font-bold text-amber-800 dark:text-amber-300"
                  >
                    {s.full_name ?? "Unnamed"}
                    <span className="font-medium text-amber-600 dark:text-amber-500">
                      {" "}
                      · {s.email ?? "no email"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              onClick={handlePurge}
              disabled={isPending}
              variant="outline"
              className="shrink-0 rounded-xl font-black text-[10px] uppercase tracking-widest border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              Clean Up
            </Button>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name or email..."
          className="pl-11 h-12 rounded-2xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-[32px] border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/40">
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
              {filteredStaff.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="p-12 text-center text-sm font-bold text-slate-400 dark:text-slate-500"
                  >
                    {search
                      ? "No administrators match that search."
                      : "No administrators yet."}
                  </TableCell>
                </TableRow>
              )}

              {filteredStaff.map((admin) => {
                const isSelf = admin.id === currentAdminId;
                return (
                  <TableRow
                    key={admin.id}
                    className="hover:bg-slate-50/30 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <TableCell className="p-8">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-2xl ${admin.role === "super_admin" ? "bg-slate-900 dark:bg-slate-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                        >
                          <UserCog className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 dark:text-white">
                            {admin.full_name ?? "Unnamed"}
                            {isSelf && (
                              <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                            {admin.email ?? "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-8">
                      <Badge
                        variant="outline"
                        className={`font-black text-[9px] px-3 py-1 rounded-full uppercase ${admin.role === "super_admin" ? "border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"}`}
                      >
                        {admin.role?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-8">
                      <div className="flex items-center gap-2 font-bold text-emerald-500 text-xs">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {admin.active_status ?? "Active"}
                      </div>
                    </TableCell>
                    <TableCell className="p-8 text-right">
                      {isSelf ? (
                        <span className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-600 tracking-widest mr-4">
                          System Owner
                        </span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              className="text-slate-300 dark:text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Revoke
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
                            <AlertDialogHeader>
                              <div className="h-12 w-12 bg-red-50 dark:bg-red-950/40 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                              <AlertDialogTitle className="text-2xl font-black uppercase">
                                Security Warning
                              </AlertDialogTitle>
                              <AlertDialogDescription className="font-medium text-slate-500 dark:text-slate-400">
                                Are you sure you want to revoke access for{" "}
                                <span className="text-slate-900 dark:text-white font-bold">
                                  {admin.full_name ?? "this admin"}
                                </span>
                                ?{" "}
                                {admin.role === "super_admin" &&
                                  "They are a super admin. "}
                                This removes their admin privileges — their
                                member account stays intact.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6">
                              <AlertDialogCancel className="rounded-xl font-bold">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRevoke(
                                    admin.id,
                                    admin.full_name ?? "That admin",
                                  )
                                }
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest"
                              >
                                Confirm Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
