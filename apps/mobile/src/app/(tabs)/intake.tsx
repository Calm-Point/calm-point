import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import {
  loadCheckin,
  submitCheckin,
  requestIntakeAnalysis,
  type CheckinQuestionnaire,
} from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Icon } from "@/lib/icons";
import { radius, spacing, useTheme } from "@/lib/theme";

/** Ordered validated battery (mirrors packages/shared INTAKE_BATTERY). */
const BATTERY_SLUGS = ["phq-9", "gad-7", "asrs-v1.1", "isi", "pc-ptsd-5", "audit-c"];

type Stage =
  | { kind: "loading" }
  | { kind: "asking"; i: number; qi: number }
  | { kind: "submitting" }
  | { kind: "crisis" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function IntakeBattery() {
  const t = useTheme();
  const [instruments, setInstruments] = useState<CheckinQuestionnaire[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded: CheckinQuestionnaire[] = [];
        for (const slug of BATTERY_SLUGS) {
          const { questionnaire } = await loadCheckin(slug);
          loaded.push(questionnaire);
        }
        if (!cancelled) {
          setInstruments(loaded);
          setStage({ kind: "asking", i: 0, qi: 0 });
        }
      } catch (e) {
        if (!cancelled) setStage({ kind: "error", message: e instanceof Error ? e.message : "Load failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = instruments.reduce((n, i) => n + i.questions.length, 0);
  const before = (i: number, qi: number) =>
    instruments.slice(0, i).reduce((n, inst) => n + inst.questions.length, 0) + qi;

  async function choose(optionId: string) {
    if (stage.kind !== "asking") return;
    const { i, qi } = stage;
    const instrument = instruments[i]!;
    const question = instrument.questions[qi]!;
    const next = {
      ...answers,
      [instrument.slug]: { ...(answers[instrument.slug] ?? {}), [question.id]: optionId },
    };
    setAnswers(next);

    if (qi + 1 < instrument.questions.length) {
      setStage({ kind: "asking", i, qi: qi + 1 });
      return;
    }
    setStage({ kind: "submitting" });
    try {
      const result = await submitCheckin(
        instrument.slug,
        instrument.questions.map((q) => ({ questionId: q.id, optionId: next[instrument.slug]![q.id]! })),
      );
      if (result.crisis) {
        setStage({ kind: "crisis" });
        return;
      }
      if (i + 1 < instruments.length) {
        setStage({ kind: "asking", i: i + 1, qi: 0 });
      } else {
        await requestIntakeAnalysis();
        setStage({ kind: "done" });
      }
    } catch (e) {
      setStage({ kind: "error", message: e instanceof Error ? e.message : "Save failed" });
    }
  }

  if (stage.kind === "loading" || stage.kind === "submitting") {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: t.inkSoft }}>{stage.kind === "loading" ? "Loading…" : "Saving…"}</Text>
      </View>
    );
  }

  if (stage.kind === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", padding: spacing(6) }}>
        <Text style={{ color: t.danger }}>{stage.message}</Text>
      </View>
    );
  }

  if (stage.kind === "crisis") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(4) }}
      >
        <Text style={{ color: t.ink, fontSize: 22, fontWeight: "700" }}>
          Thank you for being honest. Let&apos;s get you real support, right now.
        </Text>
        <Text style={{ color: t.inkSoft, lineHeight: 22 }}>
          Some of what you shared tells us you deserve more immediate care than an online intake.
          Your care team has been alerted. Free, confidential help is available 24/7.
        </Text>
        <Pressable
          onPress={() => Linking.openURL("tel:988")}
          style={{ backgroundColor: t.brand, borderRadius: radius.lg, padding: spacing(5), alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>Call or text 988</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL("sms:741741")}
          style={{ borderColor: t.brand, borderWidth: 1.5, borderRadius: radius.lg, padding: spacing(5), alignItems: "center" }}
        >
          <Text style={{ color: t.brand, fontWeight: "700", fontSize: 17 }}>Text HOME to 741741</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (stage.kind === "done") {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", padding: spacing(6), gap: spacing(4) }}>
        <GlassCard>
          <View style={{ alignItems: "center", gap: spacing(3) }}>
            <Icon name="check" size={30} color={t.brand} />
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: "700" }}>Thank you — this really helps.</Text>
            <Text style={{ color: t.inkSoft, textAlign: "center" }}>
              Your responses and an AI-generated summary are shared securely with your provider.
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/care")}
              style={{ backgroundColor: t.brand, borderRadius: radius.pill, paddingVertical: spacing(3), paddingHorizontal: spacing(6), marginTop: spacing(2) }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Continue: verify & coverage</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    );
  }

  const instrument = instruments[stage.i]!;
  const question = instrument.questions[stage.qi]!;
  const progress = before(stage.i, stage.qi);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(4) }}
    >
      <GlassCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing(3) }}>
          <Text style={{ color: t.inkSoft, fontSize: 13 }}>{instrument.title}</Text>
          <Text style={{ color: t.inkSoft, fontSize: 13 }}>
            {progress + 1} of {total}
          </Text>
        </View>
        <View style={{ height: 5, backgroundColor: t.hairline, borderRadius: 999, marginBottom: spacing(4) }}>
          <View
            style={{
              height: 5,
              width: `${Math.round((progress / Math.max(total, 1)) * 100)}%`,
              backgroundColor: t.brand,
              borderRadius: 999,
            }}
          />
        </View>
        {question.helpText ? (
          <Text style={{ color: t.inkSoft, marginBottom: 4 }}>{question.helpText}</Text>
        ) : null}
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: "700", marginBottom: spacing(4) }}>
          {question.prompt}
        </Text>
        <View style={{ gap: spacing(2) }}>
          {question.options.map((option, idx) => (
            <Pressable
              key={option.id}
              onPress={() => void choose(option.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing(3),
                borderWidth: 1.5,
                borderColor: t.hairline,
                borderRadius: radius.md,
                padding: spacing(4),
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  backgroundColor: t.brandTint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: t.brand, fontSize: 12, fontWeight: "700" }}>{idx + 1}</Text>
              </View>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: "500", flex: 1 }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}
