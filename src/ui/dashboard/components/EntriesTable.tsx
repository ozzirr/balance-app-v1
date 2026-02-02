import React, { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Chip from "@/ui/dashboard/components/Chip";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SmallOutlinePillButton } from "@/ui/components/EntriesUI";

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
  showPagination?: boolean;
};

const DEFAULT_MIN_WIDTH = 480;
const CATEGORY_COLUMN_WIDTH = 96;
const COLUMN_GAP = 12;
const ROWS_PER_PAGE = 7;
const DATE_COLUMN_WIDTH = 58;
const AMOUNT_COLUMN_WIDTH = 72;
const DESC_COLUMN_WIDTH = 110;
const ACTION_COLUMN_WIDTH = 52;

export default function EntriesTable({
  rows,
  emptyLabel,
  minWidth = DEFAULT_MIN_WIDTH,
  showCategory = true,
  renderAction,
  showPagination = true,
}: EntriesTableProps): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const [pageIndex, setPageIndex] = useState(0);
  const amountColorForTone = (tone: "income" | "expense") =>
    tone === "income" ? tokens.colors.income : tokens.colors.expense;
  const clampName = (name: string) => {
    if (name.length <= 10) return name;
    return `${name.slice(0, 10).trimEnd()}…`;
  };
  const columnCount = showCategory ? 5 : 4;
  const gapTotal = (columnCount - 1) * COLUMN_GAP;
  const baseTableWidth =
    DATE_COLUMN_WIDTH +
    AMOUNT_COLUMN_WIDTH +
    DESC_COLUMN_WIDTH +
    ACTION_COLUMN_WIDTH +
    (showCategory ? CATEGORY_COLUMN_WIDTH : 0) +
    gapTotal;
  const adjustedMinWidth = Math.max(baseTableWidth, Math.min(minWidth, baseTableWidth));
  const totalPages = showPagination ? Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)) : 1;
  const pageRows = useMemo(() => {
    if (!showPagination) return rows;
    const start = pageIndex * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [pageIndex, rows, showPagination]);
  const displayRows = useMemo(() => {
    if (!showPagination) return pageRows;
    const filled = [...pageRows];
    while (filled.length < ROWS_PER_PAGE) {
      filled.push(null);
    }
    return filled;
  }, [pageRows, showPagination]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(0);
    }
  }, [pageIndex, totalPages]);

  return (
    <View style={styles.tableWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
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
            data={displayRows}
            keyExtractor={(item, index) => (item ? `${item.id}` : `empty-${pageIndex}-${index}`)}
            scrollEnabled={false}
            contentContainerStyle={styles.entriesList}
            ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: tokens.colors.border }]} />}
            ListEmptyComponent={
              <Text style={{ color: tokens.colors.muted, paddingVertical: 12 }}>
                {emptyLabel ?? t("entries.empty.noEntries")}
              </Text>
            }
            renderItem={({ item }) => (
              item ? (
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
              ) : (
                <View style={styles.entryRow}>
                  <Text style={[styles.cell, styles.cellDate, styles.placeholderText]}> </Text>
                  <Text style={[styles.cell, styles.cellAmount, styles.placeholderText]}> </Text>
                  <View style={[styles.entryDescription, styles.cellDesc]}>
                    <Text style={[styles.entryName, styles.placeholderText]} numberOfLines={1}>
                      {" "}
                    </Text>
                    <Text style={[styles.entrySubtitle, styles.placeholderText]} numberOfLines={1}>
                      {" "}
                    </Text>
                  </View>
                  {showCategory ? <View style={[styles.cell, styles.cellCategory]} /> : null}
                  <View style={[styles.cell, styles.cellAction]} />
                </View>
              )
            )}
          />
        </View>
      </ScrollView>
      {showPagination && totalPages > 1 ? (
        <View style={styles.paginationWrap}>
          <View style={styles.paginationRow}>
            <SmallOutlinePillButton
              label=""
              onPress={
                pageIndex > 0
                  ? () => setPageIndex((prev) => Math.max(0, prev - 1))
                  : () => undefined
              }
              color={pageIndex > 0 ? tokens.colors.accent : tokens.colors.muted}
              icon={
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color={pageIndex > 0 ? tokens.colors.accent : tokens.colors.muted}
                />
              }
            />
            <Text style={[styles.paginationText, { color: tokens.colors.muted }]}>
              {pageIndex + 1}/{totalPages}
            </Text>
            <SmallOutlinePillButton
              label=""
              onPress={
                pageIndex < totalPages - 1
                  ? () => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))
                  : () => undefined
              }
              color={pageIndex < totalPages - 1 ? tokens.colors.accent : tokens.colors.muted}
              icon={
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={pageIndex < totalPages - 1 ? tokens.colors.accent : tokens.colors.muted}
                />
              }
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tableWrap: {
    width: "100%",
  },
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
  placeholderText: {
    opacity: 0,
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
    textAlign: "left",
  },
  cellDate: {
    width: DATE_COLUMN_WIDTH,
    flexShrink: 0,
    marginRight: 4,
  },
  cellAmount: {
    width: AMOUNT_COLUMN_WIDTH,
    flexShrink: 0,
    textAlign: "left",
  },
  cellDesc: {
    flex: 1,
    minWidth: DESC_COLUMN_WIDTH,
    maxWidth: DESC_COLUMN_WIDTH,
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
    width: CATEGORY_COLUMN_WIDTH,
    flexShrink: 0,
  },
  cellAction: {
    width: ACTION_COLUMN_WIDTH,
    flexShrink: 0,
    alignItems: "flex-end",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  paginationWrap: {
    alignItems: "center",
  },
  paginationRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  paginationText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
