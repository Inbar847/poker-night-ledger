/**
 * Create game screen.
 *
 * Fields: title (required), chip_cash_rate (required, > 0),
 *         currency (optional, default USD).
 *
 * On success: navigate to the new game's screen.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
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

const schema = z.object({
  title: z.string().min(1, "Game title is required").max(255),
  chip_cash_rate: z
    .string()
    .min(1, "Chip/cash rate is required")
    .refine((v) => parseFloat(v) > 0, "Rate must be greater than 0"),
  currency: z.string().max(10).default("USD"),
});

type FormValues = z.infer<typeof schema>;

export default function CreateGameScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: gameService.createGame,
    onSuccess: (game) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.games });
      router.replace(`/games/${game.id}`);
    },
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", chip_cash_rate: "", currency: "USD" },
  });

  const title = watch("title");
  const rate = watch("chip_cash_rate");
  const currency = watch("currency");

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      title: values.title,
      chip_cash_rate: values.chip_cash_rate,
      currency: values.currency || "USD",
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Create Game" }} />
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
                  : "Failed to create game"}
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Game title *</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="Friday Night Poker"
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

          <View style={styles.field}>
            <Text style={styles.label}>Chip / cash rate *</Text>
            <Text style={styles.hint}>
              How much cash (in {currency}) is one chip worth?
            </Text>
            <TextInput
              style={[styles.input, errors.chip_cash_rate && styles.inputError]}
              placeholder="0.01"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={rate}
              onChangeText={(v) =>
                setValue("chip_cash_rate", v, { shouldValidate: true })
              }
            />
            {errors.chip_cash_rate ? (
              <Text style={styles.fieldError}>
                {errors.chip_cash_rate.message}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Currency</Text>
            <TextInput
              style={styles.input}
              placeholder="USD"
              placeholderTextColor="#555"
              autoCapitalize="characters"
              maxLength={10}
              value={currency}
              onChangeText={(v) => setValue("currency", v.toUpperCase())}
            />
          </View>

          <Pressable
            style={[styles.btn, mutation.isPending && styles.btnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create Game</Text>
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
  field: { marginBottom: 18 },
  label: { color: "#ccc", fontSize: 14, marginBottom: 4 },
  hint: { color: "#666", fontSize: 12, marginBottom: 6 },
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
    backgroundColor: "#e94560",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
