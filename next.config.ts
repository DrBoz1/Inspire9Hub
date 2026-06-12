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
];

const nextConfig: NextConfig = {
  // Hide the X-Powered-By: Next.js header — no free recon for attackers
  poweredByHeader: false,

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
