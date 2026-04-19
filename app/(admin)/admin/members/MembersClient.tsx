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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  UserCircle2,
  Mail,
  Phone,
  Building2,
  ShieldAlert,
  Zap,
} from "lucide-react";

export default function MembersClient({
  initialMembers,
}: {
  initialMembers: any[];
}) {
  const [search, setSearch] = useState("");

  const filteredMembers = initialMembers.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.company_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search members or companies..."
          className="pl-11 h-12 rounded-2xl border-slate-200 shadow-sm bg-white focus-visible:ring-[#E31E24]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Resident
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-center text-slate-400">
                  Status
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Workplace
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right text-slate-400">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                //check data  Handle Supabase array or single object
                const records = member.induction_records;
                const record = Array.isArray(records) ? records[0] : records;
                const medicalInfo = record?.health_emergency_info;

                return (
                  <TableRow
                    key={member.id}
                    className="hover:bg-slate-50/30 border-slate-50 transition-colors group"
                  >
                    <TableCell className="p-8">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-md group-hover:text-[#E31E24] transition-colors">
                          {member.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold font-poppins">
                          {member.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-8 text-center">
                      <Badge
                        className={`${member.member_status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"} border-none font-black text-[10px] px-3 py-1 rounded-full uppercase`}
                      >
                        {member.member_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-8 font-black text-slate-600 text-sm font-poppins">
                      {member.company_name}
                    </TableCell>
                    <TableCell className="p-8 text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="rounded-xl border-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                          >
                            View Profile
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
                          {/* Header Block */}
                          <div className="bg-slate-900 text-white p-10">
                            <div className="flex items-center gap-6">
                              <div className="h-20 w-20 bg-white/10 rounded-[28px] flex items-center justify-center text-white border border-white/10 shadow-inner">
                                <UserCircle2 className="w-10 h-10" />
                              </div>
                              <div className="space-y-1">
                                <DialogTitle className="text-3xl font-black tracking-tight leading-none">
                                  {member.full_name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 pt-2">
                                  <Badge className="bg-[#E31E24] text-white border-none font-black text-[9px] px-2 py-0.5 tracking-tighter uppercase">
                                    {member.induction_status}
                                  </Badge>
                                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                    Community Resident
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Info Body */}
                          <div className="p-10 space-y-10 bg-white">
                            {/* Contact & Plan Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                              <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">
                                  Contact Details
                                </p>
                                <div className="space-y-4">
                                  <InfoItem
                                    icon={Mail}
                                    label="Email"
                                    value={member.email}
                                  />
                                  <InfoItem
                                    icon={Phone}
                                    label="Mobile"
                                    value={member.mobile_number || "Not listed"}
                                  />
                                  <InfoItem
                                    icon={Building2}
                                    label="Company"
                                    value={member.company_name}
                                  />
                                </div>
                              </div>

                              <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">
                                  Membership
                                </p>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                                    <span className="text-sm font-black text-slate-900">
                                      Sync Pending
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                                    Full plan integration will be available
                                    after the Booking Phase update.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Medical Block */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-[#E31E24]" />
                                <h4 className="text-[10px] font-black uppercase text-[#E31E24] tracking-widest">
                                  Safety & Medical Briefing
                                </h4>
                              </div>
                              <div className="bg-red-50/50 p-8 rounded-[32px] border border-red-100/50">
                                <p className="text-xs text-red-900 leading-relaxed italic font-bold">
                                  {medicalInfo
                                    ? `"${medicalInfo}"`
                                    : "Warning: No emergency information found. Ensure user has completed induction."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
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

function InfoItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#E31E24] transition-colors">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </span>
        <span className="text-sm font-bold text-slate-700">{value}</span>
      </div>
    </div>
  );
}
