import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getSession, signOut } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Icon, type IconName } from "@/lib/icons";
import { radius, spacing, useTheme } from "@/lib/theme";

function NavCard({
  icon,
  title,
  subtitle,
  onPress,
  delay,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  delay: number;
}) {
  const t = useTheme();
  return (
    <GlassCard delay={delay}>
      <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: spacing(3) }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: t.brandTint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={20} color={t.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: t.inkSoft }}>{subtitle}</Text>
        </View>
        <Icon name="chev" size={18} color={t.inkSoft} />
      </Pressable>
    </GlassCard>
  );
}

export default function Home() {
  const t = useTheme();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    getSession().then((s) => {
      if (!s.user) router.replace("/");
      else setName(s.user.name?.split(" ")[0] ?? "");
    });
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: spacing(5), paddingTop: spacing(16), gap: spacing(4) }}
    >
      <Text style={{ color: t.ink, fontSize: 30, fontWeight: "600", letterSpacing: -0.5 }}>
        Good to see you{name ? `, ${name}` : ""}
      </Text>

      <NavCard
        icon="spark"
        title="Your intake"
        subtitle="Complete your health questionnaire →"
        onPress={() => router.push("/(tabs)/intake")}
        delay={0}
      />
      <NavCard
        icon="calendar"
        title="Next appointment"
        subtitle="Book or manage your visits →"
        onPress={() => router.push("/(tabs)/appointments")}
        delay={60}
      />
      <NavCard
        icon="message"
        title="Messages"
        subtitle="Your care team is one message away →"
        onPress={() => router.push("/(tabs)/messages")}
        delay={120}
      />
      <NavCard
        icon="care"
        title="My care"
        subtitle="Verify identity, coverage, and membership →"
        onPress={() => router.push("/(tabs)/care")}
        delay={180}
      />
      <NavCard
        icon="spark"
        title="Companion"
        subtitle="A space to think out loud →"
        onPress={() => router.push("/(tabs)/companion")}
        delay={240}
      />

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
