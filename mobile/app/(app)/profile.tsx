/**
 * Profile screen — view and edit the current user's profile.
 *
 * View mode:    displays user data (name, email, phone, profile image).
 * Edit mode:    form with react-hook-form + zod for mutable fields.
 *               Profile image URL is a text input (no file picker in Stage 6).
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
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
import * as statsService from "@/services/statsService";
import * as userService from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
import type { UserStats } from "@/types/stats";
import type { User } from "@/types/user";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const editSchema = z.object({
  full_name: z.string().min(1, "Name cannot be empty").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  profile_image_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

type EditValues = z.infer<typeof editSchema>;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stats section
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatsSection({ stats }: { stats: UserStats }) {
  const router = useRouter();
  const net = parseFloat(stats.cumulative_net);
  const netColor = net > 0 ? "#2ecc71" : net < 0 ? "#e94560" : "#aaa";
  const netSign = net > 0 ? "+" : "";

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsHeader}>
        <Text style={styles.statsTitle}>My Stats</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => router.push("/friends")}>
            <Text style={styles.historyLink}>Friends →</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/leaderboard")}>
            <Text style={styles.historyLink}>Leaderboard →</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/history")}>
            <Text style={styles.historyLink}>History →</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatItem label="Games played" value={String(stats.total_games_played)} />
        <StatItem label="Games hosted" value={String(stats.total_games_hosted)} />
        <StatItem label="Profitable" value={String(stats.profitable_games)} />
        <StatItem
          label="Win rate"
          value={
            stats.win_rate != null
              ? `${(stats.win_rate * 100).toFixed(0)}%`
              : "—"
          }
        />
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Cumulative net</Text>
        <Text style={[styles.netValue, { color: netColor }]}>
          {stats.games_with_result > 0
            ? `${netSign}${Math.abs(net).toFixed(2)}`
            : "—"}
        </Text>
      </View>

      {stats.average_net != null ? (
        <View style={styles.netRow}>
          <Text style={styles.netLabel}>Avg per game</Text>
          <Text style={styles.netAvg}>
            {parseFloat(stats.average_net) >= 0 ? "+" : ""}
            {parseFloat(stats.average_net).toFixed(2)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "—"}</Text>
    </View>
  );
}

function EditForm({
  user,
  userId,
  onCancel,
  onSaved,
}: {
  user: User;
  userId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: userService.updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me(userId) });
      onSaved();
    },
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: user.full_name ?? "",
      phone: user.phone ?? "",
      profile_image_url: user.profile_image_url ?? "",
    },
  });

  const fullName = watch("full_name");
  const phone = watch("phone");
  const imageUrl = watch("profile_image_url");

  const onSubmit = async (values: EditValues) => {
    await mutation.mutateAsync({
      full_name: values.full_name || null,
      phone: values.phone || null,
      profile_image_url: values.profile_image_url || null,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {mutation.error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Update failed"}
          </Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={[styles.input, errors.full_name && styles.inputError]}
          placeholder="Your name"
          placeholderTextColor="#666"
          value={fullName}
          onChangeText={(v) =>
            setValue("full_name", v, { shouldValidate: true })
          }
        />
        {errors.full_name ? (
          <Text style={styles.fieldError}>{errors.full_name.message}</Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="+1 555 000 0000"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => setValue("phone", v, { shouldValidate: true })}
        />
        {errors.phone ? (
          <Text style={styles.fieldError}>{errors.phone.message}</Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Profile image URL</Text>
        <TextInput
          style={[styles.input, errors.profile_image_url && styles.inputError]}
          placeholder="https://example.com/avatar.jpg"
          placeholderTextColor="#666"
          autoCapitalize="none"
          keyboardType="url"
          value={imageUrl}
          onChangeText={(v) =>
            setValue("profile_image_url", v, { shouldValidate: true })
          }
        />
        {errors.profile_image_url ? (
          <Text style={styles.fieldError}>
            {errors.profile_image_url.message}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.btnSecondary, { flex: 1, marginRight: 8 }]}
          onPress={onCancel}
          disabled={mutation.isPending}
        >
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.btnPrimary,
            { flex: 1, marginLeft: 8 },
            mutation.isPending && styles.btnDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Save</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const userId = useAuthStore((s) => s.userId) ?? "";

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.me(userId),
    queryFn: userService.getMe,
  });

  const { data: stats } = useQuery({
    queryKey: queryKeys.stats(userId),
    queryFn: statsService.getStats,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <Pressable style={[styles.btnPrimary, { marginTop: 16 }]} onPress={() => refetch()}>
          <Text style={styles.btnPrimaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Avatar */}
      {user.profile_image_url ? (
        <Image
          source={{ uri: user.profile_image_url }}
          style={styles.avatar}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>
            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <Text style={styles.name}>{user.full_name ?? "—"}</Text>
      <Text style={styles.email}>{user.email}</Text>

      {isEditing ? (
        <View style={styles.editSection}>
          <EditForm
            user={user}
            userId={userId}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <ProfileRow label="Email" value={user.email} />
            <ProfileRow label="Full name" value={user.full_name} />
            <ProfileRow label="Phone" value={user.phone} />
            <ProfileRow label="Image URL" value={user.profile_image_url} />
          </View>

          {stats ? <StatsSection stats={stats} /> : null}

          <Pressable
            style={styles.btnPrimary}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.btnPrimaryText}>Edit profile</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 24,
    alignItems: "center",
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a5a",
  },
  rowLabel: { color: "#888", fontSize: 14 },
  rowValue: { color: "#fff", fontSize: 14, flex: 1, textAlign: "right" },
  editSection: { width: "100%" },
  field: { marginBottom: 16, width: "100%" },
  label: { color: "#cccccc", fontSize: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#16213e",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
  },
  inputError: { borderColor: "#e94560" },
  fieldError: { color: "#e94560", fontSize: 12, marginTop: 4 },
  actionRow: { flexDirection: "row", marginTop: 8 },
  btnPrimary: {
    backgroundColor: "#e94560",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  btnPrimaryText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  btnSecondary: {
    backgroundColor: "#2a2a5a",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#cccccc", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  errorBanner: {
    backgroundColor: "#4a1020",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  errorBannerText: { color: "#ff6b6b", fontSize: 14 },
  errorText: { color: "#ff6b6b", fontSize: 16 },
  // Stats section
  statsCard: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  statsTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  historyLink: { color: "#e94560", fontSize: 13 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  statItem: {
    width: "45%",
    backgroundColor: "#1a1a3e",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  statLabel: { color: "#888", fontSize: 11 },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#2a2a5a",
  },
  netLabel: { color: "#888", fontSize: 13 },
  netValue: { fontSize: 15, fontWeight: "700" },
  netAvg: { color: "#aaa", fontSize: 13 },
});
