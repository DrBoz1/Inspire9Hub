import { createClient } from "@/lib/supabase/server";
import SupportClient from "./SupportClient";

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("members")
    .select("full_name")
    .eq("id", user?.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return <SupportClient firstName={firstName} />;
}
