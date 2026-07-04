import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useTheme } from "@/lib/theme";

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
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
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabGlyph glyph="●" color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Visits",
          tabBarIcon: ({ color }) => <TabGlyph glyph="◐" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <TabGlyph glyph="◒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="companion"
        options={{
          title: "Companion",
          tabBarIcon: ({ color }) => <TabGlyph glyph="◍" color={color} />,
        }}
      />
    </Tabs>
  );
}
