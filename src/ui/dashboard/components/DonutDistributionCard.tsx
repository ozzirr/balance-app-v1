import React, { useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import { VictoryPie } from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import type { DistributionItem } from "@/ui/dashboard/types";

type Props = {
  items: DistributionItem[];
};

export default function DonutDistributionCard({ items }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const total = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);
  const active = selected !== null ? items[selected] : null;

  return (
    <PremiumCard>
      <SectionHeader title="Distribuzione patrimonio" />
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun dato disponibile.</Text>
      ) : (
        <View style={[styles.content, isCompact && styles.contentStacked]}>
          <View style={styles.donutWrap}>
            <VictoryPie
              height={200}
              innerRadius={60}
              padAngle={1}
              cornerRadius={6}
              data={items.map((item) => ({ x: item.label, y: item.value, color: item.color }))}
              colorScale={items.map((item) => item.color)}
              labels={() => ""}
              radius={({ index }) => (index === selected ? 100 : 92)}
              style={{ data: { stroke: tokens.colors.surface2, strokeWidth: 2 } }}
              events={[
                {
                  target: "data",
                  eventHandlers: {
                    onPressIn: (_, props) => {
                      setSelected(props.index);
                      return [];
                    },
                  },
                },
              ]}
            />
            <View style={styles.centerLabel}>
              <Text style={[styles.centerValue, { color: tokens.colors.text }]}>
                {formatEUR(active ? active.value : total)}
              </Text>
              <Text style={[styles.centerLabelText, { color: tokens.colors.muted }]}>
                {active ? active.label : "Totale"}
              </Text>
              <Text style={[styles.centerPct, { color: tokens.colors.accent }]}>
                {active ? formatPct(active.value / (total || 1)) : "100%"}
              </Text>
            </View>
          </View>
          <View style={[styles.list, isCompact && styles.listStacked]}>
            {items.map((item, index) => {
              const isActive = index === selected;
              return (
                <PressScale key={item.id} onPress={() => setSelected(index)} style={styles.row}>
                  <View style={styles.rowTitle}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={[styles.rowLabel, { color: tokens.colors.text }, isActive && styles.rowLabelActive]}>
                      {item.label}
                    </Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={[styles.rowPct, { color: tokens.colors.muted }]}>
                      {formatPct(item.value / (total || 1))}
                    </Text>
                    <Text style={[styles.rowValue, { color: tokens.colors.text }]}>{formatEUR(item.value)}</Text>
                  </View>
                </PressScale>
              );
            })}
          </View>
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    gap: 16,
  },
  contentStacked: {
    flexDirection: "column",
  },
  donutWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
  },
  centerValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  centerLabelText: {
    fontSize: 13,
  },
  centerPct: {
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    flex: 1,
    gap: 10,
  },
  listStacked: {
    paddingTop: 12,
  },
  row: {
    gap: 4,
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowLabelActive: {
    fontWeight: "600",
  },
  rowPct: {
    fontSize: 12,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {},
});
