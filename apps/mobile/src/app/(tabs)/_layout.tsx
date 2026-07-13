import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "@/lib/icons";

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} size={23} color={String(color)} />;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.inkSoft,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.hairline },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="intake"
        options={{ title: "Intake", tabBarIcon: ({ color }) => <TabIcon name="spark" color={color} /> }}
      />
      <Tabs.Screen
        name="appointments"
        options={{ title: "Visits", tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarIcon: ({ color }) => <TabIcon name="message" color={color} /> }}
      />
      <Tabs.Screen
        name="companion"
        options={{ title: "Companion", tabBarIcon: ({ color }) => <TabIcon name="spark" color={color} /> }}
      />
      <Tabs.Screen
        name="care"
        options={{ title: "Care", tabBarIcon: ({ color }) => <TabIcon name="care" color={color} /> }}
      />
    </Tabs>
  );
}
