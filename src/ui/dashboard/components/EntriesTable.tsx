import React from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Chip from "@/ui/dashboard/components/Chip";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";

export type EntriesTableRow<M = unknown> = {
  id: string | number;
  dateLabel: string;
  amountLabel: string;
  amountTone: "income" | "expense";
  amountColor?: string;
  name: string;
  subtitle?: string;
  categoryLabel: string;
  categoryColor?: string;
  meta?: M;
};

type EntriesTableProps = {
  rows: EntriesTableRow[];
  emptyLabel?: string;
  minWidth?: number;
  showCategory?: boolean;
  renderAction?: (row: EntriesTableRow) => React.ReactNode;
};

const DEFAULT_MIN_WIDTH = 480;
const CATEGORY_COLUMN_WIDTH = 96;
const COLUMN_GAP = 12;

export default function EntriesTable({
  rows,
  emptyLabel,
  minWidth = DEFAULT_MIN_WIDTH,
  showCategory = true,
  renderAction,
}: EntriesTableProps): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const amountColorForTone = (tone: "income" | "expense") =>
    tone === "income" ? tokens.colors.income : tokens.colors.expense;
  const clampName = (name: string) => {
    if (name.length <= 10) return name;
    return `${name.slice(0, 10).trimEnd()}…`;
  };
  const adjustedMinWidth = Math.max(minWidth - (showCategory ? 0 : CATEGORY_COLUMN_WIDTH), 340);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ minWidth: adjustedMinWidth }}
    >
      <View style={{ minWidth: adjustedMinWidth }}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDate]}>
            {t("entries.list.table.date", { defaultValue: "Data" })}
          </Text>
          <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAmount]}>
            {t("entries.list.table.amount", { defaultValue: "Importo" })}
          </Text>
          <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDesc]}>
            {t("entries.list.table.name", { defaultValue: "Nome" })}
          </Text>
          {showCategory ? (
            <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellCategory]}>
              {t("entries.list.table.category", { defaultValue: "Categoria" })}
            </Text>
          ) : null}
          <View style={[styles.headerCell, styles.cellAction]} />
        </View>
        <View style={[styles.divider, { backgroundColor: tokens.colors.border }]} />
        <FlatList
          data={rows}
          keyExtractor={(item) => `${item.id}`}
          scrollEnabled={false}
          contentContainerStyle={styles.entriesList}
          ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: tokens.colors.border }]} />}
          ListEmptyComponent={
            <Text style={{ color: tokens.colors.muted, paddingVertical: 12 }}>
              {emptyLabel ?? t("entries.empty.noEntries")}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.entryRow}>
              <Text style={[styles.cell, styles.cellDate]}>{item.dateLabel}</Text>
              <Text style={[styles.cell, styles.cellAmount, { color: item.amountColor ?? amountColorForTone(item.amountTone) }]}>
                {item.amountLabel}
              </Text>
              <View style={[styles.entryDescription, styles.cellDesc]}>
                <Text style={[styles.entryName, { color: tokens.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {clampName(item.name)}
                </Text>
                {item.subtitle ? (
                  <Text style={[styles.entrySubtitle, { color: tokens.colors.muted }]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              {showCategory ? (
                <View style={[styles.cell, styles.cellCategory]}>
                  <Chip label={item.categoryLabel} color={item.categoryColor ?? tokens.colors.muted} />
                </View>
              ) : null}
              <View style={[styles.cell, styles.cellAction]}>{renderAction?.(item) ?? null}</View>
            </View>
          )}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  entriesList: {
    paddingVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: COLUMN_GAP,
    paddingBottom: 6,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 0,
    textAlign: "left",
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: COLUMN_GAP,
    width: "100%",
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
    textAlign: "left",
  },
  cellDate: {
    width: 58,
    flexShrink: 0,
    marginRight: 4,
  },
  cellAmount: {
    width: 72,
    flexShrink: 0,
    textAlign: "left",
  },
  cellDesc: {
    flex: 1,
    minWidth: 110,
    maxWidth: 110,
    paddingLeft: 10,
  },
  entryDescription: {
    flex: 1,
    gap: 2,
  },
  entryName: {
    fontSize: 14,
    fontWeight: "700",
  },
  entrySubtitle: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  cellCategory: {
    width: 96,
    flexShrink: 0,
  },
  cellAction: {
    width: 52,
    flexShrink: 0,
    alignItems: "flex-end",
  },
  divider: {
    height: 1,
    width: "100%",
  },
});
