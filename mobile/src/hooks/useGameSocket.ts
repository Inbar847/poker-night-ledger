/**
 * WebSocket hook for real-time game room updates.
 *
 * Connects to ws://<host>/ws/games/{gameId}?token=<access_token>
 * and invalidates the relevant TanStack Query caches when events arrive.
 *
 * Reconnect contract (per Stage 5 docs):
 *   Events are NOT replayed on reconnect. If the hook unmounts and remounts,
 *   callers should re-fetch game state via the REST API (TanStack Query does
 *   this automatically when the component remounts, unless the cache is fresh).
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { WS_URL } from "@/lib/config";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";

export function useGameSocket(gameId: string): void {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken || !gameId) return;

    const url = `${WS_URL}/ws/games/${gameId}?token=${accessToken}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string };
        const { type } = msg;

        if (
          type === "game.participant_joined" ||
          type === "game.started" ||
          type === "game.closed"
        ) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.game(gameId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.participants(gameId),
          });
        }

        if (
          type === "buyin.created" ||
          type === "buyin.updated" ||
          type === "buyin.deleted"
        ) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.buyIns(gameId),
          });
        }

        if (
          type === "expense.created" ||
          type === "expense.updated" ||
          type === "expense.deleted"
        ) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.expenses(gameId),
          });
        }

        if (type === "final_stack.updated") {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.finalStacks(gameId),
          });
        }

        if (type === "settlement.updated") {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.settlement(gameId),
          });
          // Also refresh game status so "closed" state is visible immediately
          void queryClient.invalidateQueries({
            queryKey: queryKeys.game(gameId),
          });
        }
      } catch {
        // Ignore parse errors — server may send control messages
      }
    };

    // Silently ignore errors; the component shows stale data until reconnect
    ws.onerror = () => undefined;

    return () => {
      ws.close();
    };
  }, [accessToken, gameId, queryClient]);
}
