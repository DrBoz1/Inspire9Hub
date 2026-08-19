import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { login } from "../actions";
import { AuthAlert } from "../AuthAlert";
import { PasswordInput } from "../PasswordInput";
import { AuthFormMotion } from "../AuthPageTransition";

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const { error, message } = (await props.searchParams) ?? {};

  return (
    <div className="flex min-h-screen w-full font-poppins">

      {/* ── Left: form panel — deliberately stays light in dark mode ──── */}
      <div className="relative flex w-full flex-col justify-center bg-[#F8F9FA] px-8 md:w-1/2 lg:px-16 xl:px-24">

        {/* Subtle red glow top-left */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-[#E31E24]/6 blur-3xl" />
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#E31E24]/70 via-[#E31E24]/25 to-transparent" />

        <AuthFormMotion className="relative mx-auto w-full max-w-sm">

          {/* Logo — centered, no box, stays sharp on light bg */}
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

          {/* Heading */}
          <div className="mb-8 space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Welcome back.
            </h1>
            <p className="text-sm font-medium text-slate-400">
              Sign in to your Inspire9 Hub account.
            </p>
          </div>

          {/* Alerts */}
          <div className="mb-6 space-y-3">
            {error   && <AuthAlert type="error"   message={error} />}
            {message && <AuthAlert type="success" message={message} />}
          </div>

          {/* Form */}
          <form action={login} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-black uppercase tracking-widest text-slate-400"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" aria-hidden />
                <input
                  name="email"
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full h-12 rounded-xl border border-slate-200 bg-[#ffffff] pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/25 focus:border-[#E31E24]/50 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-black uppercase tracking-widest text-slate-400"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-bold text-[#E31E24]/70 hover:text-[#E31E24] transition-colors uppercase tracking-wider"
                >
                  Forgot?
                </Link>
              </div>
              <PasswordInput
                name="password"
                id="password"
                placeholder="Enter your password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="group relative w-full overflow-hidden h-12 rounded-xl bg-[#E31E24] font-black uppercase tracking-widest text-sm text-white shadow-lg shadow-red-200/70 hover:bg-red-700 active:scale-[0.98] transition-all mt-2"
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  backgroundSize: "200% auto",
                  animation: "shimmer-wave 1.8s linear infinite",
                }}
              />
              <span className="relative z-10 flex items-center justify-center gap-2">
                Sign In
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-slate-700 hover:text-[#E31E24] transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </AuthFormMotion>
      </div>

      {/* ── Right: image panel ────────────────────────────────────────── */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden">
        <Image
          src="/images/login-side.jpg"
          alt="Inspire9 coworking space"
          fill
          sizes="(min-width: 768px) 50vw, 0vw"
          priority
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
          <p className="mt-3 text-sm text-white/60 font-medium max-w-xs leading-relaxed">
            Book workspaces, connect with the community, and grow your business — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Coworking", "Meeting Rooms", "Events", "Community"].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white/70 backdrop-blur-sm border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
