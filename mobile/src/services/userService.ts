/**
 * User / profile service.
 *
 * Uses apiClient so Authorization header + token refresh are handled automatically.
 */

import { apiClient } from "@/lib/apiClient";
import type { UpdateProfileRequest, User } from "@/types/user";

/** Fetch the current authenticated user's profile. */
export async function getMe(): Promise<User> {
  return apiClient.get<User>("/users/me");
}

/** Partially update the current user's profile. */
export async function updateMe(data: UpdateProfileRequest): Promise<User> {
  return apiClient.patch<User>("/users/me", data);
}
