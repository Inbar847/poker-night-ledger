/**
 * Live invitation popup — Stage 26.
 *
 * Rendered at the app shell level (above all screens) so it can appear
 * regardless of current navigation state. Shows game title, inviter name,
 * and Accept / Decline buttons.
 *
 * - Accept: calls accept endpoint, clears popup
 * - Decline: calls decline endpoint, clears popup
 * - Dismiss (backdrop tap): clears popup without acting (invitation stays pending)
 */

import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  useAcceptInvitation,
  useDeclineInvitation,
} from "@/hooks/useGameInvitations";
import { useInvitationPopupStore } from "@/store/invitationPopupStore";

export default function InvitationPopup() {
  const pendingInvitation = useInvitationPopupStore(
    (s) => s.pendingInvitation
  );
  const clearPopup = useInvitationPopupStore((s) => s.clearPopup);
  const router = useRouter();

  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  if (!pendingInvitation) return null;

  const { invitationId, gameId, gameTitle, inviterName } = pendingInvitation;

  const handleAccept = async () => {
    setLoading("accept");
    try {
      await acceptMutation.mutateAsync({ gameId, invitationId });
      clearPopup();
      router.push(`/games/${gameId}`);
    } catch {
      // If accept fails, just close the popup — user can retry from notifications
      clearPopup();
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async () => {
    setLoading("decline");
    try {
      await declineMutation.mutateAsync({ gameId, invitationId });
    } catch {
      // Silently handle — the invitation stays in its current state
    } finally {
      setLoading(null);
      clearPopup();
    }
  };

  const handleDismiss = () => {
    // Dismiss without acting — invitation remains pending in notifications
    clearPopup();
  };

  const busy = loading !== null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Game Invitation</Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>{inviterName}</Text> invited you to
          </Text>
          <Text style={styles.gameTitle}>{gameTitle}</Text>

          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.declineBtn]}
              onPress={handleDecline}
              disabled={busy}
            >
              {loading === "decline" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>Decline</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.btn, styles.acceptBtn]}
              onPress={handleAccept}
              disabled={busy}
            >
              {loading === "accept" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnText}>Accept</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  title: {
    color: "#e94560",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  body: {
    color: "#ccc",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
    color: "#fff",
  },
  gameTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 24,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  acceptBtn: {
    backgroundColor: "#4caf50",
  },
  declineBtn: {
    backgroundColor: "#e94560",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
