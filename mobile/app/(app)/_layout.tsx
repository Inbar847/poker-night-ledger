/**
 * Authenticated app shell.
 *
 * Guards all routes in this group:
 *  - While bootstrapping (SecureStore read in progress) → show loading spinner.
 *  - After bootstrap, no access token → redirect to login.
 *  - Authenticated → render children with shared header options (logout button).
 */

import { Redirect, Stack, useRouter } from "expo-router";
import { Pressable, Text, StyleSheet } from "react-native";

import LoadingScreen from "@/components/LoadingScreen";
import { useAuthStore } from "@/store/authStore";

function LogoutButton() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();

  const handleLogout = async () => {
    await clearAuth();
    router.replace("/auth/login");
  };

  return (
    <Pressable onPress={handleLogout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Logout</Text>
    </Pressable>
  );
}

export default function AppLayout() {
  const { isBootstrapped, accessToken } = useAuthStore();

  if (!isBootstrapped) {
    return <LoadingScreen />;
  }

  if (!accessToken) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "bold" },
        contentStyle: { backgroundColor: "#1a1a2e" },
        headerRight: () => <LogoutButton />,
      }}
    />
  );
}

const styles = StyleSheet.create({
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: "#e94560", fontSize: 14, fontWeight: "600" },
});
