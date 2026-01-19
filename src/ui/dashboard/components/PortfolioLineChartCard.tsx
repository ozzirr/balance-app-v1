import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import PressScale from "@/ui/dashboard/components/PressScale";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatCompact, formatEUR, formatMonthLabel } from "@/ui/dashboard/formatters";
import type { PortfolioPoint } from "@/ui/dashboard/types";

type Mode = "total" | "liquidity" | "investments";

type Props = {
  data: PortfolioPoint[];
  hideHeader?: boolean;
  noCard?: boolean;
};

export default function PortfolioLineChartCard({ data, hideHeader = false, noCard = false }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [mode, setMode] = useState<Mode>("total");
  const { width } = useWindowDimensions();

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        x: point.date,
        y: mode === "total" ? point.total : mode === "liquidity" ? point.liquidity : point.investments,
      })),
    [data, mode]
  );

  const highestValue = chartData.reduce((max, point) => Math.max(max, point.y), 0);
  const domainMax = highestValue > 0 ? highestValue * 1.08 : 1;

  const visibleWidth = Math.max(width - 64, 0);
  const chartWidth = Math.max(visibleWidth, chartData.length * 70);
  const chartOffset = Math.max(chartWidth - visibleWidth, 0);

  const content = (
    <>
      {!hideHeader && <SectionHeader title="Il tuo andamento nel tempo" />}
      <View style={styles.toggleRow}>
        {(["total", "liquidity", "investments"] as Mode[]).map((item) => {
          const label = item === "total" ? "Totale" : item === "liquidity" ? "Liquidità" : "Investimenti";
          const active = item === mode;
          return (
            <PressScale
              key={item}
              style={[
                styles.toggle,
                { backgroundColor: tokens.colors.surface2, borderColor: tokens.colors.border },
                active && styles.toggleActive,
                active && { borderColor: tokens.colors.accent, backgroundColor: `${tokens.colors.accent}33` },
              ]}
              onPress={() => setMode(item)}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: tokens.colors.muted },
                  active && styles.toggleTextActive,
                  active && { color: tokens.colors.text },
                ]}
              >
                {label}
              </Text>
            </PressScale>
          );
        })}
      </View>
      {chartData.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun dato disponibile.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chartScroll, { justifyContent: "flex-end" }]}
          contentOffset={{ x: chartOffset }}
        >
          <VictoryChart
            width={chartWidth}
            height={260}
            padding={{ left: 50, right: 42, top: 18, bottom: 30 }}
            domain={{ y: [0, domainMax] }}
            containerComponent={
              <VictoryVoronoiContainer
                voronoiBlacklist={["area"]}
                labels={({ datum }) => `${formatMonthLabel(String(datum.x))} • ${formatEUR(datum.y)}`}
                labelComponent={
                  <VictoryTooltip
                    flyoutStyle={{ fill: tokens.colors.surface2, stroke: tokens.colors.border }}
                    style={{ fill: tokens.colors.text, fontSize: 12 }}
                    cornerRadius={12}
                    pointerLength={8}
                    flyoutPadding={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  />
                }
              />
            }
          >
            <VictoryAxis
              tickFormat={(tick) => formatMonthLabel(String(tick))}
              style={{
                axis: { stroke: "transparent" },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(tick) => formatCompact(Number(tick))}
              style={{
                axis: { stroke: "transparent" },
                grid: { stroke: tokens.colors.border },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            <VictoryAxis
              dependentAxis
              orientation="right"
              tickFormat={(tick) => formatCompact(Number(tick))}
              style={{
                axis: { stroke: "transparent" },
                grid: { stroke: "transparent" },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            <VictoryArea
              name="area"
              data={chartData}
              interpolation="natural"
              style={{ data: { fill: `${tokens.colors.accent}3B` } }}
            />
            <VictoryLine
              data={chartData}
              interpolation="natural"
              style={{ data: { stroke: tokens.colors.accent, strokeWidth: 2.5 } }}
            />
          </VictoryChart>
        </ScrollView>
      )}
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return (
    <View>
      <PremiumCard>{content}</PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toggleActive: {
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 12,
  },
  toggleTextActive: {
    fontWeight: "600",
  },
  empty: {
    fontSize: 13,
  },
  chartScroll: {
    paddingRight: 28,
  },
});
