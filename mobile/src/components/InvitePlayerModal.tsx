/**
 * InvitePlayerModal — dealer-only modal for inviting a registered user to a game.
 *
 * Uses UserSearchInput to search by name, then calls POST /games/{gameId}/invite-user
 * on selection. On success, the onSuccess callback is called so the parent can
 * invalidate the participants query.
 *
 * Error cases:
 * - 409 Conflict: user is already a participant — surfaced as an inline message.
 * - Other errors: generic error message shown.
 */

import { useMutation } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import UserSearchInput from "@/components/UserSearchInput";
import * as gameService from "@/services/gameService";
import type { UserSearchResult } from "@/types/user";

interface InvitePlayerModalProps {
  visible: boolean;
  gameId: string;
  onSuccess: (participantId: string) => void;
  onClose: () => void;
}

export default function InvitePlayerModal({
  visible,
  gameId,
  onSuccess,
  onClose,
}: InvitePlayerModalProps) {
  const mutation = useMutation({
    mutationFn: (user: UserSearchResult) =>
      gameService.inviteUser(gameId, user.id),
    onSuccess: (participant) => {
      onSuccess(participant.id);
    },
  });

  function handleSelect(user: UserSearchResult) {
    mutation.reset();
    mutation.mutate(user);
  }

  function handleClose() {
    mutation.reset();
    onClose();
  }

  const errorMessage = mutation.isError
    ? mutation.error instanceof Error &&
      mutation.error.message.includes("already a participant")
      ? "This user is already in the game."
      : "Failed to invite player. Please try again."
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Invite Player</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>Search by name to invite a registered user.</Text>

        <UserSearchInput
          onSelect={handleSelect}
          placeholder="Search by name…"
          clearOnSelect={false}
        />

        {mutation.isPending && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#e94560" />
            <Text style={styles.statusText}>Inviting…</Text>
          </View>
        )}

        {mutation.isSuccess && (
          <View style={styles.statusRow}>
            <Text style={styles.successText}>Player invited successfully.</Text>
          </View>
        )}

        {errorMessage && (
          <View style={styles.statusRow}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#0f0e17",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: "#aaa",
    fontSize: 18,
  },
  hint: {
    color: "#888",
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    color: "#aaa",
    fontSize: 14,
  },
  successText: {
    color: "#2ecc71",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: "#e94560",
    fontSize: 14,
  },
});
