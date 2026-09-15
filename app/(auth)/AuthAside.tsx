"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin } from "lucide-react";

const SCENES = {
  login: {
    index: "01 / Sign in",
    title: "Good people.",
    accent: "Great things.",
    body: "Book a desk or a room, keep track of your bookings, and see what’s on around the hub.",
  },
  signup: {
    index: "02 / Join",
    title: "A little space.",
    accent: "A lot of possibility.",
    body: "Join the makers, founders and freelancers who work from Inspire9 in Richmond.",
  },
  recovery: {
    index: "03 / Account",
    title: "Happens to",
    accent: "the best of us.",
    body: "We’ll have you back at your desk in a moment.",
  },
};

/** The photo stays put across sign-in pages; only its caption changes. */
export function AuthAside() {
  const pathname = usePathname();
  const key = pathname === "/signup" ? "signup" : pathname === "/login" ? "login" : "recovery";
  const scene = SCENES[key];

  return (
    <aside className="auth-aside" aria-label="About Inspire9">
      <div className="auth-aside-frame">
        <Image src="/images/login-side.jpg" alt="Members working together at Inspire9" fill priority sizes="(max-width: 960px) 1px, 52vw" className="auth-aside-photo" />
        <div className="auth-aside-shade" />
        <div className="auth-aside-top">
          <span><MapPin size={12} aria-hidden /> Inspire9 · Richmond, Melbourne</span>
          <span>Inspire9 Hub</span>
        </div>
        <div className="auth-aside-copy">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2>{scene.title}<br /><em>{scene.accent}</em></h2>
              <p>{scene.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="auth-aside-foot">
            <span>Coworking · Meeting rooms · Community</span>
            <span>{scene.index}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
