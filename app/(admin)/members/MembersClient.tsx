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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  UserCircle2,
  Mail,
  Phone,
  Building2,
  Calendar,
  ShieldAlert,
} from "lucide-react";

export default function MembersClient({
  initialMembers,
}: {
  initialMembers: any[];
}) {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Filter logic based on Name or Company
  const filteredMembers = initialMembers.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.company_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name or company..."
          className="pl-11 h-12 rounded-2xl border-slate-200 shadow-sm bg-white focus-visible:ring-[#E31E24]"
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
                  Member
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Status
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8">
                  Company
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow
                  key={member.id}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <TableCell className="p-8">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900">
                        {member.full_name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {member.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-8">
                    <Badge
                      className={`${member.member_status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"} border-none font-black text-[10px] px-3 py-1 rounded-full`}
                    >
                      {member.member_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-8 font-black text-slate-600 text-sm">
                    {member.company_name}
                  </TableCell>
                  <TableCell className="p-8 text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="font-black text-[10px] uppercase tracking-widest text-[#E31E24] hover:bg-red-50"
                          onClick={() => setSelectedMember(member)}
                        >
                          View Profile
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                        <DialogHeader className="bg-slate-900 text-white p-8">
                          <div className="flex items-center gap-4">
                            <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                              <UserCircle2 className="w-8 h-8" />
                            </div>
                            <div>
                              <DialogTitle className="text-2xl font-black">
                                {member.full_name}
                              </DialogTitle>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                                {member.induction_status} Resident
                              </p>
                            </div>
                          </div>
                        </DialogHeader>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
                          {/* Contact Section */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                              Contact Information
                            </h4>
                            <div className="space-y-3">
                              <InfoItem
                                icon={Mail}
                                label="Email"
                                value={member.email}
                              />
                              <InfoItem
                                icon={Phone}
                                label="Mobile"
                                value={member.mobile_number}
                              />
                              <InfoItem
                                icon={Building2}
                                label="Company"
                                value={member.company_name}
                              />
                            </div>
                          </div>

                          {/* Membership Section */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                              Membership Plan
                            </h4>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-sm font-black text-slate-900">
                                {member.memberships?.[0]?.membership_type ||
                                  "No Active Plan"}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-2">
                                <Calendar className="w-3 h-3" /> Ends:{" "}
                                {member.memberships?.[0]?.end_date || "N/A"}
                              </div>
                            </div>
                          </div>

                          {/* Medical Section (Full Width) */}
                          <div className="col-span-full space-y-4 pt-4 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center gap-2">
                              <ShieldAlert className="w-3 h-3" /> Safety &
                              Emergency Brief
                            </h4>
                            <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                              <p className="text-xs text-red-900 leading-relaxed italic font-medium">
                                "
                                {member.induction_records?.[0]
                                  ?.health_emergency_info ||
                                  "No emergency information on file."}
                                "
                              </p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
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

function InfoItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-slate-300" />
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none">
          {label}
        </span>
        <span className="text-sm font-bold text-slate-700">{value}</span>
      </div>
    </div>
  );
}
