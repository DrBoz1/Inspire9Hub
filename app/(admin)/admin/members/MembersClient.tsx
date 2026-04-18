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
  Sparkles,
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
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Member
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400 text-center">
                  Status
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-slate-400">
                  Workplace
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] p-8 text-right text-slate-400">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const record = member.induction_records?.[0];
                return (
                  <TableRow
                    key={member.id}
                    className="hover:bg-slate-50/30 transition-colors group"
                  >
                    <TableCell className="p-8">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-md group-hover:text-[#E31E24] transition-colors">
                          {member.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
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
                    <TableCell className="p-8 font-black text-slate-600 text-sm">
                      {member.company_name}
                    </TableCell>
                    <TableCell className="p-8 text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-[#E31E24] hover:bg-red-50 rounded-xl"
                          >
                            Expand Profile
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
                          <DialogHeader className="bg-slate-900 text-white p-10">
                            <div className="flex items-center gap-6">
                              <div className="h-16 w-16 bg-white/10 rounded-[22px] flex items-center justify-center text-white backdrop-blur-md">
                                <UserCircle2 className="w-10 h-10" />
                              </div>
                              <div>
                                <DialogTitle className="text-3xl font-black tracking-tight">
                                  {member.full_name}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className="bg-[#E31E24] text-white border-none font-black text-[9px] px-2 py-0.5 uppercase tracking-widest">
                                    {member.induction_status}
                                  </Badge>
                                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none">
                                    Verified Community Member
                                  </p>
                                </div>
                              </div>
                            </div>
                          </DialogHeader>

                          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 bg-white">
                            <div className="space-y-6">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                Contact Details
                              </h4>
                              <div className="space-y-4">
                                <InfoItem
                                  icon={Mail}
                                  label="Email Address"
                                  value={member.email}
                                />
                                <InfoItem
                                  icon={Phone}
                                  label="Direct Mobile"
                                  value={member.mobile_number}
                                />
                                <InfoItem
                                  icon={Building2}
                                  label="Registered Company"
                                  value={member.company_name}
                                />
                              </div>
                            </div>

                            <div className="space-y-6">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                Membership Plan
                              </h4>
                              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                                <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 leading-none">
                                    Status: {member.member_status}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter italic">
                                    Plan details sync pending...
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="col-span-full space-y-4 pt-6 border-t border-slate-50">
                              <h4 className="text-[10px] font-black uppercase text-[#E31E24] tracking-widest flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" /> Safety &
                                Emergency Briefing
                              </h4>
                              <div className="bg-red-50/30 p-8 rounded-[32px] border border-red-100/50">
                                <p className="text-xs text-red-900 leading-relaxed italic font-medium">
                                  "
                                  {record?.health_emergency_info ||
                                    "No medical or emergency data was provided during induction."}
                                  "
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
      <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
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
