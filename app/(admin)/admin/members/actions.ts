"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getMemberDetails(memberId: string) {
  const supabase = createAdminClient();

  const [bookingsRes, paymentsRes, passesRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, start_date_time, end_date_time, booking_status, workspaces(name)")
      .eq("member_id", memberId)
      .order("start_date_time", { ascending: false })
      .limit(10),

    supabase
      .from("payments")
      .select("id, amount, payment_date, payment_status, payment_method")
      .eq("member_id", memberId)
      .order("payment_date", { ascending: false })
      .limit(10),

    supabase
      .from("access_passes")
      .select("id, issued_date, expiry_date, pass_type, pass_status")
      .eq("member_id", memberId)
      .order("issued_date", { ascending: false })
      .limit(5),
  ]);

  return {
    bookings: bookingsRes.data ?? [],
    payments: paymentsRes.data ?? [],
    passes: passesRes.data ?? [],
  };
}
