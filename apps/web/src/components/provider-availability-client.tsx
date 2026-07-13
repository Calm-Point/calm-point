"use client";

import { useEffect, useState } from "react";
import { Button, Card, Select, Skeleton, useToast } from "@calm-point/ui";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60].map((n) => ({ value: String(n), label: `${n} min` }));
const DEFAULT_START = 9 * 60;
const DEFAULT_END = 17 * 60;

interface DayRow {
  enabled: boolean;
  startMin: number;
  endMin: number;
  slotSizeMin: number;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function emptyWeek(): DayRow[] {
  return DAYS.map((_, dayOfWeek) => ({
    enabled: false,
    startMin: DEFAULT_START,
    endMin: DEFAULT_END,
    slotSizeMin: 30,
  }));
}

export function ProviderAvailabilityClient() {
  const [week, setWeek] = useState<DayRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/v1/provider/availability")
      .then((r) => r.json())
      .then((d: { blocks?: Array<{ dayOfWeek: number; startMin: number; endMin: number; slotSizeMin: number }> }) => {
        const rows = emptyWeek();
        for (const b of d.blocks ?? []) {
          rows[b.dayOfWeek] = {
            enabled: true,
            startMin: b.startMin,
            endMin: b.endMin,
            slotSizeMin: b.slotSizeMin,
          };
        }
        setWeek(rows);
      })
      .catch(() => setWeek(emptyWeek()));
  }, []);

  function updateDay(idx: number, patch: Partial<DayRow>) {
    setWeek((cur) => cur!.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!week) return;
    setBusy(true);
    try {
      const blocks = week
        .map((row, dayOfWeek) => ({ ...row, dayOfWeek }))
        .filter((row) => row.enabled && row.startMin < row.endMin)
        .map(({ dayOfWeek, startMin, endMin, slotSizeMin }) => ({ dayOfWeek, startMin, endMin, slotSizeMin }));
      const res = await fetch("/api/v1/provider/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      if (res.ok) toast.show("Hours saved.", { tone: "positive" });
      else toast.show("Could not save hours.", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (!week) {
    return (
      <Card className="max-w-2xl">
        <Skeleton className="h-64" />
      </Card>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-soft">
        Set your recurring weekly hours. Patients can book any open slot at least 2 hours out.
      </p>
      <Card className="divide-y divide-ink/5 p-0">
        {week.map((row, idx) => (
          <div key={DAYS[idx]} className="flex flex-wrap items-center gap-4 p-4">
            <label className="flex w-32 flex-none items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => updateDay(idx, { enabled: e.target.checked })}
                className="size-4"
              />
              {DAYS[idx]}
            </label>
            {row.enabled ? (
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  From
                  <input
                    type="time"
                    value={minutesToTime(row.startMin)}
                    onChange={(e) => updateDay(idx, { startMin: timeToMinutes(e.target.value) })}
                    className="rounded-md border border-ink/10 bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  To
                  <input
                    type="time"
                    value={minutesToTime(row.endMin)}
                    onChange={(e) => updateDay(idx, { endMin: timeToMinutes(e.target.value) })}
                    className="rounded-md border border-ink/10 bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </label>
                <div className="w-32">
                  <Select
                    label="Slot size"
                    className="h-9"
                    options={SLOT_OPTIONS}
                    value={String(row.slotSizeMin)}
                    onChange={(e) => updateDay(idx, { slotSizeMin: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <p className="flex-1 text-sm text-ink-soft">Not booking this day</p>
            )}
          </div>
        ))}
      </Card>
      <Button loading={busy} onClick={save}>
        Save hours
      </Button>
    </div>
  );
}
