import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset } from "../actions";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ForgotPasswordPage(props: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await props.searchParams;

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

          {sent ? (
            /* ── Success state ─────────────────────── */
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Check your inbox
                </h1>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                  If an account exists for that email, we&apos;ve sent a
                  password reset link. It expires in 1 hour.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Didn&apos;t receive it? Check your spam folder, or{" "}
                <Link
                  href="/forgot-password"
                  className="text-[#E31E24] font-semibold hover:underline"
                >
                  try again
                </Link>
                .
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            /* ── Form state ────────────────────────── */
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Forgot password?
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
                  {error}
                </div>
              )}

              <form action={sendPasswordReset} className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-gray-500 font-semibold text-sm">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="your@email.com"
                      className="bg-white pl-10 h-12 rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#E31E24] hover:bg-[#c1191f] text-white rounded-xl font-bold transition-all active:scale-95"
                >
                  Send Reset Link
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
            </>
          )}
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
