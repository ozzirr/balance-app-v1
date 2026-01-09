import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryGroup,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatCompact, formatEUR, formatMonthLabel } from "@/ui/dashboard/formatters";
import type { CashflowSummary } from "@/ui/dashboard/types";

type Props = {
  cashflow: CashflowSummary;
};

export default function CashflowOverviewCard({ cashflow }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const incomeData = cashflow.months.map((month) => ({ x: formatMonthLabel(month.month), y: month.income }));
  const expenseData = cashflow.months.map((month) => ({ x: formatMonthLabel(month.month), y: month.expense }));
  const savingsColor = cashflow.avgSavings >= 0 ? tokens.colors.green : tokens.colors.red;
  const tooltipFlyout = { fill: tokens.colors.surface2, stroke: tokens.colors.border };
  const tooltipText = { fill: tokens.colors.text, fontSize: 11 };

  return (
    <PremiumCard>
      <SectionHeader title="Cash Flow. Panoramica" />
      {cashflow.months.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun dato disponibile.</Text>
      ) : (
        <View style={[styles.layout, isCompact && styles.layoutStacked]}>
          <View style={styles.kpiCol}>
            <View style={styles.kpiRow}>
              <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>Entrate medie</Text>
              <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatEUR(cashflow.avgIncome)}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>Uscite medie</Text>
              <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatEUR(cashflow.avgExpense)}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>Risparmio medio</Text>
              <Text style={[styles.kpiValue, { color: savingsColor }]}>{formatEUR(cashflow.avgSavings)}</Text>
            </View>
            <Text style={[styles.legendHint, { color: tokens.colors.muted }]}>Entrate vs Uscite</Text>
          </View>
          <View style={[styles.chartCol, isCompact && styles.chartColStacked]}>
            <VictoryChart
              height={200}
              domainPadding={{ x: 18, y: 14 }}
              padding={{ left: 40, right: 10, top: 10, bottom: 30 }}
              containerComponent={
                <VictoryVoronoiContainer
                labels={({ datum }) => `${datum.x} • ${formatEUR(datum.y)}`}
                  labelComponent={
                    <VictoryTooltip
                      flyoutStyle={tooltipFlyout}
                      style={tooltipText}
                      cornerRadius={10}
                      pointerLength={6}
                    />
                  }
                />
              }
            >
              <VictoryAxis
                tickFormat={(tick) => String(tick)}
                style={{
                  axis: { stroke: "transparent" },
                  tickLabels: { fontSize: 10, fill: tokens.colors.muted, padding: 6 },
                }}
              />
              <VictoryAxis
                dependentAxis
                tickFormat={(tick) => formatCompact(Number(tick))}
                style={{
                  axis: { stroke: "transparent" },
                  grid: { stroke: tokens.colors.border },
                  tickLabels: { fontSize: 10, fill: tokens.colors.muted, padding: 6 },
                }}
              />
              <VictoryGroup offset={12}>
                <VictoryBar data={incomeData} cornerRadius={4} style={{ data: { fill: tokens.colors.green, opacity: 0.85 } }} />
                <VictoryBar data={expenseData} cornerRadius={4} style={{ data: { fill: tokens.colors.red, opacity: 0.85 } }} />
              </VictoryGroup>
            </VictoryChart>
          </View>
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  layout: {
    flexDirection: "row",
    gap: 16,
  },
  layoutStacked: {
    flexDirection: "column",
  },
  kpiCol: {
    flex: 1,
    gap: 12,
  },
  chartCol: {
    flex: 1.4,
  },
  chartColStacked: {
    flex: 1,
  },
  kpiRow: {
    gap: 4,
  },
  kpiLabel: {
    fontSize: 12,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  legendHint: {
    fontSize: 12,
    marginTop: 6,
  },
  empty: {},
});
