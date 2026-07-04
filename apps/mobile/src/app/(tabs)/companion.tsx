import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { companionTurn, startCompanionSession, ApiError } from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";

interface Turn {
  who: "you" | "companion";
  text: string;
}

/** AI companion — disclosure-first, crisis-aware (docs/06 §B). */
export default function Companion() {
  const t = useTheme();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [crisisMode, setCrisisMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setError(null);
    try {
      const { sessionId: id } = await startCompanionSession();
      setSessionId(id);
      setTurns([
        {
          who: "companion",
          text: "Hi — I'm glad you're here. This is your space to think out loud. What's on your mind?",
        },
      ]);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 403
          ? "Your companion is almost ready — we're finishing clinical review. Your care team is one message away."
          : "Couldn't start a session right now.",
      );
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !sessionId) return;
    setDraft("");
    setTurns((prev) => [...prev, { who: "you", text }]);
    try {
      const res = await companionTurn(sessionId, text);
      setTurns((prev) => [...prev, { who: "companion", text: res.reply }]);
      if (res.crisisMode) setCrisisMode(true);
    } catch {
      setError("Something went wrong — try again.");
    }
  }

  if (!sessionId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          justifyContent: "center",
          padding: spacing(6),
          gap: spacing(3),
        }}
      >
        <Text style={{ color: t.ink, fontSize: 26, fontWeight: "600" }}>Before we start</Text>
        <Text style={{ color: t.inkSoft, lineHeight: 22 }}>
          • I'm an AI companion, not a therapist or doctor — no diagnosis, no medication advice.
          {"\n"}• I'm not for emergencies. In crisis, call or text 988 any time.{"\n"}• What we
          talk about is private to your account.
        </Text>
        {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
        <Pressable
          onPress={begin}
          style={{
            height: 52,
            borderRadius: radius.pill,
            backgroundColor: t.brand,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            I understand — let's talk
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View style={{ flex: 1, paddingTop: spacing(14) }}>
        <Pressable
          onPress={() => Linking.openURL("tel:988")}
          style={{
            marginHorizontal: spacing(5),
            borderRadius: radius.pill,
            backgroundColor: crisisMode ? "rgba(180,72,62,0.12)" : t.brandTint,
            paddingVertical: spacing(2),
            paddingHorizontal: spacing(4),
          }}
        >
          <Text style={{ color: crisisMode ? t.danger : t.brand, fontSize: 12, fontWeight: "600" }}>
            {crisisMode
              ? "Support resources active — tap to call 988"
              : "AI companion · not a clinician · crisis? tap for 988"}
          </Text>
        </Pressable>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing(5), gap: spacing(2) }}
        >
          {turns.map((turn, i) => (
            <View
              key={i}
              style={{
                alignSelf: turn.who === "you" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: turn.who === "you" ? t.brand : t.surface,
                borderRadius: radius.md,
                borderWidth: turn.who === "you" ? 0 : 1,
                borderColor: t.hairline,
                paddingHorizontal: spacing(3.5),
                paddingVertical: spacing(2.5),
              }}
            >
              <Text
                style={{
                  color: turn.who === "you" ? "#fff" : t.ink,
                  fontSize: 15,
                  lineHeight: 22,
                }}
              >
                {turn.text}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing(2), padding: spacing(4) }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Say what's true for you right now…"
            placeholderTextColor={t.inkSoft}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface,
              paddingHorizontal: spacing(4),
              color: t.ink,
            }}
          />
          <Pressable
            onPress={send}
            style={{
              height: 44,
              paddingHorizontal: spacing(5),
              borderRadius: radius.pill,
              backgroundColor: t.brand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
