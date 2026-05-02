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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  UserCircle2,
  Mail,
  Phone,
  Building2,
  ShieldAlert,
  CalendarDays,
  CreditCard,
  KeyRound,
  Loader2,
} from "lucide-react";
import { getMemberDetails } from "./actions";
import { format, parseISO } from "date-fns";

function statusBadge(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "paid" || s === "active")
    return "bg-emerald-50 text-emerald-700";
  if (s === "pending") return "bg-amber-50 text-amber-700";
  if (s === "cancelled" || s === "revoked") return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-600";
}

function InfoItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
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

function MemberProfileDialog({ member }: { member: any }) {
  const [details, setDetails] = useState<{
    bookings: any[];
    payments: any[];
    passes: any[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const records = member.induction_records;
  const record = Array.isArray(records) ? records[0] : records;
  const medicalInfo = record?.health_emergency_info;

  const handleOpen = (open: boolean) => {
    if (open && !details) {
      startTransition(async () => {
        const data = await getMemberDetails(member.id);
        setDetails(data);
      });
    }
  };

  return (
    <Dialog onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl border-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
        >
          View Profile
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl rounded-[40px] p-0 overflow-hidden border-none shadow-2xl">
        {/* Header */}
        <div className="bg-slate-900 text-white p-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 bg-white/10 rounded-[28px] flex items-center justify-center border border-white/10">
              <UserCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <DialogHeader>
                <DialogTitle className="text-3xl font-black tracking-tight leading-none text-white">
                  {member.full_name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 pt-2">
                <Badge className="bg-[#E31E24] text-white border-none font-black text-[9px] px-2 py-0.5 tracking-tighter uppercase">
                  {member.induction_status}
                </Badge>
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  {member.member_status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed body */}
        <div className="bg-white p-6">
          <Tabs defaultValue="contact">
            <TabsList className="bg-slate-100 p-1 rounded-2xl w-full h-12 mb-6">
              {["contact", "bookings", "payments", "passes"].map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="flex-1 rounded-xl font-bold capitalize text-xs data-[state=active]:bg-white data-[state=active]:text-[#E31E24] data-[state=active]:shadow-sm"
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Contact tab */}
            <TabsContent value="contact" className="space-y-6">
              <div className="space-y-4">
                <InfoItem icon={Mail} label="Email" value={member.email} />
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
              {medicalInfo && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#E31E24]" />
                    <h4 className="text-[10px] font-black uppercase text-[#E31E24] tracking-widest">
                      Medical & Safety
                    </h4>
                  </div>
                  <div className="bg-red-50/50 p-5 rounded-[24px] border border-red-100/50">
                    <p className="text-xs text-red-900 leading-relaxed italic font-bold">
                      &ldquo;{medicalInfo}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Bookings tab */}
            <TabsContent value="bookings">
              {isPending ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : !details || details.bookings.length === 0 ? (
                <p className="text-slate-400 italic text-sm text-center py-8">
                  No bookings found.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {details.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
                          <CalendarDays className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">
                            {b.workspaces?.name ?? "Room"}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {format(
                              parseISO(b.start_date_time),
                              "d MMM yyyy, h:mm a",
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusBadge(b.booking_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {b.booking_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Payments tab */}
            <TabsContent value="payments">
              {isPending ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : !details || details.payments.length === 0 ? (
                <p className="text-slate-400 italic text-sm text-center py-8">
                  No payment history.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {details.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">
                            ${Number(p.amount).toFixed(2)} AUD
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold capitalize">
                            {p.payment_date} · {p.payment_method}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusBadge(p.payment_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {p.payment_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Passes tab */}
            <TabsContent value="passes">
              {isPending ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : !details || details.passes.length === 0 ? (
                <p className="text-slate-400 italic text-sm text-center py-8">
                  No access passes issued.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {details.passes.map((pass) => (
                    <div
                      key={pass.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shrink-0">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm capitalize">
                            {pass.pass_type?.replace("_", " ") ?? "Pass"}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold">
                            Issued {pass.issued_date} · Expires {pass.expiry_date}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusBadge(pass.pass_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {pass.pass_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MembersClient({
  initialMembers,
}: {
  initialMembers: any[];
}) {
  const [search, setSearch] = useState("");

  const filteredMembers = initialMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.company_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
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
              {filteredMembers.map((member) => (
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
                    <MemberProfileDialog member={member} />
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
