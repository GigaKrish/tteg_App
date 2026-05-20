import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import AuthLayout from "../components/AuthLayout";
import AuthInput from "../components/AuthInput";

export default function Login() {
  const router = useRouter();
  const { login, loading, error } = useAuth();

  // State management for form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!email || !password) return;
    login(email, password);
  };

  return (
    <AuthLayout>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require("../assets/images/aroha_logo.png")}
            style={styles.logoAroha}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subText}>Sign in for access</Text>
      </View>

      {/* LOGIN CARD */}
      <View style={styles.card}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <AuthInput
          iconName="email"
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AuthInput
          iconName="lock"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          rightIcon={showPassword ? "eye-off" : "eye"}
          onRightIconPress={() => setShowPassword(!showPassword)}
        />

        <Pressable
          onPress={handleLogin}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </Pressable>
      </View>

      {/* FOOTER SECTION: Restored Support Link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help? </Text>
        <Pressable onPress={() => Linking.openURL("mailto:support@aroha.com")}>
          <Text style={styles.linkText}>Contact Support</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 30 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoAroha: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff', padding: 10 },
  welcomeText: { fontSize: 32, fontWeight: "bold", color: "#fff", textAlign: 'center' },
  subText: { fontSize: 16, color: "#cbd5e1", marginTop: 8, textAlign: 'center' },

  card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, elevation: 10 },
  errorText: { color: "#ef4444", marginBottom: 16, textAlign: "center", fontWeight: "600" },

  button: { backgroundColor: "#0f172a", height: 56, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 8 },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 40, paddingBottom: 30 },
  footerText: { color: "#cbd5e1" },
  linkText: { color: "#34d399", fontWeight: "bold", textDecorationLine: "underline" }
});