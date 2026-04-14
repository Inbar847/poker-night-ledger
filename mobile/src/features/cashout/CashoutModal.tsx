/**
 * CashoutModal — allows a player to enter their final chip count and leave early.
 *
 * Only shown to non-dealer, active participants during an active game.
 * On confirm: calls POST /games/{id}/cashout, invalidates participants + finalStacks.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";

interface CashoutModalProps {
  visible: boolean;
  gameId: string;
  currency: string;
  chipCashRate: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CashoutModal({
  visible,
  gameId,
  currency,
  chipCashRate,
  onSuccess,
  onClose,
}: CashoutModalProps) {
  const queryClient = useQueryClient();
  const [chips, setChips] = useState("");

  const cashValue =
    chips.trim() !== "" && !isNaN(Number(chips))
      ? (parseFloat(chips) * parseFloat(chipCashRate)).toFixed(2)
      : null;

  const mutation = useMutation({
    mutationFn: () => gameService.cashOut(gameId, chips.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.participants(gameId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finalStacks(gameId),
      });
      setChips("");
      onSuccess();
    },
    onError: (err) => {
      Alert.alert(
        "Cash Out Failed",
        err instanceof Error ? err.message : "Something went wrong",
      );
    },
  });

  const canSubmit = chips.trim() !== "" && !isNaN(Number(chips)) && Number(chips) >= 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <Text style={s.title}>Leave Early / Cash Out</Text>
          <Text style={s.desc}>
            Enter your final chip count. Your buy-ins, expenses, and this final
            result will be preserved for settlement.
          </Text>

          <Text style={s.label}>Final chip count</Text>
          <TextInput
            style={s.input}
            placeholder="0"
            placeholderTextColor="#555"
            keyboardType="decimal-pad"
            value={chips}
            onChangeText={setChips}
            autoFocus
          />

          {cashValue !== null && (
            <Text style={s.preview}>
              = {currency} {cashValue}
            </Text>
          )}

          <Pressable
            style={[s.btn, s.btnPrimary, (!canSubmit || mutation.isPending) && s.btnDisabled]}
            disabled={!canSubmit || mutation.isPending}
            onPress={() => {
              Alert.alert(
                "Confirm Cash Out",
                `Leave the game with ${chips} chips (${currency} ${cashValue ?? "?"})? This cannot be undone.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Cash Out",
                    style: "destructive",
                    onPress: () => mutation.mutate(),
                  },
                ],
              );
            }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Cash Out</Text>
            )}
          </Pressable>

          <Pressable style={s.cancelBtn} onPress={onClose} disabled={mutation.isPending}>
            <Text style={s.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    marginBottom: 8,
  },
  desc: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  label: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1a1a3e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
  preview: {
    color: "#2ecc71",
    fontSize: 13,
    marginBottom: 16,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  cancelBtn: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: { color: "#666", fontSize: 14 },
});
