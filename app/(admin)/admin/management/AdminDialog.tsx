"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, ShieldCheck, Info } from "lucide-react";
import { createAdmin } from "../../actions";
import { toast } from "sonner";

export function AdminDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 text-white rounded-2xl px-6 h-12 font-black shadow-lg hover:bg-slate-800 transition-all active:scale-95">
          <PlusCircle className="w-4 h-4 mr-2" /> Add New Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-10">
        <DialogHeader>
          <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Promote Staff
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">
            Assign administrative privileges to an existing resident using their
            System UUID.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            try {
              await createAdmin(formData);
              setOpen(false);
              toast.success("Admin Created", {
                description: "The staff member has been granted access.",
              });
            } catch (error: any) {
              toast.error("Promotion Failed", {
                description: error.message,
              });
            }
          }}
          className="space-y-6 mt-4"
        >
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Admin Name
            </Label>
            <Input
              name="name"
              placeholder="e.g. Staff Member Name"
              required
              className="h-12 rounded-xl border-slate-100 bg-slate-50/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Resident UUID
            </Label>
            <Input
              name="user_id"
              placeholder="Paste ID from Supabase Auth"
              required
              className="h-12 rounded-xl border-slate-100 font-mono text-[10px] bg-slate-50/50"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#E31E24] hover:bg-red-700 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 transition-all active:scale-95"
          >
            Grant Access →
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
