import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "../actions";
import { Lock, ArrowLeft } from "lucide-react";

type SearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage(props: {
  searchParams: SearchParams;
}) {
  const { error } = await props.searchParams;

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Left: form ────────────────────────────────── */}
      <div className="flex w-full flex-col justify-center bg-[#F3F3F3] px-8 md:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <Image
              src="/images/inspire9Logo.png"
              alt="Inspire9 Logo"
              width={180}
              height={60}
              className="object-contain"
            />
          </div>

          <div className="mb-8">
            <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-5">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Set new password
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Choose a strong password — at least 8 characters.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
              {error}
            </div>
          )}

          <form action={updatePassword} className="space-y-5">
            <div className="grid gap-2">
              <Label
                htmlFor="password"
                className="text-gray-500 font-semibold text-sm"
              >
                New password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="bg-white h-12 rounded-xl border-slate-200"
              />
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="confirm_password"
                className="text-gray-500 font-semibold text-sm"
              >
                Confirm new password
              </Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                placeholder="Repeat your new password"
                className="bg-white h-12 rounded-xl border-slate-200"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#E31E24] hover:bg-[#c1191f] text-white rounded-xl font-bold transition-all active:scale-95"
            >
              Update Password
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        </div>
      </div>

      {/* ── Right: image ──────────────────────────────── */}
      <div className="hidden w-1/2 bg-gray-200 lg:block relative">
        <Image
          src="/images/login-side.jpg"
          alt="Coworking space"
          fill
          sizes="(min-width: 1024px) 50vw, 0vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
