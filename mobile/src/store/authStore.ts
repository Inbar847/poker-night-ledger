/**
 * Auth store — Zustand + expo-secure-store persistence.
 *
 * Holds access + refresh tokens in memory and persists them to the device's
 * secure enclave (iOS Keychain / Android Keystore).
 *
 * `isBootstrapped` starts false and is set to true after the first call to
 * `bootstrap()`. UI guards check this flag to decide whether to show a loading
 * state or redirect.
 *
 * `userId` is derived from the JWT access token's `sub` claim on every
 * `setTokens()` call. It is used to scope TanStack Query keys so that cached
 * data from one user can never be served to a different user (defence in depth).
 *
 * Cache clearing contract:
 *   `clearAuth()` calls `queryClient.clear()` before wiping tokens, so that
 *   when the next user logs in they always start with an empty cache.
 */

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { queryClient } from "@/lib/queryClient";

const KEYS = {
  access: "pnl_access_token",
  refresh: "pnl_refresh_token",
} as const;

/**
 * Decode the payload of a JWT access token and return the `sub` claim.
 * Returns null if the token is malformed or the claim is missing.
 * Does NOT verify the signature — that is the backend's responsibility.
 */
function extractUserId(token: string): string | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    // base64url → base64
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** String user ID decoded from the JWT `sub` claim. Null when logged out. */
  userId: string | null;
  isBootstrapped: boolean;

  /** Read tokens from SecureStore and populate the store. Call once on app start. */
  bootstrap: () => Promise<void>;

  /** Persist tokens to SecureStore and update in-memory state. */
  setTokens: (access: string, refresh: string) => Promise<void>;

  /**
   * Remove all auth state from memory and SecureStore.
   * Clears the TanStack Query cache FIRST so the next user starts fresh.
   * Triggers auth guard redirect.
   */
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  isBootstrapped: false,

  bootstrap: async () => {
    const access = await SecureStore.getItemAsync(KEYS.access);
    const refresh = await SecureStore.getItemAsync(KEYS.refresh);
    set({
      accessToken: access ?? null,
      refreshToken: refresh ?? null,
      userId: access ? extractUserId(access) : null,
      isBootstrapped: true,
    });
  },

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync(KEYS.access, access);
    await SecureStore.setItemAsync(KEYS.refresh, refresh);
    set({
      accessToken: access,
      refreshToken: refresh,
      userId: extractUserId(access),
    });
  },

  clearAuth: async () => {
    // Clear cache first so the next user never sees stale data from this session.
    queryClient.clear();
    await SecureStore.deleteItemAsync(KEYS.access);
    await SecureStore.deleteItemAsync(KEYS.refresh);
    set({ accessToken: null, refreshToken: null, userId: null });
  },
}));
