/**
 * Final stacks entry screen — dealer only.
 *
 * Shows all participants with a chips_amount input for each.
 * "Save All" calls PUT /games/:id/final-stacks/:participantId for each
 * participant that has a value entered. Participants with empty input are skipped.
 *
 * On success: go back (game screen refreshes via WS events).
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

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import * as ledgerService from "@/services/ledgerService";

export default function FinalStacksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading } = useQuery({
    queryKey: queryKeys.participants(id),
    queryFn: () => gameService.getParticipants(id),
    enabled: !!id,
  });

  const { data: existingStacks = [] } = useQuery({
    queryKey: queryKeys.finalStacks(id),
    queryFn: () => ledgerService.listFinalStacks(id),
    enabled: !!id,
  });

  // Build initial chip values from existing stacks
  const existingMap = Object.fromEntries(
    existingStacks.map((s) => [s.participant_id, s.chips_amount]),
  );

  // Local state: participantId → chips string
  const [chips, setChips] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      participants.map((p) => [p.id, existingMap[p.id] ?? ""]),
    ),
  );

  // Re-init when participants/stacks load
  // (useEffect not needed — initial state captures whatever loaded first;
  //  we rely on component re-rendering after both queries resolve)

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient_ = useQueryClient();

  const handleSave = async () => {
    const entries = participants.filter(
      (p) => chips[p.id] !== undefined && chips[p.id].trim() !== "",
    );

    if (entries.length === 0) {
      Alert.alert("No chips entered", "Enter chip counts for at least one participant.");
      return;
    }

    // Validate all entered values
    const invalid = entries.find((p) => {
      const v = parseFloat(chips[p.id] ?? "");
      return isNaN(v) || v < 0;
    });
    if (invalid) {
      setError("Chip counts must be 0 or greater.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        entries.map((p) =>
          ledgerService.upsertFinalStack(id, p.id, {
            chips_amount: parseFloat(chips[p.id]).toFixed(2),
          }),
        ),
      );
      void queryClient_.invalidateQueries({
        queryKey: queryKeys.finalStacks(id),
      });
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save final stacks",
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Final Chip Counts" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Final Chip Counts" }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Enter the final chip count for each participant. Leave blank to skip.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {participants.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.name}>{p.display_name}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={chips[p.id] ?? ""}
              onChangeText={(v) => setChips((prev) => ({ ...prev, [p.id]: v }))}
            />
          </View>
        ))}

        <Pressable
          style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save All</Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: "#888", fontSize: 13, marginBottom: 20 },
  errorBanner: {
    backgroundColor: "#4a1020",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: "#ff6b6b", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  name: { color: "#fff", fontSize: 14, flex: 1 },
  input: {
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 16,
    width: 110,
    textAlign: "right",
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  btnPrimary: { backgroundColor: "#e94560" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
