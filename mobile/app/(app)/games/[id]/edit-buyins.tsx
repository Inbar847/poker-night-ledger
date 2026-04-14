/**
 * Edit Buy-Ins screen — dealer-only retroactive editing of buy-ins on closed games.
 *
 * Lists all existing buy-ins with edit/delete options.
 * Provides an "Add Buy-In" form at the bottom.
 * Each edit triggers re-settlement on the backend.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { z } from "zod";

import {
  useCreateClosedBuyIn,
  useDeleteClosedBuyIn,
  useUpdateClosedBuyIn,
} from "@/features/game-edits/useGameEdits";
import { cashToChips, chipsToCash } from "@/lib/buyInAutofill";
import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";
import type { BuyIn, BuyInType, Participant } from "@/types/game";

// ---------------------------------------------------------------------------
// Inline edit form for a single buy-in
// ---------------------------------------------------------------------------

function EditBuyInRow({
  buyIn,
  participantName,
  currency,
  chipCashRate,
  gameId,
}: {
  buyIn: BuyIn;
  participantName: string;
  currency: string;
  chipCashRate: number;
  gameId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [cashVal, setCashVal] = useState(parseFloat(buyIn.cash_amount).toFixed(2));
  const [chipsVal, setChipsVal] = useState(parseFloat(buyIn.chips_amount).toFixed(2));

  const updateMutation = useUpdateClosedBuyIn(gameId);
  const deleteMutation = useDeleteClosedBuyIn(gameId);

  function handleCashChange(v: string) {
    setCashVal(v);
    if (chipCashRate > 0) {
      const cash = parseFloat(v);
      if (!isNaN(cash) && cash > 0) {
        setChipsVal(String(cashToChips(cash, chipCashRate)));
      }
    }
  }

  function handleChipsChange(v: string) {
    setChipsVal(v);
    if (chipCashRate > 0) {
      const chips = parseFloat(v);
      if (!isNaN(chips) && chips >= 0) {
        setCashVal(chipsToCash(chips, chipCashRate).toFixed(2));
      }
    }
  }

  function handleSave() {
    const cash = parseFloat(cashVal);
    const chips = parseFloat(chipsVal);
    if (isNaN(cash) || cash <= 0) {
      Alert.alert("Invalid", "Cash amount must be greater than 0");
      return;
    }
    if (isNaN(chips) || chips < 0) {
      Alert.alert("Invalid", "Chips amount must be 0 or greater");
      return;
    }
    updateMutation.mutate(
      {
        buyInId: buyIn.id,
        data: {
          cash_amount: cash.toFixed(2),
          chips_amount: chips.toFixed(2),
        },
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to update"),
      },
    );
  }

  function handleDelete() {
    Alert.alert(
      "Delete Buy-In",
      `Delete ${participantName}'s ${buyIn.buy_in_type} buy-in of ${currency} ${parseFloat(buyIn.cash_amount).toFixed(2)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(buyIn.id, {
              onError: (err) =>
                Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete"),
            }),
        },
      ],
    );
  }

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  if (editing) {
    return (
      <View style={styles.editCard}>
        <Text style={styles.editCardTitle}>
          {participantName} — {buyIn.buy_in_type}
        </Text>
        <View style={styles.editRow}>
          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Cash ({currency})</Text>
            <TextInput
              style={styles.editInput}
              keyboardType="decimal-pad"
              value={cashVal}
              onChangeText={handleCashChange}
            />
          </View>
          <View style={styles.editField}>
            <Text style={styles.editFieldLabel}>Chips</Text>
            <TextInput
              style={styles.editInput}
              keyboardType="decimal-pad"
              value={chipsVal}
              onChangeText={handleChipsChange}
            />
          </View>
        </View>
        <View style={styles.editActions}>
          <Pressable
            style={[styles.smallBtn, styles.btnPrimary, isPending && styles.btnDisabled]}
            onPress={handleSave}
            disabled={isPending}
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
    <View style={styles.buyInRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.buyInName}>
          {participantName}
          <Text style={styles.buyInMeta}> ({buyIn.buy_in_type})</Text>
        </Text>
        <Text style={styles.buyInAmount}>
          {currency} {parseFloat(buyIn.cash_amount).toFixed(2)} — {parseFloat(buyIn.chips_amount).toFixed(0)} chips
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable style={styles.actionBtn} onPress={() => setEditing(true)}>
          <Text style={styles.actionBtnText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnDanger]}
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Text style={styles.actionBtnTextDanger}>Del</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add new buy-in form
// ---------------------------------------------------------------------------

const addSchema = z.object({
  cash_amount: z
    .string()
    .min(1, "Required")
    .refine((v) => parseFloat(v) > 0, "Must be > 0"),
  chips_amount: z
    .string()
    .min(1, "Required")
    .refine((v) => parseFloat(v) >= 0, "Must be >= 0"),
});

type AddFormValues = z.infer<typeof addSchema>;

const BUY_IN_TYPES: BuyInType[] = ["initial", "rebuy", "addon"];

function AddBuyInForm({
  gameId,
  participants,
  chipCashRate,
}: {
  gameId: string;
  participants: Participant[];
  chipCashRate: number;
}) {
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [buyInType, setBuyInType] = useState<BuyInType>("rebuy");
  const createMutation = useCreateClosedBuyIn(gameId);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { cash_amount: "", chips_amount: "" },
  });

  const cashAmount = watch("cash_amount");
  const chipsAmount = watch("chips_amount");

  function handleCashChange(v: string) {
    setValue("cash_amount", v, { shouldValidate: true });
    if (chipCashRate > 0) {
      const cash = parseFloat(v);
      if (!isNaN(cash) && cash > 0) {
        setValue("chips_amount", String(cashToChips(cash, chipCashRate)), {
          shouldValidate: true,
        });
      }
    }
  }

  function handleChipsChange(v: string) {
    setValue("chips_amount", v, { shouldValidate: true });
    if (chipCashRate > 0) {
      const chips = parseFloat(v);
      if (!isNaN(chips) && chips >= 0) {
        setValue("cash_amount", chipsToCash(chips, chipCashRate).toFixed(2), {
          shouldValidate: true,
        });
      }
    }
  }

  function onSubmit(values: AddFormValues) {
    if (!selectedParticipant) return;
    createMutation.mutate(
      {
        participant_id: selectedParticipant,
        cash_amount: parseFloat(values.cash_amount).toFixed(2),
        chips_amount: parseFloat(values.chips_amount).toFixed(2),
        buy_in_type: buyInType,
      },
      {
        onSuccess: () => {
          reset();
          setSelectedParticipant(null);
        },
        onError: (err) =>
          Alert.alert("Error", err instanceof Error ? err.message : "Failed to add buy-in"),
      },
    );
  }

  return (
    <View style={styles.addSection}>
      <Text style={styles.sectionTitle}>Add Buy-In</Text>

      <Text style={styles.label}>Participant</Text>
      <View style={styles.chipRow}>
        {participants.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, selectedParticipant === p.id && styles.chipSelected]}
            onPress={() => setSelectedParticipant(p.id)}
          >
            <Text
              style={[styles.chipText, selectedParticipant === p.id && styles.chipTextSelected]}
            >
              {p.display_name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 12 }]}>Type</Text>
      <View style={styles.chipRow}>
        {BUY_IN_TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, buyInType === t && styles.chipSelected]}
            onPress={() => setBuyInType(t)}
          >
            <Text style={[styles.chipText, buyInType === t && styles.chipTextSelected]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.editRow}>
        <View style={styles.editField}>
          <Text style={styles.editFieldLabel}>Cash</Text>
          <TextInput
            style={[styles.editInput, errors.cash_amount && styles.inputError]}
            keyboardType="decimal-pad"
            placeholder="50.00"
            placeholderTextColor="#555"
            value={cashAmount}
            onChangeText={handleCashChange}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.editFieldLabel}>Chips</Text>
          <TextInput
            style={[styles.editInput, errors.chips_amount && styles.inputError]}
            keyboardType="decimal-pad"
            placeholder="5000"
            placeholderTextColor="#555"
            value={chipsAmount}
            onChangeText={handleChipsChange}
          />
        </View>
      </View>

      <Pressable
        style={[
          styles.btn,
          styles.btnPrimary,
          (!selectedParticipant || createMutation.isPending) && styles.btnDisabled,
        ]}
        onPress={handleSubmit(onSubmit)}
        disabled={!selectedParticipant || createMutation.isPending}
      >
        {createMutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Add Buy-In</Text>
        )}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function EditBuyInsScreen() {
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

  const { data: buyIns = [], isLoading } = useQuery({
    queryKey: queryKeys.buyIns(id),
    queryFn: () => ledgerService.listBuyIns(id),
    enabled: !!id,
  });

  const participantMap = Object.fromEntries(
    participants.map((p) => [p.id, p.display_name]),
  );

  const chipCashRate = game ? parseFloat(game.chip_cash_rate) : 0;
  const currency = game?.currency ?? "";

  return (
    <>
      <Stack.Screen options={{ title: "Edit Buy-Ins" }} />
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
              Editing buy-ins on a closed game. Each change triggers automatic
              re-settlement and notifies all participants.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Existing Buy-Ins</Text>

          {isLoading ? (
            <ActivityIndicator color="#e94560" />
          ) : buyIns.length === 0 ? (
            <Text style={styles.emptyText}>No buy-ins recorded.</Text>
          ) : (
            buyIns.map((b) => (
              <EditBuyInRow
                key={b.id}
                buyIn={b}
                participantName={participantMap[b.participant_id] ?? "Unknown"}
                currency={currency}
                chipCashRate={chipCashRate}
                gameId={id}
              />
            ))
          )}

          <AddBuyInForm
            gameId={id}
            participants={participants}
            chipCashRate={chipCashRate}
          />

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
  sectionTitle: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  emptyText: { color: "#555", fontSize: 13, marginBottom: 12 },
  buyInRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  buyInName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  buyInMeta: { color: "#888", fontSize: 12, fontWeight: "400" },
  buyInAmount: { color: "#aaa", fontSize: 13, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2a2a5a",
  },
  actionBtnDanger: { backgroundColor: "#4a1020" },
  actionBtnText: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  actionBtnTextDanger: { color: "#ff6b6b", fontSize: 12, fontWeight: "600" },
  editCard: {
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e94560",
  },
  editCardTitle: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  editRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  editField: { flex: 1 },
  editFieldLabel: { color: "#888", fontSize: 12, marginBottom: 4 },
  editInput: {
    backgroundColor: "#0f0e17",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },
  inputError: { borderColor: "#e94560" },
  editActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallBtn: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  addSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#1a1a3e",
    paddingTop: 16,
  },
  label: { color: "#ccc", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: "#e94560", borderColor: "#e94560" },
  chipText: { color: "#aaa", fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnSecondary: { backgroundColor: "#2a2a5a" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  btnTextSecondary: { color: "#ccc", fontSize: 14 },
});
