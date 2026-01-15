import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import Chip from "@/ui/dashboard/components/Chip";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatShortDate } from "@/ui/dashboard/formatters";
import type { RecurrenceRow } from "@/ui/dashboard/types";

type Props = {
  rows: RecurrenceRow[];
  onPressRow?: (row: RecurrenceRow) => void;
  hideHeader?: boolean;
  noCard?: boolean;
};

const categoryPalette = ["#9B7BFF", "#5C9DFF", "#F6C177", "#66D19E", "#C084FC", "#FF8FAB", "#6EE7B7", "#94A3B8"];

function hashLabel(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function RecurrencesTableCard({
  rows,
  onPressRow,
  hideHeader = false,
  noCard = false,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const content = (
    <>
      {!hideHeader && <SectionHeader title="Prossimi movimenti" />}
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun movimento programmato.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.table}>
          <View>
            <View style={styles.headerRow}>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDate]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Data
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAmount]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Importo
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDesc]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Nome
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellCategory]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Categoria
              </Text>
            </View>
            {rows.map((item, index) => {
              const amountColor = item.type === "income" ? tokens.colors.green : tokens.colors.red;
              const categoryColor =
                item.type === "income"
                  ? tokens.colors.green
                  : item.categoryColor ?? categoryPalette[hashLabel(item.category) % categoryPalette.length];
              return (
                <React.Fragment key={item.id}>
                  <View style={styles.row}>
                    <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellDate]}>
                      {formatShortDate(item.date)}
                    </Text>
                    <Text style={[styles.cell, styles.cellAmount, { color: amountColor }]}>
                      {formatEUR(item.amount)}
                    </Text>
                    <Text
                      style={[styles.cell, { color: tokens.colors.text }, styles.cellDesc]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.description}
                    </Text>
                    <View style={[styles.cell, styles.cellCategory]}>
                      <Chip label={item.category} color={categoryColor} />
                    </View>
                    <View style={[styles.cell, styles.cellAction]}>
                      <PressScale
                        onPress={() => onPressRow?.(item)}
                        style={[
                          styles.actionButton,
                          { borderColor: tokens.colors.accent, backgroundColor: `${tokens.colors.accent}14` },
                        ]}
                      >
                        <Text style={[styles.actionText, { color: tokens.colors.accent }]}>Modifica</Text>
                      </PressScale>
                    </View>
                  </View>
                  {index < rows.length - 1 ? (
                    <View style={[styles.separator, { backgroundColor: tokens.colors.border }]} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      )}
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return <PremiumCard>{content}</PremiumCard>;
}

const styles = StyleSheet.create({
  table: {
    gap: 12,
    paddingBottom: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    flexWrap: "nowrap",
    gap: 12,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 0,
    textAlign: "left",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    flexWrap: "nowrap",
    width: 480,
    gap: 12,
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
    textAlign: "left",
  },
  cellCenter: {
    textAlign: "center",
  },
  cellDate: {
    width: 70,
    flexShrink: 0,
    marginRight: 6,
  },
  cellCategory: {
    width: 120,
    flexShrink: 1,
    marginRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  cellAction: {
    width: 80,
    flexShrink: 0,
    alignItems: "center",
  },
  cellDesc: {
    width: 100,
    flexShrink: 1,
    marginRight: 4,
  },
  cellAmount: {
    width: 58,
    textAlign: "center",
    fontWeight: "700",
    flexShrink: 0,
    marginRight: 4,
  },
  headerAmount: {
    textAlign: "left",
  },
  separator: {
    height: 1,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {},
});
