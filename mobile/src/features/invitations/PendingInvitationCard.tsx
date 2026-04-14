/**
 * PendingInvitationCard — shows a pending game invitation with Accept/Decline buttons.
 *
 * Used in:
 * - NotificationsScreen (when tapping a game_invitation notification)
 * - Could be shown inline in a dedicated invitations list
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  useAcceptInvitation,
  useDeclineInvitation,
} from "@/hooks/useGameInvitations";

interface PendingInvitationCardProps {
  gameId: string;
  invitationId: string;
  gameTitle?: string;
  onAccepted?: (gameId: string) => void;
  onDeclined?: () => void;
}

export default function PendingInvitationCard({
  gameId,
  invitationId,
  gameTitle,
  onAccepted,
  onDeclined,
}: PendingInvitationCardProps) {
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const isPending = acceptMutation.isPending || declineMutation.isPending;

  function handleAccept() {
    acceptMutation.mutate(
      { gameId, invitationId },
      {
        onSuccess: () => onAccepted?.(gameId),
      },
    );
  }

  function handleDecline() {
    declineMutation.mutate(
      { gameId, invitationId },
      {
        onSuccess: () => onDeclined?.(),
      },
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {gameTitle ? `Game: ${gameTitle}` : "Game Invitation"}
      </Text>
      <Text style={styles.subtitle}>
        You have been invited to join this game.
      </Text>

      {acceptMutation.isSuccess && (
        <Text style={styles.successText}>Accepted! You are now a participant.</Text>
      )}

      {declineMutation.isSuccess && (
        <Text style={styles.declinedText}>Invitation declined.</Text>
      )}

      {acceptMutation.isError && (
        <Text style={styles.errorText}>
          {acceptMutation.error instanceof Error
            ? acceptMutation.error.message
            : "Failed to accept."}
        </Text>
      )}

      {!acceptMutation.isSuccess && !declineMutation.isSuccess && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.acceptBtn, isPending && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={isPending}
          >
            {acceptMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.btn, styles.declineBtn, isPending && styles.btnDisabled]}
            onPress={handleDecline}
            disabled={isPending}
          >
            {declineMutation.isPending ? (
              <ActivityIndicator size="small" color="#ccc" />
            ) : (
              <Text style={styles.declineBtnText}>Decline</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#888",
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: "#2ecc71",
  },
  declineBtn: {
    backgroundColor: "#2a2a5a",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  declineBtnText: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "600",
  },
  successText: {
    color: "#2ecc71",
    fontSize: 14,
    fontWeight: "600",
  },
  declinedText: {
    color: "#888",
    fontSize: 14,
  },
  errorText: {
    color: "#e94560",
    fontSize: 14,
  },
});
