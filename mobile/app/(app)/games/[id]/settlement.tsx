/**
 * Settlement screen — available to all participants once game is closed.
 *
 * Shows:
 *  - Per-participant balance breakdown (buy-ins, poker result, expense balance, net)
 *  - Optimized transfer list (who pays whom)
 *  - Warning banner if any participant is missing a final stack
 */

import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as settlementService from "@/services/settlementService";
import * as userService from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
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
  // Show adjusted_net_balance as the headline (equals net_balance when no shortage)
  const displayNet = balance.adjusted_net_balance ?? balance.net_balance;
  const netColor =
    displayNet == null
      ? "#888"
      : parseFloat(displayNet) >= 0
        ? "#2ecc71"
        : "#e94560";
  const hasShortageShare =
    balance.shortage_share != null && parseFloat(balance.shortage_share) > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardName}>{balance.display_name}</Text>
        <Text style={[styles.netBalance, { color: netColor }]}>
          {displayNet != null ? `${fmt(displayNet)} ${currency}` : "—"}
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
        {hasShortageShare ? (
          <Row
            label="Shortage absorbed"
            value={`−${fmtAbs(balance.shortage_share)} ${currency}`}
            color="#f0a500"
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
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId) ?? "";

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

  const { data: game } = useQuery({
    queryKey: queryKeys.game(id),
    queryFn: () => gameService.getGame(id),
    enabled: !!id,
  });

  const { data: me } = useQuery({
    queryKey: queryKeys.me(userId),
    queryFn: userService.getMe,
  });

  const isDealer = !!(me && game && me.id === game.dealer_user_id);
  const isClosed = game?.status === "closed";

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

        {/* Shortage banner */}
        {parseFloat(settlement.shortage_amount) > 0 ? (
          <View style={styles.shortageBanner}>
            <Text style={styles.shortageTitle}>
              Shortage: {currency} {parseFloat(settlement.shortage_amount).toFixed(2)} absorbed
            </Text>
            <Text style={styles.shortageDesc}>
              Strategy:{" "}
              {settlement.shortage_strategy === "proportional_winners"
                ? "Proportional (winners only)"
                : "Equal split (all participants)"}
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

        {/* Edit actions (closed game) */}
        {isClosed ? (
          <View style={{ marginTop: 24, gap: 8 }}>
            {isDealer ? (
              <>
                <Pressable
                  style={[styles.btn, { backgroundColor: "#2a2a5a" }]}
                  onPress={() => router.push(`/games/${id}/edit-buyins`)}
                >
                  <Text style={{ color: "#ccc", fontSize: 14 }}>Edit Buy-Ins</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: "#2a2a5a" }]}
                  onPress={() => router.push(`/games/${id}/edit-final-stacks`)}
                >
                  <Text style={{ color: "#ccc", fontSize: 14 }}>Edit Final Stacks</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              style={[styles.btn, { backgroundColor: "#2a2a5a" }]}
              onPress={() => router.push(`/games/${id}/edit-history`)}
            >
              <Text style={{ color: "#ccc", fontSize: 14 }}>View Edit History</Text>
            </Pressable>
          </View>
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
  shortageBanner: {
    backgroundColor: "#1a1000",
    borderLeftWidth: 3,
    borderLeftColor: "#f0a500",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  shortageTitle: { color: "#f0a500", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  shortageDesc: { color: "#a07030", fontSize: 12 },
});
