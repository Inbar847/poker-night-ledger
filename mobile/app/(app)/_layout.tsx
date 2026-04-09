/**
 * Authenticated app shell.
 *
 * Guards all routes in this group:
 *  - While bootstrapping (SecureStore read in progress) → show loading spinner.
 *  - After bootstrap, no access token → redirect to login.
 *  - Authenticated → render children with shared header options (logout button).
 */

import { Redirect, Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import LoadingScreen from "@/components/LoadingScreen";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useAuthStore } from "@/store/authStore";

function NotificationsBell() {
  const router = useRouter();
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      style={styles.bellBtn}
    >
      <Text style={styles.bellText}>Notifs</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

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

function SearchButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/search")}
      style={styles.searchBtn}
      accessibilityLabel="Search for players"
    >
      <Text style={styles.searchIcon}>🔍</Text>
    </Pressable>
  );
}

function HeaderRight() {
  return (
    <View style={styles.headerRight}>
      <SearchButton />
      <NotificationsBell />
      <LogoutButton />
    </View>
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
        headerRight: () => <HeaderRight />,
      }}
    />
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bellBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  bellText: { color: "#ccc", fontSize: 14 },
  badge: {
    backgroundColor: "#e94560",
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: "#e94560", fontSize: 14, fontWeight: "600" },
  searchBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  searchIcon: { fontSize: 18 },
});
