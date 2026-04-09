/**
 * Root layout — wraps the entire app.
 *
 * Responsibilities:
 *  1. Provide a QueryClient to all screens via QueryClientProvider.
 *  2. Bootstrap auth once on mount (load tokens from SecureStore).
 *     The auth store sets isBootstrapped=true when done; the (app) layout
 *     shows a loading spinner until then.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";

import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";

function AuthBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#1a1a2e" },
        }}
      />
    </QueryClientProvider>
  );
}
