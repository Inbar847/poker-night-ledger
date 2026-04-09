/**
 * NotificationItem — renders a single notification row.
 *
 * Unread notifications are visually distinct (bold text + accent dot).
 * Tapping calls onPress(notification) — the parent handles navigation
 * and mark-as-read so this component stays pure/presentational.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppNotification, NotificationType } from "@/types/notification";

// ---------------------------------------------------------------------------
// Human-readable labels for each notification type
// ---------------------------------------------------------------------------

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  friend_request_received: "You received a friend request",
  friend_request_accepted: "Your friend request was accepted",
  game_invitation: "You were invited to a game",
  game_started: "A game you are in has started",
  game_closed: "A game you were in has closed",
};

// ---------------------------------------------------------------------------
// Relative time formatter (no external dependency)
// ---------------------------------------------------------------------------

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}

export default function NotificationItem({
  notification,
  onPress,
}: NotificationItemProps) {
  const label =
    NOTIFICATION_LABELS[notification.type] ?? notification.type;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !notification.read && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
      onPress={() => onPress(notification)}
    >
      {/* Unread indicator dot */}
      <View style={styles.dotContainer}>
        {!notification.read ? <View style={styles.dot} /> : <View style={styles.dotPlaceholder} />}
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.label, !notification.read && styles.labelUnread]}
          numberOfLines={2}
        >
          {label}
        </Text>
        <Text style={styles.time}>{timeAgo(notification.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a3e",
    backgroundColor: "#0f0e17",
  },
  rowUnread: {
    backgroundColor: "#16213e",
  },
  rowPressed: {
    opacity: 0.75,
  },
  dotContainer: {
    width: 12,
    alignItems: "center",
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e94560",
  },
  dotPlaceholder: {
    width: 8,
    height: 8,
  },
  content: {
    flex: 1,
  },
  label: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 4,
  },
  labelUnread: {
    color: "#fff",
    fontWeight: "600",
  },
  time: {
    color: "#555",
    fontSize: 12,
  },
});
