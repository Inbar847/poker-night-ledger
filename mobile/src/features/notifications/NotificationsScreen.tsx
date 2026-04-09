/**
 * NotificationsScreen — full list of in-app notifications for the current user.
 *
 * Features:
 * - Newest-first list with unread indicator dot on unread items
 * - "Mark all as read" button at the top when unread items exist
 * - Pull-to-refresh
 * - Empty state
 * - Tapping a notification: marks it as read + navigates to relevant context
 *
 * Navigation targets:
 *   friend_request_received | friend_request_accepted → /friends
 *   game_invitation | game_started | game_closed      → /games/{game_id}
 */

import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import NotificationItem from "@/features/notifications/NotificationItem";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification";

export default function NotificationsScreen() {
  const router = useRouter();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;

  function handlePress(notification: AppNotification) {
    // Mark as read (fire-and-forget — don't block navigation)
    if (!notification.read) {
      markRead.mutate(notification.id);
    }

    // Navigate to the relevant context
    const gameId = notification.data?.game_id;

    if (
      notification.type === "game_invitation" ||
      notification.type === "game_started" ||
      notification.type === "game_closed"
    ) {
      if (gameId) {
        router.push(`/games/${gameId}` as never);
      }
    } else if (
      notification.type === "friend_request_received" ||
      notification.type === "friend_request_accepted"
    ) {
      router.push("/friends" as never);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Mark all as read */}
      {unreadCount > 0 && (
        <View style={styles.markAllRow}>
          <Text style={styles.unreadLabel}>
            {unreadCount} unread
          </Text>
          <Pressable
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            style={({ pressed }) => [
              styles.markAllBtn,
              pressed && styles.markAllBtnPressed,
            ]}
          >
            <Text style={styles.markAllText}>
              {markAll.isPending ? "Marking…" : "Mark all as read"}
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem notification={item} onPress={handlePress} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#e94560"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a3e",
    backgroundColor: "#0f0e17",
  },
  unreadLabel: {
    color: "#888",
    fontSize: 13,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#2a2a5a",
  },
  markAllBtnPressed: {
    opacity: 0.6,
  },
  markAllText: {
    color: "#ccc",
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "#555",
    fontSize: 15,
  },
});
