import React, { useMemo, useState } from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { DashboardData, KPIItem } from "@/ui/dashboard/types";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import { GlassCardContainer } from "@/ui/components/EntriesUI";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  items: KPIItem[];
  availability: DashboardData["availability"];
};

export default function PortfolioSummaryCard({
  items,
  availability,
}: Props): JSX.Element {
  const { t, i18n } = useTranslation();
  const { tokens } = useDashboardTheme();
  const [expanded, setExpanded] = useState(false);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const netWorth = byId.get("netWorth") ?? byId.get("liquidity");
  const magnitude = Math.abs(availability.available) + Math.abs(availability.restricted);
  const availableWidth = magnitude === 0 ? 0 : (Math.abs(availability.available) / magnitude) * 100;
  const deltaIsPositive = (netWorth?.deltaValue ?? 0) >= 0;
  const deltaColor = deltaIsPositive ? tokens.colors.green : tokens.colors.red;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  return (
    <GlassCardContainer contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.colors.muted }]}>
          {netWorth?.label ?? t("dashboard.kpi.netWorth")}
        </Text>
        <MaterialCommunityIcons name="shield-star" size={19} color={tokens.colors.accent} />
      </View>
      <Text style={[styles.total, { color: tokens.colors.text }]}>{formatEUR(netWorth?.value ?? 0)}</Text>
      {netWorth?.deltaStatus !== "NO_DATA" ? (
        <View style={styles.deltaRow}>
          <Text style={[styles.deltaValue, { color: deltaColor }]}>
            {deltaIsPositive ? "+" : ""}{formatEUR(netWorth?.deltaValue ?? 0)}
          </Text>
          <Text style={[styles.deltaPct, { color: deltaColor }]}>
            {deltaIsPositive ? "+" : ""}{formatPct(netWorth?.deltaPct ?? 0)}
          </Text>
        </View>
      ) : null}

      <View style={[styles.composition, { borderTopColor: tokens.colors.glassBorder }]}> 
        <PressScale onPress={toggle} style={styles.compositionHeader}>
          <Text style={[styles.positionTitle, { color: tokens.colors.text }]}> 
            {t("dashboard.availability.title")}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={tokens.colors.muted}
          />
        </PressScale>
        {expanded ? (
          <View style={styles.details}>
            <View style={styles.position}> 
              <View style={styles.positionSummary}>
                <MetricValue label={t("dashboard.availability.available")} value={availability.available} />
                <MetricValue label={t("dashboard.availability.restrictedShort")} value={availability.restricted} />
              </View>
              <View
                style={[styles.bar, { backgroundColor: tokens.colors.surface2 }]}
                accessibilityLabel={t("dashboard.availability.ratioA11y", {
                  available: formatPct(availability.availablePct),
                  restricted: formatPct(availability.restrictedPct),
                })}
              >
                <View style={[styles.segment, { width: `${availableWidth}%`, backgroundColor: tokens.colors.green }]} />
                <View style={[styles.segment, { flex: 1, backgroundColor: tokens.colors.yellow }]} />
              </View>
              <View style={styles.legend}>
                <Text style={[styles.legendText, { color: tokens.colors.muted }]}> 
                  {formatPct(availability.availablePct)} {t("dashboard.availability.available").toLocaleLowerCase(i18n.language)}
                </Text>
                <Text style={[styles.legendText, { color: tokens.colors.muted }]}> 
                  {formatPct(availability.restrictedPct)} {t("dashboard.availability.restrictedShort").toLocaleLowerCase(i18n.language)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </GlassCardContainer>
  );
}

function MetricValue({ label, value }: { label: string; value: number }): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: tokens.colors.muted }]}>{label}</Text>
      <Text style={[styles.positionValue, { color: tokens.colors.text }]}>{formatEUR(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  total: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  deltaRow: { flexDirection: "row", gap: 8 },
  deltaValue: { fontSize: 13, fontWeight: "700" },
  deltaPct: { fontSize: 13 },
  metric: { flexGrow: 1, flexBasis: "28%", minWidth: 88 },
  metricLabel: { fontSize: 12, fontWeight: "600" },
  composition: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 5, gap: 10 },
  compositionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  positionTitle: { fontSize: 15, fontWeight: "700" },
  position: { gap: 10 },
  positionSummary: { flexDirection: "row", gap: 16 },
  positionValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  bar: { height: 9, borderRadius: 999, overflow: "hidden", flexDirection: "row" },
  segment: { height: "100%" },
  legend: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  legendText: { fontSize: 11 },
  details: { gap: 11, paddingTop: 2 },
});
