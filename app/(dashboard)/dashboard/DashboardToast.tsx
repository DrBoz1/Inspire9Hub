"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

function ToastHandler() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  useEffect(() => {
    if (status === "success") {
      toast.success("Payment Successful", {
        description: "Your booking is confirmed. Access codes sent to email.",
      });
    }
  }, [status]);

  return null;
}

export default function DashboardToast() {
  return (
    <Suspense fallback={null}>
      <ToastHandler />
    </Suspense>
  );
}
