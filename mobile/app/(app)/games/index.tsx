/**
 * Dashboard / home screen — lists the current user's games.
 *
 * Dealer: can create a new game.
 * Anyone: can join via an invite token.
 * Tap a game card to open the game screen.
 */

import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import type { Game } from "@/types/game";

const STATUS_COLOR: Record<string, string> = {
  lobby: "#f0a500",
  active: "#2ecc71",
  closed: "#888888",
};

function GameCard({
  game,
  onPress,
}: {
  game: Game;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {game.title}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: STATUS_COLOR[game.status] ?? "#888" },
          ]}
        >
          <Text style={styles.badgeText}>{game.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {parseFloat(game.chip_cash_rate).toFixed(4)} {game.currency} / chip
      </Text>
    </Pressable>
  );
}

export default function GamesScreen() {
  const router = useRouter();

  const {
    data: games,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.games,
    queryFn: gameService.listGames,
  });

  return (
    <>
      <Stack.Screen options={{ title: "My Games" }} />
      <View style={styles.container}>
        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, styles.btnHalf]}
            onPress={() => router.push("/games/create")}
          >
            <Text style={styles.btnText}>+ Create Game</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnSecondary, styles.btnHalf]}
            onPress={() => router.push("/games/join")}
          >
            <Text style={styles.btnTextSecondary}>Join by Token</Text>
          </Pressable>
        </View>

        {/* Quick links */}
        <View style={styles.quickLinks}>
          <Pressable onPress={() => router.push("/profile")}>
            <Text style={styles.quickLinkText}>My Profile →</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/history")}>
            <Text style={styles.quickLinkText}>History →</Text>
          </Pressable>
        </View>

        {/* Games list */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#e94560"
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Failed to load games</Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
              onPress={() => void refetch()}
            >
              <Text style={styles.btnText}>Retry</Text>
            </Pressable>
          </View>
        ) : games && games.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No games yet.</Text>
            <Text style={styles.emptySubText}>
              Create one or join via an invite token.
            </Text>
          </View>
        ) : (
          <FlatList
            data={games}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => (
              <GameCard
                game={item}
                onPress={() => router.push(`/games/${item.id}`)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnSecondary: { backgroundColor: "#2a2a5a" },
  btnHalf: { flex: 1 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextSecondary: { color: "#ccc", fontSize: 14 },
  quickLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 12,
  },
  quickLinkText: { color: "#888", fontSize: 13 },
  loader: { marginTop: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#ff6b6b", fontSize: 15 },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptySubText: { color: "#888", fontSize: 13, marginTop: 6, textAlign: "center" },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardMeta: { color: "#888", fontSize: 12 },
});
