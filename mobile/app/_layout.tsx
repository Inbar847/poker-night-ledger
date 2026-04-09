/**
 * Root layout — wraps the entire app.
 *
 * Responsibilities:
 *  1. Provide a QueryClient to all screens via QueryClientProvider.
 *  2. Bootstrap auth once on mount (load tokens from SecureStore).
 *     The auth store sets isBootstrapped=true when done; the (app) layout
 *     shows a loading spinner until then.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";

import { useAuthStore } from "@/store/authStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

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
