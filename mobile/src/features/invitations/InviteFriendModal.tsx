/**
 * InviteFriendModal — dealer-only modal for inviting an accepted friend to a game.
 *
 * Replaces the old user-search invite flow.
 * Shows only the dealer's accepted friends list. Tapping a friend sends
 * a pending game invitation (they must accept before joining).
 *
 * Phase 4 Stage 25: increased height, client-side search filter.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useCreateInvitation } from "@/hooks/useGameInvitations";
import { queryKeys } from "@/lib/queryKeys";
import * as friendsService from "@/services/friendsService";
import type { FriendEntry } from "@/types/friendship";

interface InviteFriendModalProps {
  visible: boolean;
  gameId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function InviteFriendModal({
  visible,
  gameId,
  onSuccess,
  onClose,
}: InviteFriendModalProps) {
  const [filter, setFilter] = useState("");

  const { data: friends = [], isLoading } = useQuery({
    queryKey: queryKeys.friends,
    queryFn: friendsService.getFriends,
    enabled: visible,
  });

  const filteredFriends = useMemo(() => {
    if (!filter.trim()) return friends;
    const needle = filter.trim().toLowerCase();
    return friends.filter((f) =>
      (f.friend.full_name ?? "").toLowerCase().includes(needle),
    );
  }, [friends, filter]);

  const createInvitation = useCreateInvitation(gameId);

  function handleSelect(friend: FriendEntry) {
    createInvitation.reset();
    createInvitation.mutate(friend.friend.id, {
      onSuccess: () => {
        onSuccess();
      },
    });
  }

  function handleClose() {
    createInvitation.reset();
    setFilter("");
    onClose();
  }

  const errorMessage = createInvitation.isError
    ? createInvitation.error instanceof Error
      ? createInvitation.error.message
      : "Failed to invite friend."
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Backdrop fills top 35% so the sheet gets at least 65% */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Invite Friend</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#666"
          value={filter}
          onChangeText={setFilter}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
        />

        {isLoading ? (
          <ActivityIndicator size="small" color="#e94560" style={{ marginTop: 16 }} />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyText}>
            No friends yet. Add friends first to invite them to games.
          </Text>
        ) : filteredFriends.length === 0 ? (
          <Text style={styles.emptyText}>No friends found.</Text>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item.friendship_id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.friendRow,
                  pressed && styles.friendRowPressed,
                ]}
                onPress={() => handleSelect(item)}
                disabled={createInvitation.isPending}
              >
                <Text style={styles.friendName}>
                  {item.friend.full_name ?? "Unknown"}
                </Text>
              </Pressable>
            )}
          />
        )}

        {createInvitation.isPending && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color="#e94560" />
            <Text style={styles.statusText}>Sending invitation...</Text>
          </View>
        )}

        {createInvitation.isSuccess && (
          <View style={styles.statusRow}>
            <Text style={styles.successText}>Invitation sent!</Text>
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
    flex: 35,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    flex: 65,
    backgroundColor: "#0f0e17",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
  searchInput: {
    backgroundColor: "#1a1a3e",
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  emptyText: {
    color: "#555",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  friendRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a3e",
  },
  friendRowPressed: {
    opacity: 0.6,
  },
  friendName: {
    color: "#fff",
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
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
