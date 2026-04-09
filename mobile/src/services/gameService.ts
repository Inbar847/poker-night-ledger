/**
 * Game service — API calls for games and participants.
 * Keeps raw fetch logic out of screens.
 */

import { apiClient } from "@/lib/apiClient";
import type {
  CreateGameRequest,
  Game,
  Participant,
} from "@/types/game";

export async function listGames(): Promise<Game[]> {
  return apiClient.get<Game[]>("/games");
}

export async function getGame(gameId: string): Promise<Game> {
  return apiClient.get<Game>(`/games/${gameId}`);
}

export async function createGame(data: CreateGameRequest): Promise<Game> {
  return apiClient.post<Game>("/games", data);
}

export async function startGame(gameId: string): Promise<Game> {
  return apiClient.post<Game>(`/games/${gameId}/start`);
}

export async function closeGame(gameId: string): Promise<Game> {
  return apiClient.post<Game>(`/games/${gameId}/close`);
}

export async function getParticipants(gameId: string): Promise<Participant[]> {
  return apiClient.get<Participant[]>(`/games/${gameId}/participants`);
}

export async function joinByToken(token: string): Promise<Participant> {
  return apiClient.post<Participant>("/games/join-by-token", { token });
}

export async function generateInviteLink(
  gameId: string,
): Promise<{ game_id: string; invite_token: string }> {
  return apiClient.post<{ game_id: string; invite_token: string }>(
    `/games/${gameId}/invite-link`,
  );
}

export async function addGuest(
  gameId: string,
  guest_name: string,
): Promise<Participant> {
  return apiClient.post<Participant>(`/games/${gameId}/guests`, { guest_name });
}
