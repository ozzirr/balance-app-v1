import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import { VictoryPie } from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import type { DistributionItem } from "@/ui/dashboard/types";
import { useTranslation } from "react-i18next";

type Props = {
  items: DistributionItem[];
  hideHeader?: boolean;
  noCard?: boolean;
};

export default function DonutDistributionCard({ items, hideHeader = false, noCard = false }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const filteredItems = useMemo(() => items.filter((item) => item.value !== 0), [items]);
  useEffect(() => {
    if (selected !== null && selected >= filteredItems.length) {
      setSelected(null);
    }
  }, [filteredItems, selected]);
  const total = useMemo(() => filteredItems.reduce((sum, item) => sum + item.value, 0), [filteredItems]);
  const active = selected !== null ? filteredItems[selected] : null;

  const { t } = useTranslation();
  const content = (
    <>
      {!hideHeader && <SectionHeader title={t("dashboard.section.distribution")} />}
      {filteredItems.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>{t("dashboard.distribution.empty")}</Text>
      ) : (
        <View style={[styles.content, isCompact && styles.contentStacked]}>
          <View style={styles.donutWrap}>
            <VictoryPie
              height={200}
              innerRadius={60}
              padAngle={1}
              cornerRadius={6}
              data={filteredItems.map((item) => ({ x: item.label, y: item.value, color: item.color }))}
              colorScale={filteredItems.map((item) => item.color)}
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
                {active ? active.label : t("dashboard.distribution.totalLabel")}
              </Text>
              <Text style={[styles.centerPct, { color: tokens.colors.accent }]}>
                {active ? formatPct(active.value / (total || 1)) : t("dashboard.distribution.totalPercent")}
              </Text>
            </View>
          </View>
          <View style={[styles.list, styles.legendContainer, isCompact && styles.listStacked]}>
            {filteredItems.map((item, index) => {
              const isActive = index === selected;
              return (
                <PressScale key={item.id} onPress={() => setSelected(index)} style={styles.row}>
                  <View style={styles.rowTitle}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text
                      style={[styles.rowLabel, { color: tokens.colors.text }, isActive && styles.rowLabelActive]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
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
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return <PremiumCard>{content}</PremiumCard>;
}

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    gap: 16,
    paddingLeft: 14,
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
    justifyContent: "center",
  },
  listStacked: {
    paddingTop: 12,
    alignSelf: "flex-end",
    marginLeft: 0,
  },
  legendContainer: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginLeft: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    fontSize: 13,
    flexShrink: 1,
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
