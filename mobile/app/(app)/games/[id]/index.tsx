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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "@/lib/apiClient";
import type { Game, MissingFinalStack, ShortageStrategy } from "@/types/game";

import CashoutModal from "@/features/cashout/CashoutModal";
import InviteFriendModal from "@/features/invitations/InviteFriendModal";
import { useGameInvitations } from "@/hooks/useGameInvitations";
import { useGameSocket } from "@/hooks/useGameSocket";
import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";
import * as userService from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
import type { BuyIn, Expense, Participant } from "@/types/game";
import type { GameInvitation } from "@/types/gameInvitation";

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
  // Use integer-cent accumulation to avoid floating-point drift on monetary sums.
  const totalCents = buyIns
    .filter((b) => b.participant_id === participantId)
    .reduce((sum, b) => sum + Math.round(parseFloat(b.cash_amount) * 100), 0);
  return totalCents / 100;
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
        {participant.status === "left_early" ? (
          <Text style={styles.leftEarlyTag}>LEFT EARLY</Text>
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
  canDelete,
  onDelete,
}: {
  expense: Expense;
  currency: string;
  canDelete: boolean;
  onDelete: (expenseId: string) => void;
}) {
  return (
    <View style={styles.ledgerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ledgerName} numberOfLines={1}>
          {expense.title}
        </Text>
      </View>
      <Text style={styles.ledgerAmount}>
        {currency} {fmt(expense.total_amount)}
      </Text>
      {canDelete ? (
        <Pressable
          style={styles.deleteBtn}
          onPress={() =>
            Alert.alert(
              "Delete Expense",
              `Delete "${expense.title}"?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => onDelete(expense.id),
                },
              ],
            )
          }
        >
          <Text style={styles.deleteBtnText}>X</Text>
        </Pressable>
      ) : null}
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
// Shortage modal
// ---------------------------------------------------------------------------

function ShortageModal({
  visible,
  shortageAmount,
  currency,
  isPending,
  onChoose,
  onCancel,
}: {
  visible: boolean;
  shortageAmount: string;
  currency: string;
  isPending: boolean;
  onChoose: (strategy: ShortageStrategy) => void;
  onCancel: () => void;
}) {
  const amt = parseFloat(shortageAmount).toFixed(2);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={shortageStyles.overlay}>
        <View style={shortageStyles.sheet}>
          <Text style={shortageStyles.title}>Settlement Shortage</Text>
          <Text style={shortageStyles.body}>
            There is a shortage of {currency} {amt} in the pot.{"\n"}
            Choose how to distribute it among participants.
          </Text>

          <Pressable
            style={[shortageStyles.option, isPending && shortageStyles.optionDisabled]}
            disabled={isPending}
            onPress={() => onChoose("proportional_winners")}
          >
            <Text style={shortageStyles.optionTitle}>Proportional (recommended)</Text>
            <Text style={shortageStyles.optionDesc}>
              Only winners absorb the shortage, proportional to their winnings.
            </Text>
          </Pressable>

          <Pressable
            style={[shortageStyles.option, isPending && shortageStyles.optionDisabled]}
            disabled={isPending}
            onPress={() => onChoose("equal_all")}
          >
            <Text style={shortageStyles.optionTitle}>Equal split</Text>
            <Text style={shortageStyles.optionDesc}>
              All participants absorb an equal share of the shortage.
            </Text>
          </Pressable>

          <Pressable
            style={shortageStyles.cancelBtn}
            onPress={onCancel}
            disabled={isPending}
          >
            <Text style={shortageStyles.cancelText}>Cancel</Text>
          </Pressable>

          {isPending && (
            <ActivityIndicator color="#e94560" style={{ marginTop: 12 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const shortageStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#16213e",
    borderRadius: 14,
    padding: 24,
    width: "100%",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  body: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  option: {
    backgroundColor: "#1a1a3e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2a2a5a",
  },
  optionDisabled: { opacity: 0.5 },
  optionTitle: {
    color: "#e94560",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  optionDesc: { color: "#888", fontSize: 12, lineHeight: 16 },
  cancelBtn: {
    marginTop: 6,
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: { color: "#666", fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId) ?? "";

  // Live updates
  const { reconnecting } = useGameSocket(id);

  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [shortageModal, setShortageModal] = useState<{
    visible: boolean;
    amount: string;
  }>({ visible: false, amount: "0" });

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

  // Pending invitations for the game lobby (dealer view)
  const { data: pendingInvitations = [] } = useGameInvitations(id);

  // The current user is the dealer if their user_id matches game.dealer_user_id.
  const isDealer = !!(me && game && me.id === game.dealer_user_id);

  // Find the current user's participant record for status checks
  const myParticipant = participants.find((p) => p.user_id === me?.id);
  const canCashOut =
    !isDealer &&
    game?.status === "active" &&
    myParticipant?.status === "active";

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
    mutationFn: (strategy?: ShortageStrategy) =>
      gameService.closeGame(id, strategy),
    onSuccess: (result) => {
      // Game closed successfully — update cache.
      setShortageModal({ visible: false, amount: "0" });
      // The close endpoint may return either GameResponse or
      // ShortageResolutionRequired (union). Only cache if it looks like a Game.
      if ("status" in result && (result as Game).status === "closed") {
        queryClient.setQueryData(queryKeys.game(id), result);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.games(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.game(id) });
    },
    onError: (err) => {
      setShortageModal({ visible: false, amount: "0" });

      // Check for missing final stacks validation error
      if (err instanceof ApiError && err.data?.missing_final_stacks) {
        const missing = err.data.missing_final_stacks as MissingFinalStack[];
        const names = missing.map((m) => m.display_name).join(", ");
        Alert.alert(
          "Cannot Close Game",
          `Missing final chip counts for:\n${names}`,
        );
        return;
      }

      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to close game",
      );
    },
  });

  async function handleCloseGame() {
    Alert.alert(
      "Close Game",
      "Close the game and generate settlement? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: async () => {
            try {
              // Pre-check for shortage using the dedicated preview endpoint.
              // This avoids relying on the close endpoint's union response type.
              const preview = await gameService.getShortagePreview(id);
              if (preview.has_shortage) {
                // Show the strategy modal — do NOT close yet.
                setShortageModal({
                  visible: true,
                  amount: preview.shortage_amount,
                });
              } else {
                // No shortage — close immediately.
                closeMutation.mutate(undefined);
              }
            } catch {
              // If the preview fails, fall back to closing without preview.
              closeMutation.mutate(undefined);
            }
          },
        },
      ],
    );
  }

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

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => ledgerService.deleteExpense(id, expenseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(id) });
    },
    onError: (err) => {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to delete expense",
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

  // Use integer-cent accumulation to avoid floating-point drift
  const totalBuyIns =
    buyIns.reduce((sum, b) => sum + Math.round(parseFloat(b.cash_amount) * 100), 0) / 100;
  const totalExpenses =
    expenses.reduce((sum, e) => sum + Math.round(parseFloat(e.total_amount) * 100), 0) / 100;

  return (
    <>
      <Stack.Screen options={{ title: game.title }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        {/* Reconnecting banner */}
        {reconnecting && (
          <View style={styles.reconnectBanner}>
            <ActivityIndicator size="small" color="#f0a500" />
            <Text style={styles.reconnectText}>Reconnecting to live updates…</Text>
          </View>
        )}

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

        {/* Pending invitations (dealer lobby view) */}
        {isDealer && game.status !== "closed" && pendingInvitations.length > 0 ? (
          <>
            <SectionTitle title="Pending Invitations" />
            {pendingInvitations.map((inv: GameInvitation) => (
              <View key={inv.id} style={styles.participantRow}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {inv.invited_user_display_name}
                  </Text>
                  <Text style={styles.pendingTag}>PENDING</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Dealer: add guest + invite friend */}
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
            <Pressable
              style={[styles.btn, styles.btnSecondary, styles.btnSmall]}
              onPress={() => setShowInviteModal(true)}
            >
              <Text style={styles.btnTextSecondary}>+ Invite Friend</Text>
            </Pressable>
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
              {game.status === "active" &&
              myParticipant?.status === "active" ? (
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
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  currency={game.currency}
                  canDelete={
                    isDealer || e.created_by_user_id === me?.id
                  }
                  onDelete={(eid) => deleteExpenseMutation.mutate(eid)}
                />
              ))
            )}

            {/* Player-only: Cash Out button */}
            {canCashOut ? (
              <View style={styles.actionSection}>
                <Pressable
                  style={[styles.btn, styles.btnDanger]}
                  onPress={() => setShowCashoutModal(true)}
                >
                  <Text style={styles.btnText}>Leave Early / Cash Out</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Player left early — read-only notice */}
            {!isDealer && myParticipant?.status === "left_early" ? (
              <View style={styles.actionSection}>
                <View style={styles.leftEarlyNotice}>
                  <Text style={styles.leftEarlyNoticeText}>
                    You have cashed out. Your result is recorded and will be
                    included in the final settlement.
                  </Text>
                </View>
              </View>
            ) : null}

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
                  onPress={() => void handleCloseGame()}
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
        {/* Closed game — settlement + dealer edit actions                    */}
        {/* ----------------------------------------------------------------- */}
        {game.status === "closed" ? (
          <View style={styles.actionSection}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push(`/games/${id}/settlement`)}
            >
              <Text style={styles.btnText}>View Settlement</Text>
            </Pressable>

            {isDealer ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                  Dealer: Edit Closed Game
                </Text>
                <Pressable
                  style={[styles.btn, styles.btnSecondary, { marginTop: 4 }]}
                  onPress={() => router.push(`/games/${id}/edit-buyins`)}
                >
                  <Text style={styles.btnTextSecondary}>Edit Buy-Ins</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnSecondary, { marginTop: 8 }]}
                  onPress={() => router.push(`/games/${id}/edit-final-stacks`)}
                >
                  <Text style={styles.btnTextSecondary}>Edit Final Stacks</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              style={[styles.btn, styles.btnSecondary, { marginTop: isDealer ? 16 : 10 }]}
              onPress={() => router.push(`/games/${id}/edit-history`)}
            >
              <Text style={styles.btnTextSecondary}>View Edit History</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Shortage resolution modal — shown when closing a game with a shortage */}
      <ShortageModal
        visible={shortageModal.visible}
        shortageAmount={shortageModal.amount}
        currency={game?.currency ?? ""}
        isPending={closeMutation.isPending}
        onChoose={(strategy) => closeMutation.mutate(strategy)}
        onCancel={() => setShortageModal({ visible: false, amount: "0" })}
      />

      {/* Cash out modal — player-only, enter final chip count and leave early */}
      <CashoutModal
        visible={showCashoutModal}
        gameId={id}
        currency={game?.currency ?? ""}
        chipCashRate={game?.chip_cash_rate ?? "0"}
        onSuccess={() => {
          setShowCashoutModal(false);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.participants(id),
          });
        }}
        onClose={() => setShowCashoutModal(false)}
      />

      {/* Invite friend modal — dealer-only, uses friends list + pending invitation model */}
      <InviteFriendModal
        visible={showInviteModal}
        gameId={id}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.gameInvitations(id),
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
  reconnectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2a2000",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  reconnectText: {
    color: "#f0a500",
    fontSize: 13,
  },
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
  pendingTag: {
    color: "#f0a500",
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#f0a500",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  leftEarlyTag: {
    color: "#e67e22",
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#e67e22",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  leftEarlyNotice: {
    backgroundColor: "#1a1a3e",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e67e22",
  },
  leftEarlyNoticeText: {
    color: "#e67e22",
    fontSize: 13,
    lineHeight: 18,
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
  deleteBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#4a1020",
  },
  deleteBtnText: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "700",
  },
});
