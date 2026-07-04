import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  listThreads,
  readThread,
  sendMessage,
  type Message,
  type ThreadSummary,
} from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function Messages() {
  const t = useTheme();
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  const loadThreads = useCallback(() => {
    listThreads()
      .then((d) => setThreads(d.threads))
      .catch(() => setThreads([]));
  }, []);
  useEffect(loadThreads, [loadThreads]);

  useEffect(() => {
    if (!active) return;
    const tick = () => readThread(active).then((d) => setMessages(d.messages)).catch(() => {});
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, [active]);

  async function submit() {
    if (!active || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    await sendMessage(active, text).catch(() => {});
    const d = await readThread(active).catch(() => null);
    if (d) setMessages(d.messages);
  }

  if (!active) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(3) }}
      >
        <Text style={{ color: t.ink, fontSize: 30, fontWeight: "600" }}>Messages</Text>
        {threads === null ? (
          <Text style={{ color: t.inkSoft }}>Loading…</Text>
        ) : threads.length === 0 ? (
          <Text style={{ color: t.inkSoft, lineHeight: 22 }}>
            Your care team appears here once you book a visit.
          </Text>
        ) : (
          threads.map((thread) => (
            <Pressable
              key={thread.id}
              onPress={() => setActive(thread.id)}
              style={{
                backgroundColor: t.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.hairline,
                padding: spacing(4),
                gap: 2,
              }}
            >
              <Text style={{ color: t.ink, fontWeight: "600" }}>
                {thread.with}
                {thread.unread ? "  •" : ""}
              </Text>
              {thread.lastMessage ? (
                <Text numberOfLines={1} style={{ color: t.inkSoft, fontSize: 13 }}>
                  {thread.lastMessage.mine ? "You: " : ""}
                  {thread.lastMessage.body}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View style={{ flex: 1, paddingTop: spacing(14) }}>
        <Pressable onPress={() => setActive(null)} style={{ paddingHorizontal: spacing(5) }}>
          <Text style={{ color: t.brand, fontSize: 15 }}>← All conversations</Text>
        </Pressable>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing(5), gap: spacing(2) }}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: m.mine ? "flex-end" : "flex-start",
                maxWidth: "80%",
                backgroundColor: m.mine ? t.brand : t.surface,
                borderRadius: radius.md,
                borderWidth: m.mine ? 0 : 1,
                borderColor: t.hairline,
                paddingHorizontal: spacing(3.5),
                paddingVertical: spacing(2.5),
              }}
            >
              <Text style={{ color: m.mine ? "#fff" : t.ink, fontSize: 15, lineHeight: 21 }}>
                {m.body}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: spacing(2), padding: spacing(4) }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message…"
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
            onPress={submit}
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
