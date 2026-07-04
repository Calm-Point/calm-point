import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { listAppointments, type Appointment } from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function Appointments() {
  const t = useTheme();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    listAppointments()
      .then((d) => setAppointments(d.appointments))
      .catch(() => setAppointments([]));
  }, []);
  useEffect(load, [load]);

  const upcoming = (appointments ?? []).filter((a) =>
    ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(a.status),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(3) }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
            setTimeout(() => setRefreshing(false), 600);
          }}
        />
      }
    >
      <Text style={{ color: t.ink, fontSize: 30, fontWeight: "600" }}>Visits</Text>
      {appointments === null ? (
        <Text style={{ color: t.inkSoft }}>Loading…</Text>
      ) : upcoming.length === 0 ? (
        <Text style={{ color: t.inkSoft, lineHeight: 22 }}>
          No upcoming visits. Book from the web portal for now — in-app booking
          lands in the next mobile milestone.
        </Text>
      ) : (
        upcoming.map((a) => (
          <View
            key={a.id}
            style={{
              backgroundColor: t.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.hairline,
              padding: spacing(5),
              gap: 2,
            }}
          >
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: "600" }}>
              {dateFmt.format(new Date(a.startsAt))}
            </Text>
            <Text style={{ color: t.inkSoft }}>
              {a.kind === "INITIAL" ? "First visit" : "Follow-up"} with {a.providerName}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
