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
import { PlusCircle, ShieldCheck } from "lucide-react";
import { createAdmin } from "../../actions";

export function AdminDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 text-white rounded-2xl px-6 font-bold shadow-lg hover:bg-slate-800">
          <PlusCircle className="w-4 h-4 mr-2" /> Add New Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-10">
        <DialogHeader>
          <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            Create Admin
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">
            Assign administrative privileges to a user. They must already have a
            valid User ID.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await createAdmin(formData);
            setOpen(false); //close it on success
          }}
          className="space-y-6 mt-4"
        >
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Full Name
            </Label>
            <Input
              name="name"
              placeholder="e.g. John Smith"
              required
              className="h-12 rounded-xl border-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Email Address
            </Label>
            <Input
              name="email"
              type="email"
              placeholder="john@company.com"
              required
              className="h-12 rounded-xl border-slate-100"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              User UUID
            </Label>
            <Input
              name="user_id"
              placeholder="Paste Supabase UUID here"
              required
              className="h-12 rounded-xl border-slate-100 font-mono text-xs"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#E31E24] hover:bg-red-700 text-white h-12 rounded-xl font-black uppercase tracking-widest"
          >
            Confirm Promotion
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
