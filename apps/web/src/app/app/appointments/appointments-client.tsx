"use client";

import { useCallback, useEffect, useState } from "react";
import { LATE_CANCEL_WINDOW_HOURS } from "@calm-point/shared";
import { Badge, Button, Card, CardTitle, EmptyState, Sheet, Skeleton, useToast, cn } from "@calm-point/ui";

interface Provider {
  id: string;
  name: string;
  bio: string | null;
  specialties: string[];
}
interface Slot {
  startsAt: string;
  endsAt: string;
}
interface Appointment {
  id: string;
  kind: string;
  status: string;
  startsAt: string;
  providerId: string;
  providerName: string;
}

function isLate(startsAt: string): boolean {
  const hoursOut = (new Date(startsAt).getTime() - Date.now()) / 3_600_000;
  return hoursOut < LATE_CANCEL_WINDOW_HOURS;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function AppointmentsClient() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [booking, setBooking] = useState<string | null>(null); // startsAt being booked
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[] | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState<string | null>(null);
  const toast = useToast();

  const refresh = useCallback(() => {
    fetch("/api/v1/booking/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .catch(() => setAppointments([]));
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/v1/booking/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, [refresh]);

  async function openProvider(provider: Provider) {
    setSelectedProvider(provider);
    setSlots(null);
    const res = await fetch(`/api/v1/booking/slots?providerId=${provider.id}&days=14`);
    const data = await res.json().catch(() => ({ slots: [] }));
    setSlots(data.slots ?? []);
  }

  async function book(slot: Slot) {
    if (!selectedProvider) return;
    setBooking(slot.startsAt);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/booking/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          startsAt: slot.startsAt,
          kind: "INITIAL",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "That time was just taken — pick another.");
        await openProvider(selectedProvider);
        return;
      }
      setMessage("Booked! You'll get a reminder before your visit.");
      setSelectedProvider(null);
      setSlots(null);
      refresh();
    } finally {
      setBooking(null);
    }
  }

  function requestCancel(appointment: Appointment) {
    if (isLate(appointment.startsAt)) {
      setConfirmingCancel(appointment);
      return;
    }
    void cancel(appointment.id);
  }

  async function cancel(appointmentId: string) {
    const res = await fetch("/api/v1/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.show(
        data.lateCancel
          ? "Cancelled — this was inside the 24-hour window, so a late-cancellation fee may apply."
          : "Visit cancelled.",
        { tone: data.lateCancel ? "danger" : "neutral" },
      );
      setConfirmingCancel(null);
      refresh();
    }
  }

  async function openReschedule(appointment: Appointment) {
    setRescheduling(appointment);
    setRescheduleSlots(null);
    const res = await fetch(`/api/v1/booking/slots?providerId=${appointment.providerId}&days=14`);
    const data = await res.json().catch(() => ({ slots: [] }));
    setRescheduleSlots(data.slots ?? []);
  }

  async function confirmReschedule(slot: Slot) {
    if (!rescheduling) return;
    setRescheduleBusy(slot.startsAt);
    try {
      const res = await fetch(`/api/v1/appointments/${rescheduling.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule", newStartsAt: slot.startsAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.show("Visit rescheduled.", { tone: "positive" });
        setRescheduling(null);
        refresh();
      } else {
        toast.show(data.error ?? "Could not reschedule.", { tone: "danger" });
      }
    } finally {
      setRescheduleBusy(null);
    }
  }

  const upcoming = (appointments ?? []).filter((a) =>
    ["SCHEDULED", "CONFIRMED"].includes(a.status),
  );

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p role="status" className="rounded-md bg-brand-tint px-4 py-3 text-sm font-medium text-brand">
          {message}
        </p>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Upcoming</h2>
        {appointments === null ? (
          <Skeleton className="h-24" />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming visits"
            description="Pick a provider below to book your first appointment."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((a) => (
              <Card key={a.id} className="flex items-center justify-between p-5">
                <div>
                  <p className="font-medium">
                    {dateFmt.format(new Date(a.startsAt))} ·{" "}
                    {timeFmt.format(new Date(a.startsAt))}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {a.kind === "INITIAL" ? "First visit" : "Follow-up"} with {a.providerName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="brand">{a.status.toLowerCase()}</Badge>
                  <Button size="sm" onClick={() => (window.location.href = `/app/visit/${a.id}`)}>
                    Join
                  </Button>
                  <a
                    href={`/api/v1/appointments/${a.id}/ics`}
                    className="text-sm text-brand underline"
                    download
                  >
                    Add to calendar
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => openReschedule(a)}>
                    Reschedule
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => requestCancel(a)}>
                    Cancel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Book a visit</h2>
        {providers === null ? (
          <Skeleton className="h-32" />
        ) : providers.length === 0 ? (
          <EmptyState
            title="No providers available in your state yet"
            description="We're expanding quickly — we'll email you the moment a licensed provider is available."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {providers.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lifted",
                  selectedProvider?.id === p.id && "ring-2 ring-brand",
                )}
                onClick={() => openProvider(p)}
              >
                <CardTitle className="mb-1 text-lg">{p.name}</CardTitle>
                <p className="mb-3 text-sm text-ink-soft">{p.bio}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.specialties.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {selectedProvider ? (
        <section aria-live="polite">
          <h2 className="mb-4 text-lg font-semibold">
            Times with {selectedProvider.name}
          </h2>
          {slots === null ? (
            <Skeleton className="h-24" />
          ) : slots.length === 0 ? (
            <EmptyState title="No open times in the next two weeks" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.slice(0, 24).map((slot) => (
                <Button
                  key={slot.startsAt}
                  variant="secondary"
                  size="sm"
                  loading={booking === slot.startsAt}
                  onClick={() => book(slot)}
                >
                  {dateFmt.format(new Date(slot.startsAt))}{" "}
                  {timeFmt.format(new Date(slot.startsAt))}
                </Button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <Sheet
        open={confirmingCancel !== null}
        onClose={() => setConfirmingCancel(null)}
        title="Cancel this visit?"
        description="This is inside the 24-hour window — a late-cancellation fee may apply per our cancellation policy."
        side="bottom"
        footer={
          confirmingCancel ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmingCancel(null)}>
                Never mind
              </Button>
              <Button variant="danger" onClick={() => cancel(confirmingCancel.id)}>
                Cancel visit
              </Button>
            </div>
          ) : null
        }
      >
        {confirmingCancel ? (
          <p className="text-sm text-ink-soft">
            Your visit with {confirmingCancel.providerName} on{" "}
            {dateFmt.format(new Date(confirmingCancel.startsAt))} at{" "}
            {timeFmt.format(new Date(confirmingCancel.startsAt))}.
          </p>
        ) : null}
      </Sheet>

      <Sheet
        open={rescheduling !== null}
        onClose={() => setRescheduling(null)}
        title="Reschedule"
        description={rescheduling ? `Pick a new time with ${rescheduling.providerName}.` : undefined}
        side="bottom"
      >
        {rescheduleSlots === null ? (
          <Skeleton className="h-24" />
        ) : rescheduleSlots.length === 0 ? (
          <EmptyState title="No open times in the next two weeks" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {rescheduleSlots.slice(0, 24).map((slot) => (
              <Button
                key={slot.startsAt}
                variant="secondary"
                size="sm"
                loading={rescheduleBusy === slot.startsAt}
                onClick={() => confirmReschedule(slot)}
              >
                {dateFmt.format(new Date(slot.startsAt))} {timeFmt.format(new Date(slot.startsAt))}
              </Button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
