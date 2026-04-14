/**
 * Edit Final Stacks screen — dealer-only retroactive editing on closed games.
 *
 * Lists all participants with their current final chip count.
 * Dealer can tap to edit each final stack value.
 * Each edit triggers re-settlement on the backend.
 */

import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useUpdateClosedFinalStack } from "@/features/game-edits/useGameEdits";
import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";
import type { FinalStack, Participant } from "@/types/game";

// ---------------------------------------------------------------------------
// Editable row for a single participant's final stack
// ---------------------------------------------------------------------------

function FinalStackRow({
  participant,
  finalStack,
  currency,
  chipCashRate,
  gameId,
}: {
  participant: Participant;
  finalStack: FinalStack | undefined;
  currency: string;
  chipCashRate: number;
  gameId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [chipsVal, setChipsVal] = useState(
    finalStack ? parseFloat(finalStack.chips_amount).toFixed(0) : "0",
  );
  const updateMutation = useUpdateClosedFinalStack(gameId);

  const cashValue =
    finalStack && chipCashRate > 0
      ? (parseFloat(finalStack.chips_amount) * chipCashRate).toFixed(2)
      : null;

  function handleSave() {
    const chips = parseFloat(chipsVal);
    if (isNaN(chips) || chips < 0) {
      Alert.alert("Invalid", "Chips amount must be 0 or greater");
      return;
    }
    updateMutation.mutate(
      {
        participantId: participant.id,
        data: { chips_amount: chips.toFixed(2) },
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to update"),
      },
    );
  }

  if (editing) {
    return (
      <View style={[styles.card, styles.cardEditing]}>
        <Text style={styles.cardName}>{participant.display_name}</Text>
        <View style={styles.editRow}>
          <Text style={styles.editLabel}>Chips</Text>
          <TextInput
            style={styles.editInput}
            keyboardType="decimal-pad"
            value={chipsVal}
            onChangeText={setChipsVal}
            autoFocus
          />
        </View>
        <View style={styles.editActions}>
          <Pressable
            style={[styles.smallBtn, styles.btnPrimary, updateMutation.isPending && styles.btnDisabled]}
            onPress={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Save</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.smallBtn, styles.btnSecondary]}
            onPress={() => setEditing(false)}
          >
            <Text style={styles.btnTextSecondary}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={styles.card} onPress={() => setEditing(true)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{participant.display_name}</Text>
        <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>
          {finalStack
            ? `${parseFloat(finalStack.chips_amount).toFixed(0)} chips`
            : "No final stack"}
        </Text>
        {cashValue != null ? (
          <Text style={styles.detailTextSub}>
            = {currency} {cashValue}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function EditFinalStacksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: game } = useQuery({
    queryKey: queryKeys.game(id),
    queryFn: () => gameService.getGame(id),
    enabled: !!id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => gameService.getParticipants(id),
    enabled: !!id,
  });

  const { data: finalStacks = [], isLoading } = useQuery({
    queryKey: queryKeys.finalStacks(id),
    queryFn: () => ledgerService.listFinalStacks(id),
    enabled: !!id,
  });

  const chipCashRate = game ? parseFloat(game.chip_cash_rate) : 0;
  const currency = game?.currency ?? "";

  const finalStackMap = Object.fromEntries(
    finalStacks.map((fs) => [fs.participant_id, fs]),
  );

  return (
    <>
      <Stack.Screen options={{ title: "Edit Final Stacks" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Editing final chip counts on a closed game. Each change triggers
              automatic re-settlement and notifies all participants.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#e94560" />
          ) : (
            participants.map((p) => (
              <FinalStackRow
                key={p.id}
                participant={p}
                finalStack={finalStackMap[p.id]}
                currency={currency}
                chipCashRate={chipCashRate}
                gameId={id}
              />
            ))
          )}

          <Pressable
            style={[styles.btn, styles.btnSecondary, { marginTop: 20 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnTextSecondary}>Done</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },
  infoBanner: {
    backgroundColor: "#1a2a1a",
    borderLeftWidth: 3,
    borderLeftColor: "#2ecc71",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: { color: "#8fbc8f", fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardEditing: {
    borderWidth: 1,
    borderColor: "#e94560",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#2a2a5a",
  },
  editBtnText: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  cardDetails: { marginTop: 6 },
  detailText: { color: "#aaa", fontSize: 14 },
  detailTextSub: { color: "#666", fontSize: 12, marginTop: 2 },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  editLabel: { color: "#888", fontSize: 13, width: 50 },
  editInput: {
    flex: 1,
    backgroundColor: "#0f0e17",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },
  editActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallBtn: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnSecondary: { backgroundColor: "#2a2a5a" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextSecondary: { color: "#ccc", fontSize: 14 },
});
