/**
 * History screen — lists the current user's closed games, most recent first.
 *
 * Tap a game card to open the historical settlement detail.
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
import * as statsService from "@/services/statsService";
import type { GameHistoryItem } from "@/types/stats";

function netColor(net: string | null): string {
  if (net == null) return "#888";
  const v = parseFloat(net);
  if (v > 0) return "#2ecc71";
  if (v < 0) return "#e94560";
  return "#aaa";
}

function fmtNet(net: string | null, currency: string): string {
  if (net == null) return "—";
  const v = parseFloat(net);
  const sign = v > 0 ? "+" : "";
  return `${sign}${currency} ${Math.abs(v).toFixed(2)}`;
}

function HistoryCard({
  item,
  onPress,
}: {
  item: GameHistoryItem;
  onPress: () => void;
}) {
  const date = new Date(item.closed_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardNet, { color: netColor(item.net_balance) }]}>
          {fmtNet(item.net_balance, item.currency)}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDate}>{date}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {item.role_in_game.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.cardBuyIn}>
          in: {item.currency} {parseFloat(item.total_buy_ins).toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.history,
    queryFn: statsService.getHistory,
  });

  return (
    <>
      <Stack.Screen options={{ title: "My History" }} />
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#e94560" style={styles.loader} />
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Failed to load history</Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
              onPress={() => void refetch()}
            >
              <Text style={styles.btnText}>Retry</Text>
            </Pressable>
          </View>
        ) : items && items.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No completed games yet.</Text>
            <Text style={styles.emptySubText}>
              Closed games will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(g) => g.game_id}
            renderItem={({ item }) => (
              <HistoryCard
                item={item}
                onPress={() => router.push(`/history/${item.game_id}`)}
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
  loader: { marginTop: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#ff6b6b", fontSize: 15 },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptySubText: {
    color: "#888",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
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
    marginBottom: 6,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  cardNet: { fontSize: 15, fontWeight: "700" },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardDate: { color: "#888", fontSize: 12 },
  roleBadge: {
    backgroundColor: "#2a2a5a",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleBadgeText: { color: "#aaa", fontSize: 10, fontWeight: "700" },
  cardBuyIn: { color: "#666", fontSize: 12 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: "center" },
  btnPrimary: { backgroundColor: "#e94560", paddingHorizontal: 24 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
