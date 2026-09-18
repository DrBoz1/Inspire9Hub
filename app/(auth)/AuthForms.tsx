"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import { login, signUp } from "./actions";
import { AuthAlert } from "./AuthAlert";
import { PasswordInput } from "./PasswordInput";
import { PasswordChecks, SubmitButton, TextField } from "./AuthUi";
import { AUTH_PATHS, authModeFrom, passwordChecks, slideDirection, type AuthMode } from "./auth-mode";

const EASE = [0.22, 1, 0.36, 1] as const;
const TITLES: Record<AuthMode, string> = { login: "Sign in | Inspire9 Hub", signup: "Join | Inspire9 Hub" };

type Notice = { error?: string; message?: string };

/**
 * Sign in and Join live on one surface. Switching swaps the form in place and
 * updates the URL, so the page never reloads and Back still works.
 */
export function AuthForms({ initialMode, error, message }: { initialMode: AuthMode } & Notice) {
  const mode = authModeFrom(usePathname());
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageRef, height] = useMeasuredHeight();

  // Derived during render: which way to slide, and whether the server's notice still applies.
  const noticeKey = `${initialMode}|${error ?? ""}|${message ?? ""}`;
  const [notice, setNotice] = useState<Notice & { key: string }>({ key: noticeKey, error, message });
  const [shown, setShown] = useState({ mode, direction: 1 });
  if (notice.key !== noticeKey) setNotice({ key: noticeKey, error, message });
  if (shown.mode !== mode) {
    setShown({ mode, direction: slideDirection(shown.mode, mode) });
    setNotice({ key: noticeKey });
  }

  useEffect(() => {
    document.title = TITLES[mode];
  }, [mode]);

  const switchTo = (next: AuthMode) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (next !== mode) window.history.pushState(null, "", AUTH_PATHS[next]);
  };

  const panel: Variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : 36 * d, filter: reduce ? "blur(0px)" : "blur(6px)" }),
    center: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0.15 : 0.5, ease: EASE, staggerChildren: reduce ? 0 : 0.045, delayChildren: reduce ? 0 : 0.04 },
    },
    exit: (d: number) => ({
      opacity: 0,
      x: reduce ? 0 : -28 * d,
      filter: reduce ? "blur(0px)" : "blur(6px)",
      transition: { duration: reduce ? 0.1 : 0.22, ease: [0.4, 0, 1, 1] },
    }),
  };
  const item: Variants = {
    enter: { opacity: 0, y: reduce ? 0 : 10 },
    center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
    exit: { opacity: 1 },
  };

  const notices = (notice.error || notice.message) && (
    <motion.div variants={item} className="auth-notices">
      {notice.error && <AuthAlert type="error" message={notice.error} />}
      {notice.message && <AuthAlert type="success" message={notice.message} />}
    </motion.div>
  );
  const checks = passwordChecks(password);

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth-page">
        <nav className="auth-switch" aria-label="Sign in or join">
          {(["login", "signup"] as const).map((m) => (
            <Link key={m} href={AUTH_PATHS[m]} onClick={switchTo(m)} aria-current={mode === m ? "page" : undefined} className="auth-switch-option">
              {mode === m && <motion.span layoutId="auth-switch-pill" className="auth-switch-pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <span>{m === "login" ? "Sign in" : "Join the hub"}</span>
            </Link>
          ))}
        </nav>

        <motion.div className="auth-stage" initial={false} animate={{ height }} transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}>
          <div ref={stageRef} className="auth-stage-inner">
            <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}>
              <motion.section
                key={mode}
                custom={shown.direction}
                variants={panel}
                initial="enter"
                animate="center"
                exit="exit"
                aria-labelledby={`${mode}-title`}
              >
                {mode === "login" ? (
                  <>
                    <motion.header variants={item} className="auth-heading">
                      <p className="auth-eyebrow">Inspire9 Hub</p>
                      <h1 id="login-title">Welcome back<span className="auth-red">.</span></h1>
                      <p>Sign in to book a space and see what&apos;s on.</p>
                    </motion.header>
                    {notices}
                    <form action={login} className="auth-form">
                      <motion.div variants={item}>
                        <TextField id="login-email" name="email" type="email" label="Email" icon="mail" autoComplete="email" placeholder="you@company.com" value={email} onValueChange={setEmail} required />
                      </motion.div>
                      <motion.div variants={item} className="auth-field">
                        <div className="auth-label-row">
                          <label htmlFor="login-password">Password</label>
                          <Link href="/forgot-password" className="auth-link-quiet">Forgot password?</Link>
                        </div>
                        <PasswordInput id="login-password" name="password" placeholder="Your password" />
                      </motion.div>
                      <motion.div variants={item}>
                        <SubmitButton pendingLabel="Signing you in…">Sign in</SubmitButton>
                      </motion.div>
                    </form>
                    <motion.p variants={item} className="auth-footnote">
                      New to Inspire9? <Link href={AUTH_PATHS.signup} onClick={switchTo("signup")}>Create an account</Link> or <Link href="/enquire">ask about space</Link>
                      <span className="auth-staff-note">Inspire9 staff sign in here too. You&apos;ll go straight to the admin area.</span>
                    </motion.p>
                  </>
                ) : (
                  <>
                    <motion.header variants={item} className="auth-heading">
                      <p className="auth-eyebrow">New member</p>
                      <h1 id="signup-title">Join the hub<span className="auth-red">.</span></h1>
                      <p>Create your account, complete a short induction, and you&apos;re in.</p>
                    </motion.header>
                    {notices}
                    <form action={signUp} className="auth-form">
                      <motion.div variants={item}>
                        <TextField id="signup-name" name="name" label="Full name" icon="user" autoComplete="name" placeholder="Jane Smith" required />
                      </motion.div>
                      <motion.div variants={item}>
                        <TextField id="signup-email" name="email" type="email" label="Email" icon="mail" autoComplete="email" placeholder="you@company.com" value={email} onValueChange={setEmail} required />
                      </motion.div>
                      <motion.div variants={item} className="auth-field">
                        <label htmlFor="signup-password">Password</label>
                        <PasswordInput id="signup-password" name="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} onValueChange={setPassword} describedBy="signup-password-checks" />
                        <PasswordChecks id="signup-password-checks" items={[{ label: "8+ characters", met: checks.length }, { label: "Letters and numbers", met: checks.mix }]} />
                      </motion.div>
                      <motion.div variants={item}>
                        <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
                      </motion.div>
                    </form>
                    <motion.p variants={item} className="auth-footnote">
                      Already a member? <Link href={AUTH_PATHS.login} onClick={switchTo("login")}>Sign in</Link>
                    </motion.p>
                  </>
                )}
              </motion.section>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}

/** Tracks an element's height so its container can ease between forms of different lengths. */
function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}
