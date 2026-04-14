/**
 * Edit History screen — audit trail for retroactive edits on closed games.
 *
 * Read-only for all participants. Shows each edit chronologically with:
 *  - Who edited
 *  - What changed (edit type + before/after values)
 *  - When
 */

import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGameEdits } from "@/features/game-edits/useGameEdits";
import type { GameEdit, GameEditType } from "@/types/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDIT_TYPE_LABELS: Record<GameEditType, string> = {
  buyin_created: "Buy-in added",
  buyin_updated: "Buy-in updated",
  buyin_deleted: "Buy-in deleted",
  final_stack_updated: "Final stack updated",
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!isNaN(n)) return n.toFixed(2);
    return value;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Single edit entry
// ---------------------------------------------------------------------------

function EditEntry({ edit }: { edit: GameEdit }) {
  const label = EDIT_TYPE_LABELS[edit.edit_type] ?? edit.edit_type;

  // Determine which fields changed by comparing before/after
  const changedFields: { field: string; before: string; after: string }[] = [];

  if (edit.edit_type === "buyin_created" && edit.after_data) {
    if (edit.after_data.cash_amount != null)
      changedFields.push({ field: "Cash", before: "—", after: formatValue("cash", edit.after_data.cash_amount) });
    if (edit.after_data.chips_amount != null)
      changedFields.push({ field: "Chips", before: "—", after: formatValue("chips", edit.after_data.chips_amount) });
  } else if (edit.edit_type === "buyin_deleted" && edit.before_data) {
    if (edit.before_data.cash_amount != null)
      changedFields.push({ field: "Cash", before: formatValue("cash", edit.before_data.cash_amount), after: "—" });
    if (edit.before_data.chips_amount != null)
      changedFields.push({ field: "Chips", before: formatValue("chips", edit.before_data.chips_amount), after: "—" });
  } else if (edit.before_data && edit.after_data) {
    // For updates, show fields that differ
    const allKeys = new Set([
      ...Object.keys(edit.before_data),
      ...Object.keys(edit.after_data),
    ]);
    for (const key of allKeys) {
      // Skip IDs and metadata — only show value fields
      if (key.endsWith("_id") || key === "buy_in_type" || key.endsWith("_at")) continue;
      const before = edit.before_data[key];
      const after = edit.after_data[key];
      if (String(before) !== String(after)) {
        const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        changedFields.push({
          field: fieldLabel,
          before: formatValue(key, before),
          after: formatValue(key, after),
        });
      }
    }
  }

  return (
    <View style={styles.entry}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryType}>{label}</Text>
        <Text style={styles.entryTime}>{formatDate(edit.created_at)}</Text>
      </View>
      <Text style={styles.entryEditor}>
        by {edit.edited_by_display_name}
      </Text>
      {changedFields.length > 0 ? (
        <View style={styles.changeList}>
          {changedFields.map((change, i) => (
            <View key={i} style={styles.changeRow}>
              <Text style={styles.changeField}>{change.field}:</Text>
              <Text style={styles.changeBefore}>{change.before}</Text>
              <Text style={styles.changeArrow}> → </Text>
              <Text style={styles.changeAfter}>{change.after}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function EditHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: edits = [], isLoading, refetch, isRefetching } = useGameEdits(id);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit History" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit History" }} />
      <FlatList
        data={edits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        renderItem={({ item }) => <EditEntry edit={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#e94560"
          />
        }
        ListHeaderComponent={
          edits.length > 0 ? (
            <Text style={styles.headerText}>
              {edits.length} edit{edits.length !== 1 ? "s" : ""} recorded
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No edits have been made to this game.</Text>
          </View>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: { padding: 16, paddingBottom: 48 },
  headerText: {
    color: "#888",
    fontSize: 13,
    marginBottom: 12,
  },
  entry: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  entryType: {
    color: "#e94560",
    fontSize: 14,
    fontWeight: "700",
  },
  entryTime: {
    color: "#666",
    fontSize: 11,
  },
  entryEditor: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 8,
  },
  changeList: {
    backgroundColor: "#0f0e17",
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  changeField: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 6,
  },
  changeBefore: {
    color: "#e94560",
    fontSize: 12,
  },
  changeArrow: {
    color: "#666",
    fontSize: 12,
  },
  changeAfter: {
    color: "#2ecc71",
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "#555",
    fontSize: 15,
  },
});
