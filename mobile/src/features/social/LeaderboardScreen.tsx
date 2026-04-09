/**
 * LeaderboardScreen — Stage 17.
 *
 * Displays the current user + accepted friends ranked by:
 *   - Default: cumulative net result (descending)
 *   - Toggle: win rate (descending)
 *   - Toggle: games played (descending)
 *
 * Only the authenticated user's own friends are ever visible here.
 * Non-friend data is never leaked: the backend enforces this.
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { queryKeys } from "@/lib/queryKeys";
import * as socialService from "@/services/socialService";
import type { LeaderboardEntry } from "@/services/socialService";

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey = "net" | "win_rate" | "games_played";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "net", label: "Net result" },
  { key: "win_rate", label: "Win rate" },
  { key: "games_played", label: "Games played" },
];

// ---------------------------------------------------------------------------
// Sorting helper
// ---------------------------------------------------------------------------

function sortEntries(
  entries: LeaderboardEntry[],
  sortKey: SortKey
): LeaderboardEntry[] {
  const copy = [...entries];

  copy.sort((a, b) => {
    if (sortKey === "net") {
      const diff =
        parseFloat(b.cumulative_net) - parseFloat(a.cumulative_net);
      if (diff !== 0) return diff;
      const wrDiff = (b.win_rate ?? -1) - (a.win_rate ?? -1);
      if (wrDiff !== 0) return wrDiff;
      return b.total_games_played - a.total_games_played;
    }
    if (sortKey === "win_rate") {
      const wrDiff = (b.win_rate ?? -1) - (a.win_rate ?? -1);
      if (wrDiff !== 0) return wrDiff;
      return (
        parseFloat(b.cumulative_net) - parseFloat(a.cumulative_net)
      );
    }
    // games_played
    const gpDiff = b.total_games_played - a.total_games_played;
    if (gpDiff !== 0) return gpDiff;
    return parseFloat(b.cumulative_net) - parseFloat(a.cumulative_net);
  });

  return copy.map((e, i) => ({ ...e, rank: i + 1 }));
}

// ---------------------------------------------------------------------------
// LeaderboardRow
// ---------------------------------------------------------------------------

function LeaderboardRow({
  entry,
  sortKey,
}: {
  entry: LeaderboardEntry;
  sortKey: SortKey;
}) {
  const router = useRouter();
  const net = parseFloat(entry.cumulative_net);
  const netColor = net > 0 ? "#2ecc71" : net < 0 ? "#e94560" : "#aaa";
  const netSign = net > 0 ? "+" : "";
  const winRateStr =
    entry.win_rate != null
      ? `${(entry.win_rate * 100).toFixed(0)}%`
      : "—";

  const rankColor =
    entry.rank === 1
      ? "#f1c40f"
      : entry.rank === 2
      ? "#aaa"
      : entry.rank === 3
      ? "#cd7f32"
      : "#555";

  const handlePress = () => {
    if (!entry.is_self) {
      router.push(`/public-profile/${entry.user_id}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.row, entry.is_self && styles.selfRow]}
    >
      {/* Rank */}
      <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
        <Text style={styles.rankText}>{entry.rank}</Text>
      </View>

      {/* Avatar */}
      {entry.profile_image_url ? (
        <Image
          source={{ uri: entry.profile_image_url }}
          style={styles.avatar}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>
            {(entry.full_name ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Name + you tag */}
      <View style={styles.nameBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.full_name ?? "Unknown"}
          {entry.is_self ? " (you)" : ""}
        </Text>
        <Text style={styles.subtext}>
          {entry.total_games_played} game
          {entry.total_games_played !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Primary stat for current sort */}
      <View style={styles.statBlock}>
        {sortKey === "net" && (
          <>
            <Text style={[styles.statValue, { color: netColor }]}>
              {entry.games_with_result > 0
                ? `${netSign}${Math.abs(net).toFixed(2)}`
                : "—"}
            </Text>
            <Text style={styles.statLabel}>net</Text>
          </>
        )}
        {sortKey === "win_rate" && (
          <>
            <Text style={styles.statValue}>{winRateStr}</Text>
            <Text style={styles.statLabel}>win rate</Text>
          </>
        )}
        {sortKey === "games_played" && (
          <>
            <Text style={styles.statValue}>{entry.total_games_played}</Text>
            <Text style={styles.statLabel}>played</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LeaderboardScreen() {
  const [sortKey, setSortKey] = useState<SortKey>("net");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: socialService.getLeaderboard,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load leaderboard</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const sorted = sortEntries(data.entries, sortKey);

  return (
    <View style={styles.container}>
      {/* Sort toggle */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[
              styles.sortBtn,
              sortKey === opt.key && styles.sortBtnActive,
            ]}
            onPress={() => setSortKey(opt.key)}
          >
            <Text
              style={[
                styles.sortBtnText,
                sortKey === opt.key && styles.sortBtnTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(e) => e.user_id}
          renderItem={({ item }) => (
            <LeaderboardRow entry={item} sortKey={sortKey} />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      <Text style={styles.privacyNote}>
        Only your accepted friends are included
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: { color: "#ff6b6b", fontSize: 16, marginBottom: 12 },
  retryBtn: {
    backgroundColor: "#e94560",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  emptyText: { color: "#888", fontSize: 15 },

  // Sort toggle
  sortRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#16213e",
    alignItems: "center",
  },
  sortBtnActive: { backgroundColor: "#e94560" },
  sortBtnText: { color: "#888", fontSize: 12 },
  sortBtnTextActive: { color: "#fff", fontWeight: "700" },

  // List
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  selfRow: {
    borderWidth: 1,
    borderColor: "#e94560",
  },

  // Rank badge
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#1a1a2e", fontWeight: "900", fontSize: 13 },

  // Avatar
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // Name block
  nameBlock: { flex: 1 },
  name: { color: "#fff", fontSize: 14, fontWeight: "600" },
  subtext: { color: "#666", fontSize: 11, marginTop: 2 },

  // Stat block
  statBlock: { alignItems: "flex-end" },
  statValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  statLabel: { color: "#666", fontSize: 10, marginTop: 2 },

  // Privacy note
  privacyNote: {
    textAlign: "center",
    color: "#444",
    fontSize: 11,
    paddingBottom: 12,
  },
});
