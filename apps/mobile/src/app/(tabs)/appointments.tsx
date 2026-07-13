import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useCalmStripe } from "@/lib/payments";
import {
  listAppointments,
  listProviders,
  listSlots,
  bookAppointment,
  createVisitPaymentIntent,
  type Appointment,
  type Provider,
  type Slot,
} from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Icon } from "@/lib/icons";
import { radius, spacing, useTheme } from "@/lib/theme";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export default function Appointments() {
  const t = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useCalmStripe();

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAppointments()
      .then((d) => setAppointments(d.appointments))
      .catch(() => setAppointments([]));
  }, []);
  useEffect(load, [load]);

  const upcoming = (appointments ?? []).filter((a) =>
    ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(a.status),
  );

  async function openBooking() {
    setError(null);
    try {
      const { providers: list } = await listProviders();
      setProviders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load providers");
    }
  }

  async function pickProvider(p: Provider) {
    setSelectedProvider(p);
    setSlots(null);
    try {
      const { slots: list } = await listSlots(p.id);
      setSlots(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load times");
    }
  }

  async function pickSlot(slot: Slot) {
    if (!selectedProvider) return;
    setBusy(true);
    setError(null);
    try {
      const { appointmentId } = await bookAppointment(selectedProvider.id, slot.startsAt, "INITIAL");
      const { clientSecret } = await createVisitPaymentIntent(appointmentId);
      const init = await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: "Calm Point" });
      if (init.error) throw new Error(init.error.message);
      const present = await presentPaymentSheet();
      if (present.error) throw new Error(present.error.message);
      setProviders(null);
      setSelectedProvider(null);
      setSlots(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

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
        <Text style={{ color: t.inkSoft, lineHeight: 22 }}>No upcoming visits.</Text>
      ) : (
        upcoming.map((a, i) => (
          <GlassCard key={a.id} delay={i * 60}>
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: "600" }}>
              {dateFmt.format(new Date(a.startsAt))}
            </Text>
            <Text style={{ color: t.inkSoft }}>
              {a.kind === "INITIAL" ? "First visit" : "Follow-up"} with {a.providerName}
            </Text>
          </GlassCard>
        ))
      )}

      {!providers ? (
        <Pressable
          onPress={() => void openBooking()}
          style={{ backgroundColor: t.brand, borderRadius: radius.pill, paddingVertical: spacing(3.5), alignItems: "center", marginTop: spacing(3) }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Book a visit</Text>
        </Pressable>
      ) : (
        <GlassCard style={{ marginTop: spacing(3) }}>
          <Text style={{ color: t.ink, fontWeight: "700", marginBottom: spacing(2) }}>Choose a provider</Text>
          <View style={{ gap: spacing(2) }}>
            {providers.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => void pickProvider(p)}
                style={{
                  flexDirection: "row",
                  gap: spacing(3),
                  padding: spacing(3),
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selectedProvider?.id === p.id ? t.brand : t.hairline,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: t.brandTint, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: t.brand, fontWeight: "700" }}>
                    {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontWeight: "600" }}>{p.name}</Text>
                  <Text style={{ color: t.inkSoft, fontSize: 13 }}>{p.credentials}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {slots ? (
            <View style={{ marginTop: spacing(4), gap: spacing(2) }}>
              <Text style={{ color: t.ink, fontWeight: "700" }}>
                Times with {selectedProvider?.name}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing(2) }}>
                {slots.slice(0, 10).map((s) => (
                  <Pressable
                    key={s.startsAt}
                    disabled={busy}
                    onPress={() => void pickSlot(s)}
                    style={{ borderWidth: 1, borderColor: t.hairline, borderRadius: radius.sm, paddingVertical: spacing(2), paddingHorizontal: spacing(3) }}
                  >
                    <Text style={{ color: t.brand, fontWeight: "600", fontSize: 13 }}>
                      {dateFmt.format(new Date(s.startsAt)).split(",")[0]} {timeFmt.format(new Date(s.startsAt))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </GlassCard>
      )}

      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
      {!upcoming.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), marginTop: spacing(2) }}>
          <Icon name="clock" size={16} color={t.inkSoft} />
          <Text style={{ color: t.inkSoft, fontSize: 12 }}>
            Payment is collected securely via Stripe when you pick a time.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
