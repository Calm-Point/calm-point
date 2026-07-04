import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { completeSignIn, getSession, signIn } from "@/lib/api";
import { radius, spacing, useTheme } from "@/lib/theme";

/** Welcome + sign-in. Design language: docs/07 (Calm Glass, springs, warmth). */
export default function Welcome() {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SplashScreen.hideAsync();
    getSession().then((s) => {
      if (s.user) router.replace("/(tabs)");
    });
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!mfaStep) {
        const result = await signIn(email.trim(), password);
        if (result.mfaRequired) {
          setMfaStep(true);
          return;
        }
      } else {
        await completeSignIn(email.trim(), password, totp);
      }
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.hairline,
    backgroundColor: t.surface,
    paddingHorizontal: spacing(4),
    fontSize: 16,
    color: t.ink,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: spacing(6), gap: spacing(3) }}>
        <Text
          style={{
            color: t.brand,
            fontSize: 13,
            fontWeight: "600",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Calm Point
        </Text>
        <Text style={{ color: t.ink, fontSize: 34, fontWeight: "600", letterSpacing: -0.5 }}>
          Care that meets you where you are
        </Text>
        <Text style={{ color: t.inkSoft, fontSize: 16, lineHeight: 24, marginBottom: spacing(4) }}>
          Video visits, secure messages, and support between appointments.
        </Text>

        {!mfaStep ? (
          <>
            <TextInput
              placeholder="Email"
              placeholderTextColor={t.inkSoft}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={t.inkSoft}
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              style={inputStyle}
            />
          </>
        ) : (
          <TextInput
            placeholder="6-digit authenticator code"
            placeholderTextColor={t.inkSoft}
            keyboardType="number-pad"
            maxLength={6}
            value={totp}
            onChangeText={setTotp}
            style={inputStyle}
          />
        )}
        {error ? <Text style={{ color: t.danger, fontSize: 14 }}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.pill,
            backgroundColor: t.brand,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {mfaStep ? "Verify" : "Sign in"}
            </Text>
          )}
        </Pressable>

        <Text style={{ color: t.inkSoft, fontSize: 12, textAlign: "center", marginTop: spacing(2) }}>
          In crisis? Call or text 988 — available 24/7.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
