import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*") // <--- YOU NEED THIS
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-poppins">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500">
          Manage your profile information and how it appears on the hub.
        </p>
      </div>

      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your name and contact details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name}
                className="bg-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                disabled
                value={profile?.email}
                className="bg-slate-50 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 italic">
                Email cannot be changed manually.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">Company / Organization</Label>
              <Input
                id="company"
                name="company"
                defaultValue={profile?.company}
                className="bg-white"
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="bg-[#E31E24] hover:bg-red-700 text-white rounded-xl px-8"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
