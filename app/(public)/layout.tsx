import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthAside } from "../(auth)/AuthAside";
import "../(auth)/auth.css";
import "./enquire.css";

/**
 * Pages for people who aren't members yet. The same split-screen material as
 * sign-in, so arriving from the website and then joining feels like one place.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-column">
        <header className="auth-top">
          <Link href="/enquire" className="auth-brand" aria-label="Inspire9, enquire about space">
            <Image src="/images/inspire9Logo.png" alt="Inspire9" width={132} height={70} priority />
            <span>Coworking in Richmond</span>
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
