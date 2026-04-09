/**
 * FriendRequestCard — displays a single incoming friend request with
 * Accept and Decline action buttons.
 *
 * Used inside FriendsScreen's "Requests" tab.
 */

import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useAcceptFriendRequest, useDeclineFriendRequest } from "@/hooks/useFriends";
import type { IncomingRequestEntry } from "@/types/friendship";

interface FriendRequestCardProps {
  request: IncomingRequestEntry;
}

export default function FriendRequestCard({ request }: FriendRequestCardProps) {
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();

  const isPending = accept.isPending || decline.isPending;
  const name = request.requester.full_name ?? "Unknown Player";
  const initials = name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {/* Avatar */}
      {request.requester.profile_image_url ? (
        <Image source={{ uri: request.requester.profile_image_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}

      {/* Name */}
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtext}>Wants to be your friend</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {isPending ? (
          <ActivityIndicator color="#e94560" />
        ) : (
          <>
            <Pressable
              style={[styles.btn, styles.acceptBtn]}
              onPress={() => accept.mutate(request.id)}
              disabled={isPending}
            >
              <Text style={styles.acceptText}>Accept</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.declineBtn]}
              onPress={() => decline.mutate(request.id)}
              disabled={isPending}
            >
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e94560",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  subtext: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  btn: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  acceptBtn: {
    backgroundColor: "#e94560",
  },
  declineBtn: {
    backgroundColor: "#2a2a5a",
  },
  acceptText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  declineText: {
    color: "#cccccc",
    fontSize: 13,
  },
});
