/**
 * Join game by invite token.
 *
 * User pastes or types the invite token they received, taps Join, and is
 * added as a participant. On success: navigate to the game screen.
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";

import { queryKeys } from "@/lib/queryKeys";
import * as gameService from "@/services/gameService";
import { useAuthStore } from "@/store/authStore";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
});

type FormValues = z.infer<typeof schema>;

export default function JoinGameScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId) ?? "";

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      gameService.joinByToken(values.token.trim()),
    onSuccess: (participant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.games(userId) });
      router.replace(`/games/${participant.game_id}`);
    },
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: "" },
  });

  const token = watch("token");

  return (
    <>
      <Stack.Screen options={{ title: "Join Game" }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.heading}>Enter Invite Token</Text>
          <Text style={styles.subheading}>
            Paste the token shared by the dealer.
          </Text>

          {mutation.error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to join game"}
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <TextInput
              style={[styles.input, errors.token && styles.inputError]}
              placeholder="Paste invite token here"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              value={token}
              onChangeText={(v) =>
                setValue("token", v, { shouldValidate: true })
              }
            />
            {errors.token ? (
              <Text style={styles.fieldError}>{errors.token.message}</Text>
            ) : null}
          </View>

          <Pressable
            style={[styles.btn, mutation.isPending && styles.btnDisabled]}
            onPress={handleSubmit((v) => mutation.mutate(v))}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Join Game</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 24 },
  heading: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subheading: { color: "#888", fontSize: 14, marginBottom: 28 },
  errorBanner: {
    backgroundColor: "#4a1020",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { color: "#ff6b6b", fontSize: 14 },
  field: { marginBottom: 16 },
  input: {
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
  },
  inputError: { borderColor: "#e94560" },
  fieldError: { color: "#e94560", fontSize: 12, marginTop: 4 },
  btn: {
    backgroundColor: "#e94560",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
