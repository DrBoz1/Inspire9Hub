import Image from "next/image";
import Link from "next/link";
import { sendPasswordReset } from "../actions";
import { AuthAlert } from "../AuthAlert";
import { ArrowLeft, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { AuthFormMotion } from "../AuthPageTransition";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ForgotPasswordPage(props: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await props.searchParams;

  return (
    <div className="flex min-h-screen w-full font-poppins">

      {/* ── Left: form panel ──────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col justify-center bg-[#F8F9FA] px-8 md:w-1/2 lg:px-16 xl:px-24">
        <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-[#E31E24]/6 blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#E31E24]/70 via-[#E31E24]/25 to-transparent" />

        <AuthFormMotion className="relative mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-10 flex justify-center">
            <Image
              src="/images/inspire9Logo.png"
              alt="Inspire9 Hub"
              width={200}
              height={68}
              className="h-16 w-auto"
              priority
            />
          </div>

          {sent ? (
            /* ── Success state ──────────────────────────────────────── */
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-100 dark:bg-emerald-900/30 opacity-60" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  Check your inbox
                </h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                  If an account exists for that email, we&apos;ve sent a reset link. It expires in 1 hour.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Didn&apos;t get it? Check spam, or{" "}
                <Link href="/forgot-password" className="font-bold text-[#E31E24] hover:underline">
                  try again
                </Link>
                .
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ─────────────────────────────────────────── */
            <>
              <div className="mb-8 space-y-1.5">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                  Forgot password?
                </h1>
                <p className="text-sm font-medium text-slate-400">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-6">
                  <AuthAlert type="error" message={error} />
                </div>
              )}

              <form action={sendPasswordReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-xs font-black uppercase tracking-widest text-slate-400"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" aria-hidden />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full h-12 rounded-xl border border-slate-200 bg-[#ffffff] pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/25 focus:border-[#E31E24]/50 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="group relative w-full overflow-hidden h-12 rounded-xl bg-[#E31E24] font-black uppercase tracking-widest text-sm text-white shadow-lg shadow-red-200/60 dark:shadow-red-900/30 hover:bg-red-700 active:scale-[0.98] transition-all"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                      backgroundSize: "200% auto",
                      animation: "shimmer-wave 1.8s linear infinite",
                    }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Send Reset Link
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </form>

              <div className="mt-8 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </AuthFormMotion>
      </div>

      {/* ── Right: image panel ────────────────────────────────────────── */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden">
        <Image
          src="/images/login-side.jpg"
          alt="Inspire9 coworking space"
          fill
          sizes="(min-width: 768px) 50vw, 0vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#E31E24]/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Inspire9 Hub · Richmond, Melbourne
          </div>
          <p className="text-3xl font-black tracking-tight leading-tight">
            Where ideas<br />find their home.
          </p>
        </div>
      </div>
    </div>
  );
}
