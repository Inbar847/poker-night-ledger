/**
 * Main game screen — adapts to game status (lobby / active / closed).
 *
 * Lobby:  participant list, dealer can add guests, generate invite link, start game.
 * Active: buy-ins summary, expenses summary, dealer entry buttons, close game.
 * Closed: settlement button, read-only summary.
 *
 * WebSocket is connected the entire time this screen is mounted.
 * Mutations invalidate queries; WebSocket events independently invalidate on
 * updates from other clients, so live updates work for all participants.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import InvitePlayerModal from "@/components/InvitePlayerModal";
import { useGameSocket } from "@/hooks/useGameSocket";
import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";
import * as userService from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
import type { BuyIn, Expense, Participant } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  lobby: "#f0a500",
  active: "#2ecc71",
  closed: "#888888",
};

function fmt(amount: string | null | undefined): string {
  if (amount == null) return "—";
  return parseFloat(amount).toFixed(2);
}

function totalBuyInsForParticipant(
  buyIns: BuyIn[],
  participantId: string,
): number {
  return buyIns
    .filter((b) => b.participant_id === participantId)
    .reduce((sum, b) => sum + parseFloat(b.cash_amount), 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: STATUS_COLOR[status] ?? "#888" },
      ]}
    >
      <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ParticipantRow({
  participant,
  buyInTotal,
  isDealer,
  currency,
}: {
  participant: Participant;
  buyInTotal: number;
  isDealer: boolean;
  currency: string;
}) {
  return (
    <View style={styles.participantRow}>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participant.display_name}</Text>
        {participant.role_in_game === "dealer" ? (
          <Text style={styles.dealerTag}>DEALER</Text>
        ) : null}
        {participant.participant_type === "guest" ? (
          <Text style={styles.guestTag}>GUEST</Text>
        ) : null}
      </View>
      {isDealer && buyInTotal > 0 ? (
        <Text style={styles.participantBuyIn}>
          {currency} {buyInTotal.toFixed(2)}
        </Text>
      ) : null}
    </View>
  );
}

function BuyInRow({
  buyIn,
  participantName,
  currency,
}: {
  buyIn: BuyIn;
  participantName: string;
  currency: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={styles.ledgerName} numberOfLines={1}>
        {participantName}
      </Text>
      <Text style={styles.ledgerMeta}>{buyIn.buy_in_type}</Text>
      <Text style={styles.ledgerAmount}>
        {currency} {fmt(buyIn.cash_amount)}
      </Text>
    </View>
  );
}

function ExpenseRow({
  expense,
  currency,
}: {
  expense: Expense;
  currency: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={styles.ledgerName} numberOfLines={1}>
        {expense.title}
      </Text>
      <Text style={styles.ledgerAmount}>
        {currency} {fmt(expense.total_amount)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add guest inline form
// ---------------------------------------------------------------------------

function AddGuestForm({
  gameId,
  onDone,
}: {
  gameId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => gameService.addGuest(gameId, name.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.participants(gameId),
      });
      setName("");
      onDone();
    },
  });

  return (
    <View style={styles.inlineForm}>
      <TextInput
        style={styles.inlineInput}
        placeholder="Guest name"
        placeholderTextColor="#555"
        value={name}
        onChangeText={setName}
      />
      <Pressable
        style={[
          styles.inlineBtn,
          styles.btnPrimary,
          (!name.trim() || mutation.isPending) && styles.btnDisabled,
        ]}
        onPress={() => mutation.mutate()}
        disabled={!name.trim() || mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Add</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.inlineBtn, styles.btnSecondary]}
        onPress={onDone}
      >
        <Text style={styles.btnTextSecondary}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId) ?? "";

  // Live updates
  useGameSocket(id);

  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Queries
  const {
    data: game,
    isLoading: gameLoading,
    error: gameError,
    refetch: refetchGame,
  } = useQuery({
    queryKey: queryKeys.game(id),
    queryFn: () => gameService.getGame(id),
    enabled: !!id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => gameService.getParticipants(id),
    enabled: !!id,
  });

  const { data: buyIns = [] } = useQuery({
    queryKey: queryKeys.buyIns(id),
    queryFn: () => ledgerService.listBuyIns(id),
    enabled: !!id && game?.status === "active",
  });

  const { data: expenses = [] } = useQuery({
    queryKey: queryKeys.expenses(id),
    queryFn: () => ledgerService.listExpenses(id),
    enabled: !!id && game?.status === "active",
  });

  // Fetch current user to determine if they are the dealer for this game.
  // TanStack Query will serve from cache if warm or refetch from network if not —
  // so dealer detection is always correct regardless of navigation order.
  const { data: me } = useQuery({
    queryKey: queryKeys.me(userId),
    queryFn: userService.getMe,
  });

  // The current user is the dealer if their user_id matches game.dealer_user_id.
  const isDealer = !!(me && game && me.id === game.dealer_user_id);

  // Build a map of participant id → display_name for quick lookup in buy-in rows
  const participantMap = Object.fromEntries(
    participants.map((p) => [p.id, p.display_name]),
  );

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const startMutation = useMutation({
    mutationFn: () => gameService.startGame(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.game(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games(userId) });
    },
    onError: (err) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to start game",
      );
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => gameService.closeGame(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.game(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games(userId) });
    },
    onError: (err) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to close game",
      );
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => gameService.generateInviteLink(id),
    onSuccess: (data) => {
      Alert.alert(
        "Invite Token",
        data.invite_token,
        [{ text: "OK" }],
      );
    },
    onError: (err) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to generate invite link",
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (gameLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Game" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </>
    );
  }

  if (gameError || !game) {
    return (
      <>
        <Stack.Screen options={{ title: "Game" }} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load game</Text>
          <Pressable
            style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
            onPress={() => void refetchGame()}
          >
            <Text style={styles.btnText}>Retry</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Determine if I am the dealer by finding my participant record.
  // Since we don't have a separate /users/me query here, we use dealer_user_id.
  // The flag isDealer is correct as long as the current user is the dealer —
  // non-dealer users will have isDealer=false and see read-only UI.
  // ---------------------------------------------------------------------------

  const totalBuyIns = buyIns.reduce(
    (sum, b) => sum + parseFloat(b.cash_amount),
    0,
  );
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + parseFloat(e.total_amount),
    0,
  );

  return (
    <>
      <Stack.Screen options={{ title: game.title }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        {/* Game header */}
        <View style={styles.gameHeader}>
          <StatusBadge status={game.status} />
          <Text style={styles.chipRate}>
            {parseFloat(game.chip_cash_rate).toFixed(4)} {game.currency} / chip
          </Text>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* Participants section                                               */}
        {/* ----------------------------------------------------------------- */}
        <SectionTitle title="Participants" />
        {participants.length === 0 ? (
          <Text style={styles.emptyText}>No participants yet.</Text>
        ) : (
          participants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              buyInTotal={totalBuyInsForParticipant(buyIns, p.id)}
              isDealer={game.status === "active"}
              currency={game.currency}
            />
          ))
        )}

        {/* Dealer: add guest + invite registered user */}
        {isDealer && game.status !== "closed" ? (
          <>
            {showAddGuest ? (
              <AddGuestForm
                gameId={id}
                onDone={() => setShowAddGuest(false)}
              />
            ) : (
              <Pressable
                style={[styles.btn, styles.btnSecondary, styles.btnSmall]}
                onPress={() => setShowAddGuest(true)}
              >
                <Text style={styles.btnTextSecondary}>+ Add Guest</Text>
              </Pressable>
            )}
            {game.status === "lobby" && (
              <Pressable
                style={[styles.btn, styles.btnSecondary, styles.btnSmall]}
                onPress={() => setShowInviteModal(true)}
              >
                <Text style={styles.btnTextSecondary}>+ Invite Player</Text>
              </Pressable>
            )}
          </>
        ) : null}

        {/* ----------------------------------------------------------------- */}
        {/* Lobby actions                                                      */}
        {/* ----------------------------------------------------------------- */}
        {game.status === "lobby" && isDealer ? (
          <View style={styles.actionSection}>
            <SectionTitle title="Dealer Actions" />

            <Pressable
              style={[
                styles.btn,
                styles.btnSecondary,
                inviteMutation.isPending && styles.btnDisabled,
              ]}
              onPress={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator color="#ccc" size="small" />
              ) : (
                <Text style={styles.btnTextSecondary}>Generate Invite Token</Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                { marginTop: 10 },
                startMutation.isPending && styles.btnDisabled,
              ]}
              onPress={() => {
                Alert.alert("Start Game", "Start the game now?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Start",
                    onPress: () => startMutation.mutate(),
                  },
                ]);
              }}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Start Game</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* ----------------------------------------------------------------- */}
        {/* Active game — buy-ins                                              */}
        {/* ----------------------------------------------------------------- */}
        {game.status === "active" ? (
          <>
            <View style={styles.sectionHeader}>
              <SectionTitle title={`Buy-ins  (${game.currency} ${totalBuyIns.toFixed(2)})`} />
              {isDealer ? (
                <Pressable
                  style={styles.addBtn}
                  onPress={() => router.push(`/games/${id}/buy-in`)}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              ) : null}
            </View>
            {buyIns.length === 0 ? (
              <Text style={styles.emptyText}>No buy-ins yet.</Text>
            ) : (
              buyIns.map((b) => (
                <BuyInRow
                  key={b.id}
                  buyIn={b}
                  participantName={
                    participantMap[b.participant_id] ?? "Unknown"
                  }
                  currency={game.currency}
                />
              ))
            )}

            {/* Active game — expenses */}
            <View style={styles.sectionHeader}>
              <SectionTitle
                title={`Expenses  (${game.currency} ${totalExpenses.toFixed(2)})`}
              />
              {isDealer ? (
                <Pressable
                  style={styles.addBtn}
                  onPress={() => router.push(`/games/${id}/expense`)}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              ) : null}
            </View>
            {expenses.length === 0 ? (
              <Text style={styles.emptyText}>No expenses yet.</Text>
            ) : (
              expenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} currency={game.currency} />
              ))
            )}

            {/* Dealer-only active actions */}
            {isDealer ? (
              <View style={styles.actionSection}>
                <SectionTitle title="Dealer Actions" />
                <Pressable
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => router.push(`/games/${id}/final-stacks`)}
                >
                  <Text style={styles.btnTextSecondary}>
                    Enter Final Chip Counts
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.btn,
                    styles.btnDanger,
                    { marginTop: 10 },
                    closeMutation.isPending && styles.btnDisabled,
                  ]}
                  onPress={() => {
                    Alert.alert(
                      "Close Game",
                      "Close the game and generate settlement? This cannot be undone.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Close",
                          style: "destructive",
                          onPress: () => closeMutation.mutate(),
                        },
                      ],
                    );
                  }}
                  disabled={closeMutation.isPending}
                >
                  {closeMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnText}>Close Game</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {/* ----------------------------------------------------------------- */}
        {/* Closed game — settlement button                                   */}
        {/* ----------------------------------------------------------------- */}
        {game.status === "closed" ? (
          <View style={styles.actionSection}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push(`/games/${id}/settlement`)}
            >
              <Text style={styles.btnText}>View Settlement</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Invite registered player modal — dealer-only, lobby only */}
      <InvitePlayerModal
        visible={showInviteModal}
        gameId={id}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.participants(id),
          });
          setShowInviteModal(false);
        }}
        onClose={() => setShowInviteModal(false)}
      />
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
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  chipRate: { color: "#888", fontSize: 13 },
  sectionTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#2a2a5a",
  },
  addBtnText: { color: "#e94560", fontSize: 13, fontWeight: "600" },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a3e",
  },
  participantInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  participantName: { color: "#fff", fontSize: 14 },
  dealerTag: {
    color: "#f0a500",
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#f0a500",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  guestTag: {
    color: "#888",
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  participantBuyIn: { color: "#2ecc71", fontSize: 13, fontWeight: "600" },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a3e",
    gap: 6,
  },
  ledgerName: { color: "#ddd", fontSize: 13, flex: 1 },
  ledgerMeta: { color: "#666", fontSize: 11 },
  ledgerAmount: { color: "#fff", fontSize: 13, fontWeight: "500" },
  emptyText: { color: "#555", fontSize: 13, marginBottom: 8 },
  actionSection: { marginTop: 24, gap: 0 },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 0,
  },
  btnSmall: { paddingVertical: 9, marginTop: 8 },
  btnPrimary: { backgroundColor: "#e94560" },
  btnSecondary: { backgroundColor: "#2a2a5a" },
  btnDanger: { backgroundColor: "#8b0000" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextSecondary: { color: "#ccc", fontSize: 14 },
  inlineForm: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  inlineInput: {
    flex: 1,
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#fff",
    fontSize: 14,
  },
  inlineBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
  },
});
