/**
 * Route: /notifications
 *
 * Thin shell that mounts NotificationsScreen with the correct header title.
 */

import { Stack } from "expo-router";
import { View } from "react-native";

import NotificationsScreen from "@/features/notifications/NotificationsScreen";

export default function NotificationsRoute() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Notifications" }} />
      <NotificationsScreen />
    </View>
  );
}
