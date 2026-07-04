import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getSession, signOut } from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function Home() {
  const t = useTheme();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    getSession().then((s) => {
      if (!s.user) router.replace("/");
      else setName(s.user.name?.split(" ")[0] ?? "");
    });
  }, []);

  const card = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: t.hairline,
    padding: spacing(5),
    gap: spacing(1),
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(4) }}
    >
      <Text style={{ color: t.ink, fontSize: 30, fontWeight: "600", letterSpacing: -0.5 }}>
        Good to see you{name ? `, ${name}` : ""}
      </Text>

      <Pressable style={card} onPress={() => router.push("/(tabs)/appointments")}>
        <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>Next appointment</Text>
        <Text style={{ color: t.inkSoft }}>Book or manage your visits →</Text>
      </Pressable>
      <Pressable style={card} onPress={() => router.push("/(tabs)/messages")}>
        <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>Messages</Text>
        <Text style={{ color: t.inkSoft }}>Your care team is one message away →</Text>
      </Pressable>
      <Pressable style={card} onPress={() => router.push("/(tabs)/companion")}>
        <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>Companion</Text>
        <Text style={{ color: t.inkSoft }}>A space to think out loud →</Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/");
        }}
        style={{ alignItems: "center", padding: spacing(3) }}
      >
        <Text style={{ color: t.inkSoft }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
