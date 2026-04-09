/**
 * FriendsScreen — shows two tabs:
 *  1. Friends      — list of accepted friends with navigation to their public profile
 *  2. Requests     — incoming pending friend requests with accept/decline actions
 *
 * Navigation: tapping a friend navigates to /public-profile/[userId].
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import FriendRequestCard from "@/features/friends/FriendRequestCard";
import { useFriends, useIncomingFriendRequests } from "@/hooks/useFriends";
import type { FriendEntry } from "@/types/friendship";

type Tab = "friends" | "requests";

// ---------------------------------------------------------------------------
// Friend list item
// ---------------------------------------------------------------------------

function FriendItem({ entry }: { entry: FriendEntry }) {
  const router = useRouter();
  const name = entry.friend.full_name ?? "Unknown Player";
  const initials = name.charAt(0).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [styles.friendItem, pressed && styles.friendItemPressed]}
      onPress={() => router.push(`/public-profile/${entry.friend.id}`)}
    >
      {entry.friend.profile_image_url ? (
        <Image source={{ uri: entry.friend.profile_image_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.friendName}>{name}</Text>
      <Text style={styles.chevron}>{"›"}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("friends");

  const friendsQuery = useFriends();
  const requestsQuery = useIncomingFriendRequests();

  const incomingCount = requestsQuery.data?.length ?? 0;

  const isLoading =
    activeTab === "friends" ? friendsQuery.isLoading : requestsQuery.isLoading;

  const isRefreshing =
    activeTab === "friends" ? friendsQuery.isFetching : requestsQuery.isFetching;

  function handleRefresh() {
    if (activeTab === "friends") {
      friendsQuery.refetch();
    } else {
      requestsQuery.refetch();
    }
  }

  return (
    <View style={styles.container}>
      {/* Find Players CTA */}
      <Pressable
        style={styles.findPlayersBtn}
        onPress={() => router.push("/search")}
      >
        <Text style={styles.findPlayersIcon}>🔍</Text>
        <Text style={styles.findPlayersText}>Find Players</Text>
      </Pressable>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "friends" && styles.tabActive]}
          onPress={() => setActiveTab("friends")}
        >
          <Text style={[styles.tabText, activeTab === "friends" && styles.tabTextActive]}>
            Friends {friendsQuery.data ? `(${friendsQuery.data.length})` : ""}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === "requests" && styles.tabActive]}
          onPress={() => setActiveTab("requests")}
        >
          <View style={styles.tabRow}>
            <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>
              Requests
            </Text>
            {incomingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{incomingCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#e94560" />
        </View>
      ) : activeTab === "friends" ? (
        <FlatList
          data={friendsQuery.data ?? []}
          keyExtractor={(item) => item.friendship_id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#e94560"
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No friends yet.</Text>
              <Text style={styles.emptyHint}>
                Search for players from their profile and send a friend request.
              </Text>
            </View>
          }
          renderItem={({ item }) => <FriendItem entry={item} />}
        />
      ) : (
        <FlatList
          data={requestsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#e94560"
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No pending requests.</Text>
            </View>
          }
          renderItem={({ item }) => <FriendRequestCard request={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  findPlayersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#16213e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a5a",
  },
  findPlayersIcon: { fontSize: 16 },
  findPlayersText: {
    color: "#e94560",
    fontSize: 14,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a5a",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#e94560",
  },
  tabText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    backgroundColor: "#e94560",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  list: {
    padding: 16,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyHint: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  friendItemPressed: {
    opacity: 0.7,
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
  friendName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  chevron: {
    color: "#666",
    fontSize: 20,
  },
});
