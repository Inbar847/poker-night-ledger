import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function AuthLayout() {
  const { isBootstrapped, accessToken } = useAuthStore();

  // Already logged in — skip auth screens
  if (isBootstrapped && accessToken) {
    return <Redirect href="/games" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "bold" },
        contentStyle: { backgroundColor: "#1a1a2e" },
      }}
    />
  );
}
