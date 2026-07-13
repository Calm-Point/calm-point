import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCalmStripe } from "@/lib/payments";
import {
  uploadIdentity,
  submitInsurance,
  checkEligibility,
  recordConsents,
  startMembership,
} from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Icon } from "@/lib/icons";
import { radius, spacing, useTheme } from "@/lib/theme";

/**
 * Identity + insurance + consent capture, and membership subscribe (docs/10
 * §1.4, §1.6). Photos come from the camera roll or camera via expo-image-picker
 * and travel as base64 data URLs to the same encrypted-storage endpoints the
 * web app uses. Membership payment uses Stripe's PaymentSheet so card data
 * never touches app code.
 */

async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets[0]?.base64) return null;
  const mime = result.assets[0].mimeType ?? "image/jpeg";
  return `data:${mime};base64,${result.assets[0].base64}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <GlassCard>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700", marginBottom: spacing(3) }}>{title}</Text>
      {children}
    </GlassCard>
  );
}

function FieldInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={t.inkSoft}
        style={{
          height: 44,
          borderWidth: 1,
          borderColor: t.hairline,
          borderRadius: radius.sm,
          paddingHorizontal: spacing(3),
          color: t.ink,
          backgroundColor: t.surface,
        }}
      />
    </View>
  );
}

export default function CareVerify() {
  const t = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useCalmStripe();

  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfPay, setSelfPay] = useState(false);
  const [payer, setPayer] = useState("");
  const [memberId, setMemberId] = useState("");
  const [eligibility, setEligibility] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [memberActive, setMemberActive] = useState(false);

  async function onPickId() {
    const uri = await pickPhoto();
    if (uri) setIdPhoto(uri);
  }

  async function onCheckEligibility() {
    if (!payer.trim() || !memberId.trim()) return setError("Enter carrier and member ID first.");
    setBusy("eligibility");
    setError(null);
    try {
      const r = await checkEligibility(payer.trim(), memberId.trim());
      setEligibility(
        r.status === "ACTIVE"
          ? `Coverage active${r.copayCents != null ? ` · est. copay $${(r.copayCents / 100).toFixed(2)}` : ""}`
          : `Coverage ${r.status.toLowerCase()}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eligibility check failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!idPhoto) return setError("Please add a photo of your ID.");
    if (!selfPay && (!payer.trim() || !memberId.trim())) return setError("Enter insurance details, or choose self-pay.");
    if (!consented) return setError("Please accept the consents to continue.");
    setBusy("submit");
    try {
      await uploadIdentity("drivers_license", idPhoto);
      await submitInsurance(
        selfPay ? { selfPay: true } : { payerName: payer.trim(), memberId: memberId.trim() },
      );
      await recordConsents();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSubscribe() {
    setBusy("subscribe");
    setError(null);
    try {
      const { clientSecret } = await startMembership();
      const init = await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: "Calm Point" });
      if (init.error) throw new Error(init.error.message);
      const present = await presentPaymentSheet();
      if (present.error) throw new Error(present.error.message);
      setMemberActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(4) }}
    >
      <Text style={{ color: t.ink, fontSize: 26, fontWeight: "700" }}>My care</Text>

      {done ? (
        <Section title="Verified">
          <Text style={{ color: t.inkSoft }}>
            You&apos;re ready to schedule your first visit from the Visits tab.
          </Text>
        </Section>
      ) : (
        <>
          <Section title="Photo ID">
            <Pressable
              onPress={onPickId}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing(3), borderWidth: 1.5, borderColor: idPhoto ? t.brand : t.hairline, borderStyle: idPhoto ? "solid" : "dashed", borderRadius: radius.md, padding: spacing(4) }}
            >
              <Icon name="card" size={24} color={t.brand} />
              <Text style={{ color: t.ink }}>{idPhoto ? "ID photo added ✓" : "Add a photo of your ID"}</Text>
            </Pressable>
          </Section>

          <Section title="Insurance">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(3) }}>
              <Text style={{ color: t.ink }}>I&apos;ll self-pay (no insurance)</Text>
              <Switch value={selfPay} onValueChange={setSelfPay} />
            </View>
            {!selfPay ? (
              <View style={{ gap: spacing(3) }}>
                <FieldInput label="Insurance carrier" value={payer} onChangeText={setPayer} placeholder="e.g. Aetna" />
                <FieldInput label="Member ID" value={memberId} onChangeText={setMemberId} placeholder="W123456789" />
                <Pressable
                  onPress={() => void onCheckEligibility()}
                  style={{ backgroundColor: t.brandTint, borderRadius: radius.pill, paddingVertical: spacing(2.5), alignItems: "center" }}
                >
                  <Text style={{ color: t.brand, fontWeight: "600" }}>
                    {busy === "eligibility" ? "Checking…" : "Check coverage now"}
                  </Text>
                </Pressable>
                {eligibility ? <Text style={{ color: t.positive, fontSize: 13 }}>{eligibility}</Text> : null}
              </View>
            ) : null}
          </Section>

          <Section title="Consent">
            <Pressable onPress={() => setConsented((v) => !v)} style={{ flexDirection: "row", gap: spacing(3), alignItems: "flex-start" }}>
              <Icon name={consented ? "check" : "shield"} size={20} color={consented ? t.positive : t.inkSoft} />
              <Text style={{ color: t.ink, flex: 1, lineHeight: 20 }}>
                I agree to the Telehealth Informed Consent, the Notice of Privacy Practices (HIPAA), and the
                Terms of Service and Privacy Policy.
              </Text>
            </Pressable>
          </Section>

          {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
          <Pressable
            onPress={() => void onSubmit()}
            style={{ backgroundColor: t.brand, borderRadius: radius.pill, paddingVertical: spacing(3.5), alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {busy === "submit" ? "Submitting…" : "Submit & schedule"}
            </Text>
          </Pressable>
        </>
      )}

      <Section title="Membership · $49/mo">
        <Text style={{ color: t.inkSoft, marginBottom: spacing(3) }}>
          Secure messaging, recurring check-ins, and the AI companion between visits.
        </Text>
        {memberActive ? (
          <Text style={{ color: t.positive, fontWeight: "600" }}>Active</Text>
        ) : (
          <Pressable
            onPress={() => void onSubscribe()}
            style={{ borderColor: t.brand, borderWidth: 1.5, borderRadius: radius.pill, paddingVertical: spacing(3), alignItems: "center" }}
          >
            <Text style={{ color: t.brand, fontWeight: "700" }}>
              {busy === "subscribe" ? "Starting…" : "Subscribe"}
            </Text>
          </Pressable>
        )}
      </Section>
    </ScrollView>
  );
}
