/**
 * Expense entry screen — dealer only.
 *
 * Fields: title, total_amount, paid_by participant, split_among participants.
 * The dealer selects which participants share the expense (defaults to all).
 * Splits are computed as equal shares among selected participants only.
 * The remainder (from integer division) goes to the first selected participant,
 * ensuring the split sum equals total_amount exactly.
 *
 * On success: go back (game screen refreshes via WS event).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
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

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";
import type { Participant } from "@/types/game";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  total_amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => parseFloat(v) > 0, "Must be greater than 0"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Compute equal splits for the given participants.
 * Uses integer cent arithmetic to avoid floating-point drift.
 * Remainder (from floor division) goes to the first participant.
 */
function computeEqualSplits(
  participants: Participant[],
  totalAmountStr: string,
): { participant_id: string; share_amount: string }[] {
  const n = participants.length;
  if (n === 0) return [];
  const totalCents = Math.round(parseFloat(totalAmountStr) * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;
  return participants.map((p, i) => ({
    participant_id: p.id,
    share_amount: ((baseCents + (i === 0 ? remainderCents : 0)) / 100).toFixed(
      2,
    ),
  }));
}

export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [paidBy, setPaidBy] = useState<string | null>(null);
  // IDs of participants included in the split. Initialised to all once loaded.
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());

  const { data: participants = [], isLoading: participantsLoading } = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => gameService.getParticipants(id),
    enabled: !!id,
  });

  // Default: include everyone in the split once participants are loaded.
  useEffect(() => {
    if (participants.length > 0 && splitIds.size === 0) {
      setSplitIds(new Set(participants.map((p) => p.id)));
    }
  }, [participants]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSplitId(participantId: string) {
    setSplitIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) {
        next.delete(participantId);
      } else {
        next.add(participantId);
      }
      return next;
    });
  }

  const selectedParticipants = participants.filter((p) => splitIds.has(p.id));

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const splits = computeEqualSplits(selectedParticipants, values.total_amount);
      return ledgerService.createExpense(id, {
        title: values.title,
        total_amount: parseFloat(values.total_amount).toFixed(2),
        paid_by_participant_id: paidBy!,
        splits,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenses(id) });
      router.back();
    },
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", total_amount: "" },
  });

  const title = watch("title");
  const total = watch("total_amount");

  // Preview splits when both total and selected participants are available
  const previewSplits =
    total && parseFloat(total) > 0 && selectedParticipants.length > 0
      ? computeEqualSplits(selectedParticipants, total)
      : [];

  const canSubmit = !!paidBy && selectedParticipants.length > 0 && !mutation.isPending;

  return (
    <>
      <Stack.Screen options={{ title: "Add Expense" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {mutation.error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to add expense"}
              </Text>
            </View>
          ) : null}

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Expense title *</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Pizza, drinks, etc."
              placeholderTextColor="#555"
              value={title}
              onChangeText={(v) =>
                setValue("title", v, { shouldValidate: true })
              }
            />
            {errors.title ? (
              <Text style={styles.fieldError}>{errors.title.message}</Text>
            ) : null}
          </View>

          {/* Total amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Total amount *</Text>
            <TextInput
              style={[styles.input, errors.total_amount && styles.inputError]}
              placeholder="40.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={total}
              onChangeText={(v) =>
                setValue("total_amount", v, { shouldValidate: true })
              }
            />
            {errors.total_amount ? (
              <Text style={styles.fieldError}>{errors.total_amount.message}</Text>
            ) : null}
          </View>

          {/* Paid by */}
          <Text style={styles.label}>Paid by *</Text>
          {participantsLoading ? (
            <ActivityIndicator color="#e94560" />
          ) : (
            <View style={styles.chipRow}>
              {participants.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    paidBy === p.id && styles.chipSelected,
                  ]}
                  onPress={() => setPaidBy(p.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      paidBy === p.id && styles.chipTextSelected,
                    ]}
                  >
                    {p.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Split among */}
          <Text style={[styles.label, { marginTop: 12 }]}>
            Split among * ({selectedParticipants.length} selected)
          </Text>
          {participantsLoading ? (
            <ActivityIndicator color="#e94560" />
          ) : (
            <View style={styles.chipRow}>
              {participants.map((p) => {
                const included = splitIds.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.chip,
                      included && styles.chipIncluded,
                    ]}
                    onPress={() => toggleSplitId(p.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        included && styles.chipTextSelected,
                      ]}
                    >
                      {included ? "✓ " : ""}{p.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {selectedParticipants.length === 0 ? (
            <Text style={styles.fieldError}>
              Select at least one participant to split the expense
            </Text>
          ) : null}

          {/* Split preview */}
          {previewSplits.length > 0 ? (
            <View style={styles.splitPreview}>
              <Text style={styles.splitTitle}>
                Equal split among {selectedParticipants.length}{" "}
                {selectedParticipants.length === 1 ? "participant" : "participants"}:
              </Text>
              {previewSplits.map((s) => {
                const name =
                  participants.find((p) => p.id === s.participant_id)
                    ?.display_name ?? "Unknown";
                return (
                  <View key={s.participant_id} style={styles.splitRow}>
                    <Text style={styles.splitName}>{name}</Text>
                    <Text style={styles.splitAmount}>{s.share_amount}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Pressable
            style={[
              styles.btn,
              styles.btnPrimary,
              { marginTop: 16 },
              !canSubmit && styles.btnDisabled,
            ]}
            onPress={handleSubmit((v) => mutation.mutate(v))}
            disabled={!canSubmit}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Add Expense</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },
  errorBanner: {
    backgroundColor: "#4a1020",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: "#ff6b6b", fontSize: 14 },
  field: { marginBottom: 16 },
  label: { color: "#ccc", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: {
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  inputError: { borderColor: "#e94560" },
  fieldError: { color: "#e94560", fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: "#e94560", borderColor: "#e94560" },
  chipIncluded: { backgroundColor: "#1a4a2e", borderColor: "#2ecc71" },
  chipText: { color: "#aaa", fontSize: 13 },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  splitPreview: {
    backgroundColor: "#16213e",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  splitTitle: { color: "#888", fontSize: 12, marginBottom: 8 },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  splitName: { color: "#ccc", fontSize: 13 },
  splitAmount: { color: "#fff", fontSize: 13, fontWeight: "500" },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
