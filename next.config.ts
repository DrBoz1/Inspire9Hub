import type { NextConfig } from "next";

const securityHeaders = [
  // Stops the site being embedded in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must respect the declared content type, no MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Full referrer only sent to same-origin; cross-origin gets origin only
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app never needs these browser capabilities
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Opt out of cross-origin window references
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // What a page may do beyond itself. Scripts aren't locked down here (Next's
  // inline scripts would need a nonce on every page, making them all dynamic);
  // these close the other doors: no plugins, no <base> hijack, no framing, and
  // forms post only here or to Stripe's checkout and billing pages.
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  },
];

const nextConfig: NextConfig = {
  // Hide the X-Powered-By: Next.js header — no free recon for attackers
  poweredByHeader: false,

  // Room photos can be up to 5MB (see lib/admin-rooms.ts); the default 1MB limit rejected most of them.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
