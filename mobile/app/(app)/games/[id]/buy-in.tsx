/**
 * Buy-in entry screen — dealer only.
 *
 * Select a participant, enter cash_amount, chips_amount, and buy_in_type.
 * On success: go back (the game screen refreshes via WS event).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
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
import type { BuyInType } from "@/types/game";

const BUY_IN_TYPES: BuyInType[] = ["initial", "rebuy", "addon"];

const schema = z.object({
  cash_amount: z
    .string()
    .min(1, "Cash amount is required")
    .refine((v) => parseFloat(v) > 0, "Must be greater than 0"),
  chips_amount: z
    .string()
    .min(1, "Chips amount is required")
    .refine((v) => parseFloat(v) >= 0, "Must be 0 or greater"),
});

type FormValues = z.infer<typeof schema>;

export default function BuyInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    null,
  );
  const [buyInType, setBuyInType] = useState<BuyInType>("initial");

  const { data: participants = [], isLoading: participantsLoading } = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => gameService.getParticipants(id),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      ledgerService.createBuyIn(id, {
        participant_id: selectedParticipant!,
        cash_amount: parseFloat(values.cash_amount).toFixed(2),
        chips_amount: parseFloat(values.chips_amount).toFixed(2),
        buy_in_type: buyInType,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.buyIns(id) });
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
    defaultValues: { cash_amount: "", chips_amount: "" },
  });

  const cashAmount = watch("cash_amount");
  const chipsAmount = watch("chips_amount");

  return (
    <>
      <Stack.Screen options={{ title: "Add Buy-in" }} />
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
                  : "Failed to add buy-in"}
              </Text>
            </View>
          ) : null}

          {/* Participant selector */}
          <Text style={styles.label}>Participant *</Text>
          {participantsLoading ? (
            <ActivityIndicator color="#e94560" />
          ) : (
            <View style={styles.chipRow}>
              {participants.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    selectedParticipant === p.id && styles.chipSelected,
                  ]}
                  onPress={() => setSelectedParticipant(p.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedParticipant === p.id && styles.chipTextSelected,
                    ]}
                  >
                    {p.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Buy-in type */}
          <Text style={[styles.label, { marginTop: 16 }]}>Type *</Text>
          <View style={styles.chipRow}>
            {BUY_IN_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, buyInType === t && styles.chipSelected]}
                onPress={() => setBuyInType(t)}
              >
                <Text
                  style={[
                    styles.chipText,
                    buyInType === t && styles.chipTextSelected,
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cash amount */}
          <View style={[styles.field, { marginTop: 16 }]}>
            <Text style={styles.label}>Cash amount *</Text>
            <TextInput
              style={[styles.input, errors.cash_amount && styles.inputError]}
              placeholder="50.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={cashAmount}
              onChangeText={(v) =>
                setValue("cash_amount", v, { shouldValidate: true })
              }
            />
            {errors.cash_amount ? (
              <Text style={styles.fieldError}>{errors.cash_amount.message}</Text>
            ) : null}
          </View>

          {/* Chips amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Chips amount *</Text>
            <TextInput
              style={[styles.input, errors.chips_amount && styles.inputError]}
              placeholder="5000"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={chipsAmount}
              onChangeText={(v) =>
                setValue("chips_amount", v, { shouldValidate: true })
              }
            />
            {errors.chips_amount ? (
              <Text style={styles.fieldError}>
                {errors.chips_amount.message}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={[
              styles.btn,
              styles.btnPrimary,
              (!selectedParticipant || mutation.isPending) && styles.btnDisabled,
            ]}
            onPress={handleSubmit((v) => mutation.mutate(v))}
            disabled={!selectedParticipant || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Add Buy-in</Text>
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
  label: { color: "#ccc", fontSize: 13, fontWeight: "600", marginBottom: 8 },
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
  field: { marginBottom: 16 },
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
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
