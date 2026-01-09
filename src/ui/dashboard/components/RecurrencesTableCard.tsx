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

export default function RecurrencesTableCard({ rows, onPressRow }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <PremiumCard>
      <SectionHeader title="Prossimi movimenti programmati" />
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
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellType]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Tipo
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAmount, styles.headerAmount]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Importo
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellCategory]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Categoria
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDesc]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Descrizione
              </Text>
              <Text
                style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAction]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Modifica
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
                    <View style={[styles.cell, styles.cellType]}>
                      <Chip
                        label={item.type === "income" ? "Entrata" : "Uscita"}
                        tone={item.type === "income" ? "green" : "red"}
                      />
                    </View>
                    <Text style={[styles.cell, styles.cellAmount, { color: amountColor }]}>
                      {formatEUR(item.amount)}
                    </Text>
                    <View style={[styles.cell, styles.cellCategory]}>
                      <Chip label={item.category} color={categoryColor} />
                    </View>
                    <Text style={[styles.cell, { color: tokens.colors.muted }, styles.cellDesc]}>
                      {item.description}
                    </Text>
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
    </PremiumCard>
  );
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
    width: 650,
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
  },
  cellDate: {
    width: 64,
    flexShrink: 0,
    marginRight: 6,
  },
  cellType: {
    width: 100,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6,
    marginRight: 0,
  },
  cellCategory: {
    width: 140,
    flexShrink: 1,
    marginRight: 6,
  },
  cellAction: {
    width: 90,
    flexShrink: 0,
    alignItems: "flex-end",
  },
  cellDesc: {
    width: 220,
    flexShrink: 1,
    marginRight: 6,
  },
  cellAmount: {
    width: 88,
    textAlign: "center",
    fontWeight: "700",
    flexShrink: 0,
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
