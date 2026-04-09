/**
 * Route: /search
 *
 * Discover screen — search for any registered user by name and navigate
 * to their public profile.
 *
 * Reuses the existing UserSearchInput component (debounced, live results).
 * Tapping a result pushes /public-profile/[userId].
 * No new backend endpoints; uses the existing GET /users/search.
 */

import { Stack, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import UserSearchInput from "@/components/UserSearchInput";
import type { UserSearchResult } from "@/types/user";

export default function SearchScreen() {
  const router = useRouter();

  function handleSelect(user: UserSearchResult) {
    router.push(`/public-profile/${user.id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Find Players" }} />
      <View style={styles.container}>
        <Text style={styles.hint}>
          Search by name to find players and send friend requests.
        </Text>
        <UserSearchInput
          onSelect={handleSelect}
          placeholder="Search by name…"
          clearOnSelect={false}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 16,
  },
  hint: {
    color: "#888",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
});
