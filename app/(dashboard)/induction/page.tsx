// app/(dashboard)/induction/page.tsx

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { submitInduction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default async function InductionPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const { data: profile } = await supabase
    .from("members")
    .select("*")
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-4xl mx-auto space-y-10 font-poppins pb-24">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Inspire9 Hub: <span className="text-[#E31E24]">Induction</span>
        </h1>
        <p className="text-slate-500 max-w-2xl leading-relaxed">
          Please complete this form to activate your membership and access the
          workspace.
        </p>
      </div>

      <form action={submitInduction} className="space-y-12">
        {/* Section 1: Member Blueprint Attributes */}
        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Member Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 pt-0">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                name="full_name"
                required
                defaultValue={profile?.full_name}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile_number">Mobile Number *</Label>
              <Input
                name="mobile_number"
                required
                placeholder="04XX XXX XXX"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                name="company_name"
                required
                placeholder="Your Company"
                className="h-11"
              />
            </div>
            <div className="space-y-2 col-span-full">
              <Label htmlFor="health_emergency_info">
                Emergency Contact & Medical Details *
              </Label>
              <Textarea
                name="health_emergency_info"
                required
                placeholder="Name, Phone, and any conditions we should know about..."
                className="min-h-[100px] rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Induction Content */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 px-1">
            Workspace Safety & Guidelines
          </h2>
          <Accordion type="single" collapsible className="w-full space-y-3">
            <AccordionItem
              value="rules"
              className="border rounded-xl px-4 bg-white shadow-sm"
            >
              <AccordionTrigger className="hover:no-underline font-semibold">
                General Procedures
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 space-y-4 pb-4">
                <p>
                  <strong>Wifi:</strong> Residents | <strong>Password:</strong>{" "}
                  community9
                </p>
                <p>
                  Lift access is restricted outside 8:30am - 4:00pm without a
                  pass.
                </p>
                <p>Please clean whiteboards and kitchen areas after use.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Section 3: Blueprint Acknowledgment */}
        <div className="p-8 bg-slate-950 text-white rounded-3xl space-y-6">
          <div className="flex items-start gap-4">
            <Checkbox
              id="acknowledged_terms"
              name="acknowledged_terms"
              required
              className="mt-1 border-white"
            />
            <Label
              htmlFor="acknowledged_terms"
              className="text-sm cursor-pointer font-medium leading-relaxed"
            >
              I acknowledge that I have been informed of the site's safety rules
              and have completed the induction.
            </Label>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-[#E31E24] hover:bg-red-700 text-white px-12 py-7 rounded-2xl font-bold text-lg"
            >
              Complete Induction →
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
