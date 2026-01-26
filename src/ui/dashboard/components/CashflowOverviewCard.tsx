import React from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
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
import { useTranslation } from "react-i18next";

type Props = {
  cashflow: CashflowSummary;
  hideHeader?: boolean;
  noCard?: boolean;
};

export default function CashflowOverviewCard({ cashflow, hideHeader = false, noCard = false }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const incomeData = cashflow.months.map((month) => ({ x: formatMonthLabel(month.month), y: month.income }));
  const expenseData = cashflow.months.map((month) => ({ x: formatMonthLabel(month.month), y: month.expense }));
  const savingsColor = cashflow.avgSavings >= 0 ? tokens.colors.green : tokens.colors.red;
  const visibleWidth = Math.max(width - 64, 0);
  const chartWidth = Math.max(visibleWidth, cashflow.months.length * 56);
  const chartOffset = Math.max(chartWidth - visibleWidth, 0);
  const tooltipFlyout = { fill: tokens.colors.surface2, stroke: tokens.colors.border };
  const tooltipText = { fill: tokens.colors.text, fontSize: 11 };

  const content = (
    <>
      {!hideHeader && <SectionHeader title={t("dashboard.cashflow.header")} />}
      {cashflow.months.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>{t("dashboard.cashflow.empty")}</Text>
      ) : (
        <View style={[styles.layout, isCompact && styles.layoutStacked]}>
          <View style={styles.kpiCol}>
            <View style={styles.kpiRow}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("dashboard.cashflow.avgIncome")}</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatEUR(cashflow.avgIncome)}</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("dashboard.cashflow.avgExpense")}</Text>
            <Text style={[styles.kpiValue, { color: tokens.colors.text }]}>{formatEUR(cashflow.avgExpense)}</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={[styles.kpiLabel, { color: tokens.colors.muted }]}>{t("dashboard.cashflow.avgSavings")}</Text>
            <Text style={[styles.kpiValue, { color: savingsColor }]}>{formatEUR(cashflow.avgSavings)}</Text>
          </View>
          </View>
          <View style={[styles.chartCol, isCompact && styles.chartColStacked]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chartScroll, { justifyContent: "flex-end" }]}
              contentOffset={{ x: chartOffset }}
            >
              <VictoryChart
                width={chartWidth}
                height={200}
                domainPadding={{ x: 18, y: 14 }}
                padding={{ left: 40, right: 42, top: 10, bottom: 30 }}
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
                <VictoryAxis
                  dependentAxis
                  orientation="right"
                  tickFormat={(tick) => formatCompact(Number(tick))}
                  style={{
                    axis: { stroke: "transparent" },
                    grid: { stroke: "transparent" },
                    tickLabels: { fontSize: 10, fill: tokens.colors.muted, padding: 6 },
                  }}
                />
                <VictoryGroup offset={12}>
                  <VictoryBar data={incomeData} cornerRadius={4} style={{ data: { fill: tokens.colors.green, opacity: 0.85 } }} />
                  <VictoryBar data={expenseData} cornerRadius={4} style={{ data: { fill: tokens.colors.red, opacity: 0.85 } }} />
                </VictoryGroup>
              </VictoryChart>
            </ScrollView>
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
    gap: 6,
  },
  kpiLabel: {
    fontSize: 12,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  chartScroll: {
    paddingRight: 28,
  },
  empty: {},
});
