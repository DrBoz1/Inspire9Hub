<div align="center">

  <img src="public/images/inspire9Logo.png" alt="Inspire9 Hub" width="220" />

  <h1>Inspire9 Hub</h1>

  <p><strong>Full-stack coworking space management platform — memberships, safety compliance, atomic room booking, payments, and AI-assisted scheduling.</strong></p>

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

  <br />

[**Live Demo**](https://inspire9-hub.vercel.app) &nbsp;·&nbsp; [**Report a Bug**](https://github.com/Dr-Boz/inspire9-hub/issues)

</div>

---

## Overview

Inspire9 Hub is a production-grade web application that manages the full lifecycle of a coworking space — from a new member's first registration through safety induction, workspace booking, payment processing, and ongoing activity tracking.

It replaces manual spreadsheets and email chains with a unified digital portal. Admins get a complete management suite; members get a clean, fast interface with an AI assistant that understands natural-language booking requests.

Built on **Next.js 16 App Router** (React Server Components + Server Actions), **Supabase** (PostgreSQL + Row-Level Security), and **Stripe Checkout + Webhooks**, with correctness enforced at the infrastructure level — not just in application logic.

---

## Feature Overview

### Member Portal

| Feature              | Description                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**   | Email/password registration, login, forgot password, and reset via Supabase Auth with secure server-side session management                                                |
| **Safety Induction** | Multi-step compliance form collecting health and emergency contact info. Booking access is hard-gated behind admin approval — no URL bypass is possible.                   |
| **Room Booking**     | Browse live workspace availability, pick a date and time, and pay through Stripe Checkout. The slot is reserved the instant checkout starts — before any payment is taken. |
| **AI Hub Assistant** | Conversational assistant that understands plain-English requests like _"book the pool room tomorrow 2–4pm"_ and executes them as real bookings                             |
| **Booking History**  | Tabbed view of all bookings, payments, and access passes with server-side status filters and paginated results                                                             |
| **Member Dashboard** | Live Melbourne time display, next upcoming booking card, safety compliance progress bar, and hub-wide announcements                                                        |
| **Dark Mode**        | Full system-aware dark / light theme across every page and component                                                                                                       |

### Admin Portal

| Feature                | Description                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Induction Review**   | Queue of pending submissions with member details, workplace, and health info. One-click Approve / Reject with automatic audit logging. |
| **Booking Schedule**   | All workspace reservations filterable by Upcoming / Past / All / Cancelled                                                             |
| **Refund Processing**  | Trigger Stripe refunds directly from the admin panel for cancelled bookings that have a verified payment intent on record              |
| **Room Management**    | Create, edit, price, and deactivate workspace listings                                                                                 |
| **Member Directory**   | Browse all registered members with account and induction status                                                                        |
| **Hub Announcements**  | Publish notices (general, event, maintenance, alert, reminder) displayed on every member's dashboard                                   |
| **Approval Audit Log** | Paginated history of every induction decision with outcome, date, and member details                                                   |

---

## Technical Deep-Dives

### Atomic Booking — Race Condition Proof at the Database Layer

Most booking systems follow a "check then insert" pattern — a classic **Time-of-Check / Time-of-Use (TOCTOU) race condition**. Under concurrent load, two users can both pass the availability check and both succeed in writing a conflicting row.

Inspire9 Hub eliminates this entirely at the **database level** using a PostgreSQL `EXCLUDE` constraint backed by a GiST index:

```sql
-- enforced at the Postgres level — no application code can bypass it
EXCLUDE USING gist (
  workspace_id WITH =,
  tstzrange(start_date_time, end_date_time, '[)') WITH &&
)
```

**The full booking flow:**

1. User clicks "Confirm & Pay" → `createCheckoutSession` Server Action fires
2. Server re-validates: auth session, induction status, time bounds, and room price _(client values are never trusted)_
3. A `"pending"` booking row is inserted **before** Stripe Checkout is created — holding the slot immediately
4. If two requests arrive within milliseconds of each other, Postgres rejects the second insert with `23P01` (exclusion_violation)
5. The error is caught and surfaces as: _"This slot was just taken — pick a different time."_
6. If Stripe fails after a successful insert, the pending row is immediately cancelled to release the slot

```typescript
const { data: booking, error: bookingError } = await adminDb
  .from("bookings")
  .insert({
    member_id: user.id,
    workspace_id: bookingData.workspaceId,
    start_date_time: startISO,
    end_date_time: endISO,
    booking_status: "pending", // slot is HELD right here
  })
  .select()
  .single();

if (bookingError?.code === "23P01") {
  throw new Error(
    "This slot was just reserved by someone else. Pick a different time.",
  );
}
```

Stripe Checkout sessions expire after **30 minutes**. A `checkout.session.expired` webhook handler automatically cancels the pending row, releasing the slot back into the pool — no manual cleanup needed.

---

### Server-First Security — Nothing Trusted from the Client

Every sensitive operation runs entirely server-side, regardless of what the browser sends:

| Concern                  | Enforcement                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Price manipulation**   | Room price is re-read from the database at checkout time. The amount the browser displayed is discarded.                                              |
| **Auth spoofing**        | Every Server Action independently calls `supabase.auth.getUser()` — the JWT is re-verified on every request, never read from a cookie value directly. |
| **Induction bypass**     | Checked server-side inside the booking action. Hiding the button in the UI is not the enforcement mechanism.                                          |
| **Open redirect**        | `returnTo` URL is validated against an explicit `Set<string>` allowlist before any redirect is issued.                                                |
| **Fake refund requests** | The admin refund action verifies the Stripe payment intent ID exists in the database against that specific booking before calling Stripe.             |

---

### Timezone-Aware Availability (Melbourne — AEST / AEDT)

A naive `new Date().toISOString()` UTC-based availability check fails during DST transitions — rooms appear busy or available on the wrong calendar day for several hours, twice a year.

The fix uses a DST-safe Melbourne local day boundary computation:

```typescript
// lib/datetime.ts
export function getLocalDayBoundsUTC(timezone: string): {
  startUTC: string;
  endUTC: string;
} {
  // Uses Intl.DateTimeFormat offset detection to read Melbourne's actual UTC offset
  // right now — AEST (UTC+10) or AEDT (UTC+11) depending on the current date.
  // Returns the start and end of today's Melbourne calendar day expressed as UTC ISO strings.
}
```

All "Busy Today" availability queries use these bounds instead of a raw UTC clock. Room availability always reflects the **Melbourne calendar day** — during daylight saving and outside of it.

---

### AI Hub Assistant

The Support page hosts a conversational AI assistant that understands natural-language booking requests and general hub queries:

> _"Is the pool room free this Friday afternoon?"_
> _"Book the Elbow Room for 2 hours starting at 10am tomorrow"_
> _"What rooms are available today?"_

The NLP engine (`lib/assistant/engine.ts`) extracts intent, date/time expressions, and workspace references from freeform text, resolves them against live Supabase availability data, and either executes the booking or returns a structured clarification request — all within the chat interface, without navigating away from the page.

---

### Parallel Data Fetching

Dashboard and history pages fire all independent database queries simultaneously using `Promise.all`. Total load time equals the **single slowest query** — not the sum of all of them.

```typescript
// dashboard/page.tsx — 5 independent Supabase queries fire in parallel
const [
  { data: profile },
  { data: adminRecord },
  { data: history },
  { data: nextBooking },
  { data: announcements },
] = await Promise.all([
  profileQuery,
  adminQuery,
  historyQuery,
  nextBookingQuery,
  announcementsQuery,
]);
```

The history page runs **7 parallel queries** — filtered paginated lists for bookings, payments, and passes, plus lightweight `{head: true}` count-only queries for stat cards. Stat card totals always reflect the unfiltered true count regardless of which filter the user has active.

---

## Tech Stack

| Layer          | Technology                 | Version |
| -------------- | -------------------------- | ------- |
| Framework      | Next.js (App Router)       | 16.2    |
| UI Library     | React                      | 19      |
| Language       | TypeScript                 | 5       |
| Database       | Supabase — PostgreSQL      | Latest  |
| Authentication | Supabase Auth              | Latest  |
| Payments       | Stripe Checkout + Webhooks | 22      |
| Styling        | Tailwind CSS               | v4      |
| Animations     | Framer Motion              | 12      |
| Date Utilities | date-fns                   | 4       |
| Email          | Resend + React Email       | Latest  |
| PDF Generation | @react-pdf/renderer        | 4       |
| UI Components  | shadcn/ui (Radix UI)       | Latest  |
| Deployment     | Vercel                     | —       |

---

## Project Structure

```
inspire9-hub/
│
├── app/
│   ├── (auth)/                        # Auth flows
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   ├── (dashboard)/                   # Member-facing portal
│   │   ├── dashboard/                 # Home dashboard + live activity feed
│   │   ├── bookings/                  # Room browsing + booking flow
│   │   │   ├── actions.ts             # ← createCheckoutSession, checkRoomAvailability
│   │   │   ├── BookingsHero.tsx       # Animated hero section
│   │   │   ├── BookingClient.tsx      # Room card grid + tab layout
│   │   │   └── BookingModal.tsx       # Time-slot selection modal
│   │   ├── history/                   # Tabbed history (bookings / payments / passes)
│   │   ├── induction/                 # Multi-step safety onboarding form
│   │   ├── support/                   # AI Hub Assistant chat interface
│   │   └── profile/                   # Member profile management
│   │
│   ├── (admin)/                       # Admin portal
│   │   ├── actions.ts                 # ← approveInduction, rejectInduction
│   │   └── admin/
│   │       ├── approvals/             # Induction review queue
│   │       ├── bookings/              # All bookings + refund actions
│   │       ├── rooms/                 # Workspace CRUD
│   │       ├── members/               # Member directory
│   │       ├── announcements/         # Hub notice management
│   │       └── management/            # Hub settings
│   │
│   └── api/
│       └── webhooks/stripe/           # ← Stripe event handler (payment / expiry)
│
├── components/
│   ├── ui/                            # shadcn/ui base components
│   ├── dashboard-header.tsx           # Live Melbourne clock + page label + sidebar trigger
│   └── app-sidebar.tsx                # Navigation sidebar
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts                  # Server-side Supabase client
│   │   ├── client.ts                  # Browser-side Supabase client
│   │   └── admin.ts                   # Service-role admin client (bypasses RLS)
│   ├── assistant/
│   │   └── engine.ts                  # NLP booking intent engine
│   ├── email/                         # Resend email templates + PDF receipt generation
│   ├── datetime.ts                    # ← Melbourne DST-safe timezone bounds
│   ├── stripe.ts                      # Stripe SDK singleton
│   └── constants.ts                   # Shared enums (INDUCTION_STATUS, MEMBER_STATUS)
│
└── supabase/
    └── migrations/                    # PostgreSQL schema migrations
```

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- A [Supabase](https://supabase.com) project with the schema applied
- A [Stripe](https://stripe.com) account with a webhook endpoint registered
- A [Resend](https://resend.com) account for transactional email

### Installation

```bash
git clone https://github.com/Dr-Boz/inspire9-hub.git
cd inspire9-hub
npm install
```

### Environment Variables

Create a `.env.local` file in the root of the project:

<details>
<summary>📋 Click to expand — all required environment variables</summary>

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# ── Email — Resend ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...

<<<<<<< HEAD
```
=======
>>>>>>> 441e6d08d9e6268319d69c086fafde1c1516d977

</details>

### Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

To test Stripe webhooks in development, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Key Routes

| Route                  | Who     | Description                                        |
| ---------------------- | ------- | -------------------------------------------------- |
| `/`                    | All     | Landing page — redirects to dashboard if signed in |
| `/login` · `/signup`   | Public  | Authentication                                     |
| `/dashboard`           | Members | Home — status cards, announcements, activity feed  |
| `/bookings`            | Members | Room browser and booking flow                      |
| `/induction`           | Members | Safety onboarding form                             |
| `/support`             | Members | AI Hub Assistant                                   |
| `/history`             | Members | Full booking, payment, and pass history            |
| `/profile`             | Members | Account settings                                   |
| `/admin/approvals`     | Admins  | Induction review queue                             |
| `/admin/bookings`      | Admins  | All workspace reservations                         |
| `/admin/rooms`         | Admins  | Workspace management                               |
| `/admin/members`       | Admins  | Member directory                                   |
| `/admin/announcements` | Admins  | Hub notice management                              |

---

## Deployment

The project is deployed on **Vercel**. Every push to `main` triggers a production build automatically.

1. Import the repository into your Vercel project
2. Add all environment variables in **Project Settings → Environment Variables**
3. Register the Stripe webhook endpoint in your [Stripe Dashboard](https://dashboard.stripe.com/webhooks):
   ```
   https://your-domain.vercel.app/api/webhooks/stripe
   ```
4. Enable the following Stripe events on that webhook endpoint:
   - `checkout.session.completed`
   - `checkout.session.expired`

---

## Author

Developed by **Hesam Zoveidavian Poor** &nbsp;—&nbsp; Final Year Project, Academic Session 2025/2026.

---

<div align="center">
  <sub>Built with Next.js &nbsp;·&nbsp; Supabase &nbsp;·&nbsp; Stripe &nbsp;·&nbsp; Vercel &nbsp;·&nbsp; Tailwind CSS &nbsp;·&nbsp; Framer Motion</sub>
</div>
