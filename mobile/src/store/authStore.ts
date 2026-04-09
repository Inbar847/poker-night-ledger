/**
 * Auth store — Zustand + expo-secure-store persistence.
 *
 * Holds access + refresh tokens in memory and persists them to the device's
 * secure enclave (iOS Keychain / Android Keystore).
 *
 * `isBootstrapped` starts false and is set to true after the first call to
 * `bootstrap()`. UI guards check this flag to decide whether to show a loading
 * state or redirect.
 */

import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const KEYS = {
  access: "pnl_access_token",
  refresh: "pnl_refresh_token",
} as const;

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isBootstrapped: boolean;

  /** Read tokens from SecureStore and populate the store. Call once on app start. */
  bootstrap: () => Promise<void>;

  /** Persist tokens to SecureStore and update in-memory state. */
  setTokens: (access: string, refresh: string) => Promise<void>;

  /** Remove all auth state from memory and SecureStore. Triggers auth guard redirect. */
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  isBootstrapped: false,

  bootstrap: async () => {
    const access = await SecureStore.getItemAsync(KEYS.access);
    const refresh = await SecureStore.getItemAsync(KEYS.refresh);
    set({
      accessToken: access ?? null,
      refreshToken: refresh ?? null,
      isBootstrapped: true,
    });
  },

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync(KEYS.access, access);
    await SecureStore.setItemAsync(KEYS.refresh, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(KEYS.access);
    await SecureStore.deleteItemAsync(KEYS.refresh);
    set({ accessToken: null, refreshToken: null });
  },
}));
