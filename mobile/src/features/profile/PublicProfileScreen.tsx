/**
 * PublicProfileScreen — view another user's public profile.
 *
 * Shows:
 *  - Avatar (image or initials fallback)
 *  - Display name
 *  - Games played (always visible)
 *  - Full stats block → when viewer is self or an accepted friend (is_friend_access: true)
 *  - Locked placeholder → when viewer is not a friend (is_friend_access: false)
 *  - Friendship action button (Add Friend / Pending / Friends / Accept):
 *      not_friends      → "Add Friend" button → sends request
 *      pending_outgoing → "Request Sent" label (disabled)
 *      pending_incoming → "Accept Request" button → accepts request
 *      friends          → "Friends" label + unfriend option
 *
 * The privacy gate is enforced on the backend. This screen simply renders what
 * the API returns in UserStatsView.is_friend_access.
 */

import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  useAcceptFriendRequest,
  useFriendshipStatus,
  useRemoveFriend,
  useSendFriendRequest,
} from "@/hooks/useFriends";
import { queryKeys } from "@/lib/queryKeys";
import { getPublicProfile, getUserStats } from "@/services/userService";
import { useAuthStore } from "@/store/authStore";

interface PublicProfileScreenProps {
  userId: string;
}

// ---------------------------------------------------------------------------
// Friendship action button
// ---------------------------------------------------------------------------

