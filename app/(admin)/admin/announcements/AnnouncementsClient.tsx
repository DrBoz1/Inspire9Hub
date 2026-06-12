"use client";

import { useState, useTransition, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Megaphone,
  CalendarDays,
  Wrench,
  AlertTriangle,
  Clock,
  Bell,
  Plus,
  Archive,
  RotateCcw,
  Loader2,
  Trash2,
} from "lucide-react";
import { ANNOUNCEMENT_TYPES, getAnnouncementType } from "@/lib/announcement-types";
import {
  createAnnouncement,
  archiveAnnouncement,
  restoreAnnouncement,
  deleteAnnouncement,
} from "./actions";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const TYPE_ICONS: Record<string, React.ElementType> = {
  general: Megaphone,
  event: CalendarDays,
  maintenance: Wrench,
  alert: AlertTriangle,
  hours: Clock,
  reminder: Bell,
};

function TypeIcon({ typeKey, className }: { typeKey: string; className?: string }) {
  const Icon = TYPE_ICONS[typeKey] ?? Megaphone;
  return <Icon className={className} />;
}

// ── Create Announcement Dialog ───────────────────────────────────────────────

function CreateAnnouncementDialog() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("general");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("type", selectedType);

    startTransition(async () => {
      try {
        await createAnnouncement(formData);
        toast.success("Announcement posted", {
          description: "Members will see it on their dashboard immediately.",
        });
        setOpen(false);
        setSelectedType("general");
        formRef.current?.reset();
      } catch (err: any) {
        toast.error("Failed to post", { description: err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-6 h-12 font-black shadow-lg transition-all active:scale-95 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Post Announcement
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl rounded-[32px] border-none shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-10 py-8">
          <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-5">
            <Megaphone className="w-6 h-6" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white tracking-tight">
              New Announcement
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm font-medium mt-1">
              This will appear on every active member&apos;s dashboard immediately.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-10 space-y-6">
          {/* Type selector — fixed labels, card-style */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Category
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {ANNOUNCEMENT_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t.key] ?? Megaphone;
                const selected = selectedType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedType(t.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-wider leading-tight">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              Title
            </Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={80}
              placeholder="e.g. Lift maintenance this Friday"
              className="h-12 rounded-xl border-slate-200 bg-white focus-visible:ring-slate-900"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label
              htmlFor="message"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              Message
            </Label>
            <Textarea
              id="message"
              name="message"
              required
              maxLength={400}
              rows={3}
              placeholder="Provide details for members..."
              className="rounded-xl border-slate-200 bg-white resize-none focus-visible:ring-slate-900"
            />
          </div>

          {/* Optional expiry */}
          <div className="space-y-2">
            <Label
              htmlFor="expires_at"
              className="text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              Expires (optional)
            </Label>
            <Input
              id="expires_at"
              name="expires_at"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              className="h-12 rounded-xl border-slate-200 bg-white focus-visible:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Leave blank to keep it active until you manually archive it.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-[#E31E24] hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-wider"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Post Now"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Client ──────────────────────────────────────────────────────────────

export default function AnnouncementsClient({
  announcements,
}: {
  announcements: any[];
}) {
  const [isPending, startTransition] = useTransition();

  const handleArchive = (id: string, title: string) => {
    startTransition(async () => {
      try {
        await archiveAnnouncement(id);
        toast.success("Archived", { description: `"${title}" is now hidden from members.` });
      } catch (err: any) {
        toast.error("Failed", { description: err.message });
      }
    });
  };

  const handleRestore = (id: string, title: string) => {
    startTransition(async () => {
      try {
        await restoreAnnouncement(id);
        toast.success("Restored", { description: `"${title}" is now visible to members.` });
      } catch (err: any) {
        toast.error("Failed", { description: err.message });
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    startTransition(async () => {
      try {
        await deleteAnnouncement(id);
        toast.success("Deleted", { description: `"${title}" has been permanently removed.` });
      } catch (err: any) {
        toast.error("Failed", { description: err.message });
      }
    });
  };

  const active = announcements.filter((a) => a.status === "active");
  const archived = announcements.filter((a) => a.status === "archived");

  return (
    <div className="space-y-10">
      {/* Active */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Live Now
            </p>
            <p className="text-slate-700 font-bold text-sm mt-0.5">
              {active.length} active announcement{active.length !== 1 ? "s" : ""} visible to members
            </p>
          </div>
          <CreateAnnouncementDialog />
        </div>

        {active.length === 0 ? (
          <Card className="rounded-[28px] border-slate-100 shadow-sm">
            <CardContent className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-slate-300" />
              </div>
              <p className="font-black text-slate-300 uppercase tracking-widest text-sm italic">
                No active announcements
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Post one and it will appear instantly on all member dashboards.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((a) => {
              const t = getAnnouncementType(a.type);
              return (
                <Card
                  key={a.id}
                  className={`rounded-[24px] border-slate-100 shadow-sm overflow-hidden border-l-4 ${t.border}`}
                >
                  <CardContent className="p-6 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${t.badge}`}>
                        <TypeIcon typeKey={a.type} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-slate-900">{a.title}</p>
                          <Badge className={`${t.badge} border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full`}>
                            {t.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                          {a.message}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
                          Posted {format(parseISO(a.created_at), "d MMM yyyy, h:mm a")}
                          {a.expires_at && (
                            <span className="ml-2">
                              · Expires {format(parseISO(a.expires_at), "d MMM yyyy")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          className="text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl shrink-0"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black uppercase">
                            Archive Announcement?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-medium text-slate-500">
                            &ldquo;{a.title}&rdquo; will be hidden from member dashboards immediately. You can restore it anytime.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6">
                          <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleArchive(a.id, a.title)}
                            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest"
                          >
                            Archive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Archived ({archived.length})
          </p>
          <div className="space-y-2">
            {archived.map((a) => {
              const t = getAnnouncementType(a.type);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TypeIcon typeKey={a.type} className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-400 text-sm truncate">{a.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {t.label} · {format(parseISO(a.created_at), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleRestore(a.id, a.title)}
                      className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl font-black text-xs uppercase tracking-wider"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
                        <AlertDialogHeader>
                          <div className="h-12 w-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                            <Trash2 className="w-6 h-6" />
                          </div>
                          <AlertDialogTitle className="text-2xl font-black uppercase">
                            Delete Permanently?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-medium text-slate-500">
                            &ldquo;{a.title}&rdquo; will be gone forever. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6">
                          <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(a.id, a.title)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
