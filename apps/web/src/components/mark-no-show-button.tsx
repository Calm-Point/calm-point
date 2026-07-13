"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@calm-point/ui";

export function MarkNoShowButton({ appointmentId }: { appointmentId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function markNoShow() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "no-show" }),
      });
      if (res.ok) {
        toast.show("Marked as no-show.", { tone: "neutral" });
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.show(data.error ?? "Could not update this visit.", { tone: "danger" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" loading={busy} onClick={markNoShow}>
      Mark no-show
    </Button>
  );
}