function FriendshipButton({ userId }: { userId: string }) {
  const { data: statusData, isLoading } = useFriendshipStatus(userId);
  const sendRequest = useSendFriendRequest(userId);
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend(userId);

  if (isLoading) {
    return <ActivityIndicator color="#e94560" style={{ marginBottom: 20 }} />;
  }

  const status = statusData?.status ?? "not_friends";
  const friendshipId = statusData?.friendship_id ?? null;

  const isMutating =
    sendRequest.isPending || acceptRequest.isPending || removeFriend.isPending;

  if (status === "not_friends") {
    return (
      <Pressable
        style={[styles.friendBtn, styles.addFriendBtn, isMutating && styles.btnDisabled]}
        onPress={() => sendRequest.mutate(userId)}
        disabled={isMutating}
      >
        {isMutating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.friendBtnText}>Add Friend</Text>
        )}
      </Pressable>
    );
  }

  if (status === "pending_outgoing") {
    return (
      <View style={[styles.friendBtn, styles.pendingBtn]}>
        <Text style={styles.pendingBtnText}>Request Sent</Text>
      </View>
    );
  }

  if (status === "pending_incoming") {
    return (
      <Pressable
        style={[styles.friendBtn, styles.acceptBtn, isMutating && styles.btnDisabled]}
        onPress={() => friendshipId && acceptRequest.mutate(friendshipId)}
        disabled={isMutating || !friendshipId}
      >
        {isMutating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.friendBtnText}>Accept Request</Text>
        )}
      </Pressable>
    );
  }

  // status === "friends"
  return (
    <Pressable
      style={[styles.friendBtn, styles.friendsBtn]}
      onPress={() => {
        Alert.alert("Unfriend", "Remove this player from your friends?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unfriend",
            style: "destructive",
            onPress: () => friendshipId && removeFriend.mutate(friendshipId),
          },
        ]);
      }}
      disabled={isMutating}
    >
      <Text style={styles.friendsBtnText}>Friends ✓</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function PublicProfileScreen({ userId }: PublicProfileScreenProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const isSelf = currentUserId === userId;

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: queryKeys.publicProfile(userId),
    queryFn: () => getPublicProfile(userId),
    staleTime: 30_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.userStats(userId),
    queryFn: () => getUserStats(userId),
    enabled: !!profile,
    staleTime: 30_000,
  });

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e94560" />
      </View>
    );
  }

  if (profileError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>User not found.</Text>
      </View>
    );
  }

  const displayName = profile.full_name ?? "Unknown Player";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profile.profile_image_url ? (
          <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <Text style={styles.displayName}>{displayName}</Text>
      </View>

      {/* Friendship button — only shown when viewing another user's profile */}
      {!isSelf && <FriendshipButton userId={userId} />}

      {/* Stats section */}
      {statsLoading ? (
        <ActivityIndicator color="#e94560" style={{ marginTop: 24 }} />
      ) : stats ? (
        <View style={styles.statsSection}>
          {/* Always-visible stat */}
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_games_played}</Text>
            <Text style={styles.statLabel}>Games Played</Text>
          </View>

          {stats.is_friend_access ? (
            /* Full stats block */
            <>
              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.total_games_hosted ?? 0}</Text>
                  <Text style={styles.statLabel}>Games Hosted</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {stats.win_rate != null ? `${(stats.win_rate * 100).toFixed(0)}%` : "—"}
                  </Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                </View>
              </View>

              <View style={styles.netCard}>
                <Text style={styles.netLabel}>Cumulative Net</Text>
                <Text
                  style={[
                    styles.netValue,
                    stats.cumulative_net != null && parseFloat(stats.cumulative_net) >= 0
                      ? styles.positive
                      : styles.negative,
                  ]}
                >
                  {stats.cumulative_net != null
                    ? `${parseFloat(stats.cumulative_net) >= 0 ? "+" : ""}${parseFloat(stats.cumulative_net).toFixed(2)}`
                    : "—"}
                </Text>
              </View>

              {stats.average_net != null && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Average per game</Text>
                  <Text
                    style={[
                      styles.metaValue,
                      parseFloat(stats.average_net) >= 0 ? styles.positive : styles.negative,
                    ]}
                  >
                    {`${parseFloat(stats.average_net) >= 0 ? "+" : ""}${parseFloat(stats.average_net).toFixed(2)}`}
                  </Text>
                </View>
              )}

              {stats.profitable_games != null && stats.games_with_result != null && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Profitable games</Text>
                  <Text style={styles.metaValue}>
                    {stats.profitable_games} / {stats.games_with_result}
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* Locked placeholder for non-friends */
            <View style={styles.lockedBlock}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockedTitle}>Friend-only stats</Text>
              <Text style={styles.lockedSubtitle}>
                Add this player as a friend to see their full statistics.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  content: { padding: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  errorText: { color: "#e94560", fontSize: 16 },

  avatarSection: { alignItems: "center", marginBottom: 16 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarInitials: { color: "#ffffff", fontSize: 40, fontWeight: "700" },
  displayName: { color: "#ffffff", fontSize: 22, fontWeight: "700" },

  // Friendship button styles
  friendBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
    minWidth: 160,
  },
  addFriendBtn: { backgroundColor: "#e94560" },
  pendingBtn: { backgroundColor: "#2a2a5a" },
  acceptBtn: { backgroundColor: "#2ecc71" },
  friendsBtn: { backgroundColor: "#16213e", borderWidth: 1, borderColor: "#2a2a5a" },
  friendBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  pendingBtnText: { color: "#888", fontSize: 15 },
  friendsBtnText: { color: "#aaa", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  statsSection: { gap: 12 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  statValue: { color: "#ffffff", fontSize: 26, fontWeight: "700" },
  statLabel: { color: "#aaa", fontSize: 12, marginTop: 4 },

  netCard: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  netLabel: { color: "#aaa", fontSize: 13, marginBottom: 4 },
  netValue: { fontSize: 28, fontWeight: "700" },
  positive: { color: "#4caf50" },
  negative: { color: "#e94560" },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#16213e",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  metaLabel: { color: "#aaa", fontSize: 14 },
  metaValue: { color: "#ffffff", fontSize: 14, fontWeight: "600" },

  lockedBlock: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 28,
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  lockIcon: { fontSize: 36 },
  lockedTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  lockedSubtitle: { color: "#aaa", fontSize: 13, textAlign: "center", lineHeight: 20 },
});
