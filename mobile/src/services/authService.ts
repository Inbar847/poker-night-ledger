/**
 * Auth service — login, register, logout.
 *
 * Keeps raw API calls out of components and screens.
 * Does NOT manage token storage — that belongs to authStore.
 */

import { API_URL } from "@/lib/config";
import type { AuthTokens, LoginRequest, RegisterRequest } from "@/types/auth";
import type { User } from "@/types/user";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const parsed = await res.json();
      if (typeof parsed?.detail === "string") detail = parsed.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

/** Authenticate with email + password. Returns access + refresh tokens. */
export async function login(data: LoginRequest): Promise<AuthTokens> {
  return postJson<AuthTokens>("/auth/login", data);
}

/**
 * Register a new account then immediately log in.
 * Returns the registered user — caller must still call login() for tokens.
 */
export async function register(data: RegisterRequest): Promise<User> {
  return postJson<User>("/auth/register", data);
}
