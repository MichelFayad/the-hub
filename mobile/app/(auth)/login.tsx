import { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { ApiError } from "../../src/api/client";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    try {
      await login(email, password, mfaCode || undefined);
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "login failed";
      if (/mfa/i.test(message)) setNeedsMfa(true);
      setError(message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {needsMfa && (
        <TextInput
          style={styles.input}
          placeholder="MFA code"
          value={mfaCode}
          onChangeText={setMfaCode}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Log in" onPress={onSubmit} />
      <Link href="/(auth)/register">No account? Register</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
});
