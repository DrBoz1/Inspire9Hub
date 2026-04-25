"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function DashboardToast() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") {
      toast.success("Payment Confirmed!", {
        description:
          "Your booking has been secured. Check your email for access codes.",
        duration: 5000,
      });
    }
  }, [status]);

  return null;
}
