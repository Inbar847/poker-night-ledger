/**
 * Centralised TanStack Query key definitions.
 * Import from here so key shape stays consistent across hooks and mutations.
 */
export const queryKeys = {
  /** Current authenticated user */
  me: ["users", "me"] as const,

  /** All games for the current user */
  games: ["games"] as const,

  /** Single game by ID */
  game: (id: string) => ["games", id] as const,

  /** Participants list for a game */
  participants: (gameId: string) => ["games", gameId, "participants"] as const,

  /** Buy-ins list for a game */
  buyIns: (gameId: string) => ["games", gameId, "buy-ins"] as const,

  /** Expenses list for a game */
  expenses: (gameId: string) => ["games", gameId, "expenses"] as const,

  /** Final stacks list for a game */
  finalStacks: (gameId: string) => ["games", gameId, "final-stacks"] as const,

  /** Settlement for a game */
  settlement: (gameId: string) => ["games", gameId, "settlement"] as const,

  /** History list (closed games) */
  history: ["history", "games"] as const,

  /** Settlement detail for one historical game */
  historyGame: (id: string) => ["history", "games", id] as const,

  /** Personal stats for the current user */
  stats: ["stats", "me"] as const,
};
