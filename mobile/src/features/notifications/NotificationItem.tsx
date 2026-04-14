/**
 * NotificationItem — renders a single notification row.
 *
 * Unread notifications are visually distinct (bold text + accent dot).
 * Tapping calls onPress(notification) — the parent handles navigation
 * and mark-as-read so this component stays pure/presentational.
 *
 * For game_invitation notifications with an invitation_id, renders
 * inline Accept/Decline buttons when the invitation is still pending.
 */

import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  useAcceptInvitation,
  useDeclineInvitation,
} from "@/hooks/useGameInvitations";
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
  settlement_owed: "Settlement payment due",
  game_resettled: "Settlement updated",
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
  const data = notification.data;

  // Build the label, guarding against null/missing data fields
  let label: string;
  if (
    notification.type === "settlement_owed" &&
    data?.to_display_name &&
    data?.amount &&
    data?.currency &&
    data?.game_title
  ) {
    label = `You owe ${data.to_display_name} ${data.amount} ${data.currency} from ${data.game_title}`;
  } else if (notification.type === "game_resettled" && data?.game_title) {
    label = `Settlement updated for ${data.game_title}`;
  } else {
    label = NOTIFICATION_LABELS[notification.type] ?? notification.type;
  }

  const gameTitle = data?.game_title;
  const isGameInvitation =
    notification.type === "game_invitation" &&
    data?.invitation_id &&
    data?.game_id;

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
          {notification.type !== "settlement_owed" && gameTitle
            ? `${label}: ${gameTitle}`
            : label}
        </Text>
        <Text style={styles.time}>{timeAgo(notification.created_at)}</Text>

        {isGameInvitation && (
          <InvitationActions
            gameId={data!.game_id!}
            invitationId={data!.invitation_id!}
          />
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inline accept/decline for game invitations
// ---------------------------------------------------------------------------

function InvitationActions({
  gameId,
  invitationId,
}: {
  gameId: string;
  invitationId: string;
}) {
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const isPending = acceptMutation.isPending || declineMutation.isPending;

  if (resolved === "accepted") {
    return <Text style={styles.resolvedAccepted}>Accepted</Text>;
  }
  if (resolved === "declined") {
    return <Text style={styles.resolvedDeclined}>Declined</Text>;
  }

  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.actionBtn, styles.acceptBtn, isPending && styles.actionBtnDisabled]}
        onPress={() =>
          acceptMutation.mutate(
            { gameId, invitationId },
            { onSuccess: () => setResolved("accepted") },
          )
        }
        disabled={isPending}
      >
        {acceptMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.actionBtnText}>Accept</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.actionBtn, styles.declineBtn, isPending && styles.actionBtnDisabled]}
        onPress={() =>
          declineMutation.mutate(
            { gameId, invitationId },
            { onSuccess: () => setResolved("declined") },
          )
        }
        disabled={isPending}
      >
        {declineMutation.isPending ? (
          <ActivityIndicator size="small" color="#ccc" />
        ) : (
          <Text style={styles.declineBtnText}>Decline</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 4,
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
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: "#2ecc71",
  },
  declineBtn: {
    backgroundColor: "#2a2a5a",
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  declineBtnText: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "600",
  },
  resolvedAccepted: {
    color: "#2ecc71",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  resolvedDeclined: {
    color: "#888",
    fontSize: 13,
    marginTop: 8,
  },
});
