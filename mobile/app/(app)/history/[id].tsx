/**
 * Historical game detail screen.
 *
 * Displays the settlement summary for a single closed game from history.
 * Shows participant balances and the who-pays-whom transfer list.
 * Read-only — no mutations possible on a closed game.
 */

import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { queryKeys } from "@/lib/queryKeys";
import * as statsService from "@/services/statsService";
import type { ParticipantBalance, Transfer } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(val: string | null | undefined): string {
  if (val == null) return "—";
  return parseFloat(val).toFixed(2);
}

function netColor(net: string | null): string {
  if (net == null) return "#888";
  const v = parseFloat(net);
  if (v > 0) return "#2ecc71";
  if (v < 0) return "#e94560";
  return "#aaa";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BalanceCard({
  balance,
  currency,
}: {
  balance: ParticipantBalance;
  currency: string;
}) {
  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceName}>{balance.display_name}</Text>
        <Text
          style={[
            styles.balanceNet,
            { color: netColor(balance.net_balance) },
          ]}
        >
          {balance.net_balance != null
            ? `${parseFloat(balance.net_balance) >= 0 ? "+" : ""}${currency} ${fmt(balance.net_balance)}`
            : "—"}
        </Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Buy-ins</Text>
        <Text style={styles.balanceValue}>
          {currency} {fmt(balance.total_buy_ins)}
        </Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Chip value</Text>
        <Text style={styles.balanceValue}>
          {balance.final_chip_cash_value != null
            ? `${currency} ${fmt(balance.final_chip_cash_value)}`
            : "—"}
        </Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Expense balance</Text>
        <Text style={styles.balanceValue}>
          {currency} {fmt(balance.expense_balance)}
        </Text>
      </View>
    </View>
  );
}

function TransferRow({
  transfer,
  currency,
}: {
  transfer: Transfer;
  currency: string;
}) {
  return (
    <View style={styles.transferRow}>
      <Text style={styles.transferFrom} numberOfLines={1}>
        {transfer.from_display_name}
      </Text>
      <Text style={styles.transferArrow}>→</Text>
      <Text style={styles.transferTo} numberOfLines={1}>
        {transfer.to_display_name}
      </Text>
      <Text style={styles.transferAmount}>
        {currency} {fmt(transfer.amount)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HistoryGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: settlement,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.historyGame(id),
    queryFn: () => statsService.getHistoryGame(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Game Detail" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </>
    );
  }

  if (error || !settlement) {
    return (
      <>
        <Stack.Screen options={{ title: "Game Detail" }} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load game</Text>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
            onPress={() => void refetch()}
          >
            <Text style={styles.btnText}>Retry</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const { currency, balances, transfers, is_complete } = settlement;

  return (
    <>
      <Stack.Screen options={{ title: "Game Detail" }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        {/* Rate info */}
        <Text style={styles.metaText}>
          Chip rate: {parseFloat(settlement.chip_cash_rate).toFixed(4)} {currency} / chip
        </Text>

        {!is_complete ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Settlement incomplete — one or more final stacks are missing.
            </Text>
          </View>
        ) : null}

        {/* Balances */}
        <SectionTitle title="Final Balances" />
        {balances.map((b) => (
          <BalanceCard key={b.participant_id} balance={b} currency={currency} />
        ))}

        {/* Transfers */}
        {is_complete && transfers.length > 0 ? (
          <>
            <SectionTitle title="Transfers" />
            <View style={styles.transfersCard}>
              {transfers.map((t, i) => (
                <TransferRow key={i} transfer={t} currency={currency} />
              ))}
            </View>
          </>
        ) : is_complete && transfers.length === 0 ? (
          <>
            <SectionTitle title="Transfers" />
            <Text style={styles.emptyText}>All balances are settled — no transfers needed.</Text>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: { color: "#ff6b6b", fontSize: 15 },
  metaText: { color: "#888", fontSize: 12, marginBottom: 12 },
  warningBanner: {
    backgroundColor: "#4a3000",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: "#f0a500", fontSize: 13 },
  sectionTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  balanceCard: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  balanceName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  balanceNet: { fontSize: 16, fontWeight: "700" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  balanceLabel: { color: "#888", fontSize: 13 },
  balanceValue: { color: "#ddd", fontSize: 13 },
  transfersCard: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 6,
  },
  transferFrom: { color: "#e94560", fontSize: 13, flex: 1 },
  transferArrow: { color: "#888", fontSize: 13 },
  transferTo: { color: "#2ecc71", fontSize: 13, flex: 1 },
  transferAmount: { color: "#fff", fontSize: 13, fontWeight: "600" },
  emptyText: { color: "#555", fontSize: 13 },
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: "center" },
  btnPrimary: { backgroundColor: "#e94560", paddingHorizontal: 24 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
