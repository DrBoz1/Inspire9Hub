import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthAside } from "./AuthAside";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-column">
        <header className="auth-top">
          <Link href="/login" className="auth-brand" aria-label="Inspire9 Hub">
            <Image src="/images/inspire9Logo.png" alt="Inspire9" width={132} height={70} priority />
            <span>Members &amp; staff</span>
          </Link>
          <div className="auth-theme"><ThemeToggle /></div>
        </header>

        <div className="auth-mobile-hero" aria-hidden="true">
          <Image src="/images/login-side.jpg" alt="" fill sizes="(max-width: 960px) 100vw, 1px" className="auth-aside-photo" />
          <div className="auth-aside-shade" />
          <p>Good people. <em>Great things.</em></p>
        </div>

        <main id="main-content" className="auth-main">{children}</main>

        <footer className="auth-bottom">
          <span>41 Stewart St, Richmond VIC</span>
          <a href="mailto:hello@inspire9.com">hello@inspire9.com</a>
        </footer>
      </div>
      <AuthAside />
    </div>
  );
}
