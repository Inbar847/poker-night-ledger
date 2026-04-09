/**
 * Settlement screen — available to all participants once game is closed.
 *
 * Shows:
 *  - Per-participant balance breakdown (buy-ins, poker result, expense balance, net)
 *  - Optimized transfer list (who pays whom)
 *  - Warning banner if any participant is missing a final stack
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
import * as settlementService from "@/services/settlementService";
import type { ParticipantBalance, Transfer } from "@/types/game";

function fmt(v: string | null | undefined, fallback = "—"): string {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : (n >= 0 ? "+" : "") + n.toFixed(2);
}

function fmtAbs(v: string | null | undefined): string {
  if (v == null) return "—";
  return parseFloat(v).toFixed(2);
}

function BalanceCard({ balance, currency }: { balance: ParticipantBalance; currency: string }) {
  const netColor =
    balance.net_balance == null
      ? "#888"
      : parseFloat(balance.net_balance) >= 0
        ? "#2ecc71"
        : "#e94560";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardName}>{balance.display_name}</Text>
        <Text style={[styles.netBalance, { color: netColor }]}>
          {balance.net_balance != null
            ? `${fmt(balance.net_balance)} ${currency}`
            : "—"}
        </Text>
      </View>

      <View style={styles.cardDetails}>
        <Row
          label="Buy-ins"
          value={`−${fmtAbs(balance.total_buy_ins)} ${currency}`}
          color="#e94560"
        />
        {balance.final_chip_cash_value != null ? (
          <Row
            label="Chip cash value"
            value={`+${fmtAbs(balance.final_chip_cash_value)} ${currency}`}
            color="#2ecc71"
          />
        ) : (
          <Row label="Final chips" value="(missing)" color="#888" />
        )}
        {parseFloat(balance.expense_balance) !== 0 ? (
          <Row
            label="Expense balance"
            value={`${fmt(balance.expense_balance)} ${currency}`}
            color={parseFloat(balance.expense_balance) >= 0 ? "#2ecc71" : "#f0a500"}
          />
        ) : null}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color }]}>{value}</Text>
    </View>
  );
}

function TransferRow({ transfer, currency }: { transfer: Transfer; currency: string }) {
  return (
    <View style={styles.transferRow}>
      <Text style={styles.transferFrom}>{transfer.from_display_name}</Text>
      <Text style={styles.transferArrow}> → </Text>
      <Text style={styles.transferTo}>{transfer.to_display_name}</Text>
      <Text style={styles.transferAmount}>
        {currency} {fmtAbs(transfer.amount)}
      </Text>
    </View>
  );
}

export default function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data: settlement,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.settlement(id),
    queryFn: () => settlementService.getSettlement(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Settlement" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </>
    );
  }

  if (error || !settlement) {
    return (
      <>
        <Stack.Screen options={{ title: "Settlement" }} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load settlement</Text>
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

  const { currency } = settlement;

  return (
    <>
      <Stack.Screen options={{ title: "Settlement" }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        {/* Info bar */}
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>
            Rate: {parseFloat(settlement.chip_cash_rate).toFixed(4)} {currency} / chip
          </Text>
        </View>

        {/* Incomplete warning */}
        {!settlement.is_complete ? (
          <View style={styles.warnBanner}>
            <Text style={styles.warnText}>
              Some participants are missing final chip counts. Settlement is
              incomplete — transfers are not yet available.
            </Text>
          </View>
        ) : null}

        {/* Balances */}
        <Text style={styles.sectionTitle}>Balances</Text>
        {settlement.balances.map((b) => (
          <BalanceCard key={b.participant_id} balance={b} currency={currency} />
        ))}

        {/* Transfers */}
        {settlement.is_complete ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Who Pays Whom
            </Text>
            {settlement.transfers.length === 0 ? (
              <Text style={styles.emptyText}>No transfers needed.</Text>
            ) : (
              settlement.transfers.map((t, i) => (
                <TransferRow key={i} transfer={t} currency={currency} />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

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
  btn: { borderRadius: 8, paddingVertical: 13, alignItems: "center", paddingHorizontal: 24 },
  btnPrimary: { backgroundColor: "#e94560" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  infoBar: {
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoText: { color: "#888", fontSize: 13 },
  warnBanner: {
    backgroundColor: "#4a3000",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warnText: { color: "#f0a500", fontSize: 13 },
  sectionTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  netBalance: { fontSize: 16, fontWeight: "700" },
  cardDetails: { gap: 4 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: { color: "#777", fontSize: 12 },
  detailValue: { fontSize: 12, fontWeight: "500" },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 2,
  },
  transferFrom: { color: "#e94560", fontSize: 14, fontWeight: "600" },
  transferArrow: { color: "#666", fontSize: 14 },
  transferTo: { color: "#2ecc71", fontSize: 14, fontWeight: "600", flex: 1 },
  transferAmount: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyText: { color: "#555", fontSize: 13 },
});
