import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { DashboardData, KPIItem } from "@/ui/dashboard/types";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";

type Props = {
  items: KPIItem[];
  availability: DashboardData["availability"];
  onOpenDistribution?: () => void;
};

export default function PortfolioSummaryCard({
  items,
  availability,
  onOpenDistribution,
}: Props): JSX.Element {
  const { t, i18n } = useTranslation();
  const { tokens, isDark } = useDashboardTheme();
  const [expanded, setExpanded] = useState(false);
  const [amountHidden, setAmountHidden] = useState(false);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const netWorth = byId.get("netWorth") ?? byId.get("liquidity");
  const [displayValue, setDisplayValue] = useState(netWorth?.value ?? 0);
  const animationRef = useRef<number | null>(null);
  const magnitude = Math.abs(availability.available) + Math.abs(availability.restricted);
  const availableWidth = magnitude === 0 ? 0 : (Math.abs(availability.available) / magnitude) * 100;
  const deltaIsPositive = (netWorth?.deltaValue ?? 0) >= 0;
  const deltaColor = (netWorth?.deltaValue ?? 0) === 0 ? (isDark ? "#D4C8F5" : "#5D5278") : deltaIsPositive ? (isDark ? "#A5F0CE" : "#08784A") : (isDark ? "#FFB1AE" : "#B83D3D");

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  useEffect(() => {
    const from = displayValue;
    const to = netWorth?.value ?? 0;
    const duration = 700;
    const start = Date.now();

    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (to - from) * eased);
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [netWorth?.value]);

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder }]}>
      <View style={[styles.hero, { backgroundColor: isDark ? "#211B43" : "#ECE6FB" }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="portfolioGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={isDark ? "#30275F" : "#E8DFFF"} />
              <Stop offset="0.55" stopColor={isDark ? "#211B43" : "#F1EDFF"} />
              <Stop offset="1" stopColor={isDark ? "#102E33" : "#DDF3EC"} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#portfolioGradient)" />
          <Circle cx="96%" cy="0%" r="92" fill="#AF88FF" opacity="0.10" />
          <Circle cx="87%" cy="15%" r="56" fill="#B79DFF" opacity="0.08" />
        </Svg></View>
        <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? "#D4C8F5" : "#65537E" }]}>
          {netWorth?.label ?? t("dashboard.kpi.netWorth")}
        </Text>
        <View style={styles.heroActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={amountHidden ? t("dashboard.amountPrivacy.show", { defaultValue: "Mostra patrimonio" }) : t("dashboard.amountPrivacy.hide", { defaultValue: "Nascondi patrimonio" })} accessibilityState={{ selected: amountHidden }} onPress={() => setAmountHidden((value) => !value)} hitSlop={8} style={[styles.heroIcon, !isDark && { backgroundColor: "rgba(75,45,130,0.09)" }]}><MaterialCommunityIcons name={amountHidden ? "eye-off-outline" : "eye-outline"} size={21} color={isDark ? "#D6C4FF" : "#7650C9"} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.chartChooser.title")} onPress={onOpenDistribution} hitSlop={8} style={[styles.heroIcon, !isDark && { backgroundColor: "rgba(75,45,130,0.09)" }]}><MaterialCommunityIcons name="chart-donut" size={21} color={isDark ? "#D6C4FF" : "#7650C9"} /></Pressable>
        </View>
      </View>
      <Text accessibilityLabel={amountHidden ? t("dashboard.amountPrivacy.hidden", { defaultValue: "Patrimonio nascosto" }) : undefined} style={[styles.total, { color: isDark ? "#FFFFFF" : "#201637" }]} numberOfLines={1} adjustsFontSizeToFit>{amountHidden ? "••••••" : formatEUR(displayValue)}</Text>
      {netWorth?.deltaStatus !== "NO_DATA" ? (
        <View style={styles.deltaRow}>
          <Text style={[styles.deltaValue, { color: deltaColor }]}>
            {amountHidden ? "••••" : `${deltaIsPositive ? "+" : ""}${formatEUR(netWorth?.deltaValue ?? 0)}`}
          </Text>
          <Text style={[styles.deltaPct, { color: deltaColor }]}>
            {deltaIsPositive ? "+" : ""}{formatPct(netWorth?.deltaPct ?? 0)}
          </Text>
        </View>
      ) : null}
      <View style={styles.heroFoot}><MaterialCommunityIcons name="shield-check-outline" size={14} color={isDark ? "#B8E5CF" : "#216B53"} /><Text style={[styles.heroFootText, { color: isDark ? "#C2DCD0" : "#286550" }]}>{t("dashboard.portfolioPrivate")}</Text></View>
      </View>

      <View style={[styles.composition, { borderTopColor: tokens.colors.glassBorder }]}> 
        <PressScale onPress={toggle} style={styles.compositionHeader}>
          <View style={styles.compositionHeading}>
            <View style={[styles.compositionIcon, { backgroundColor: `${tokens.colors.accent}1C` }]}><MaterialCommunityIcons name="chart-donut-variant" size={18} color={tokens.colors.accent} /></View>
            <View><Text style={[styles.positionTitle, { color: tokens.colors.text }]}>{t("dashboard.availability.title")}</Text>
            {!expanded ? <Text style={[styles.compositionHint, { color: tokens.colors.muted }]}>{formatPct(availability.availablePct)} {t("dashboard.availability.available").toLocaleLowerCase(i18n.language)} · {formatPct(availability.restrictedPct)} {t("dashboard.availability.restrictedShort").toLocaleLowerCase(i18n.language)}</Text> : null}</View>
          </View>
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
    </View>
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
  container: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  hero: { overflow: "hidden", backgroundColor: "#211B43", padding: 22, minHeight: 190, justifyContent: "space-between", gap: 14 },
  heroIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroFoot: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroFootText: { color: "#C2DCD0", fontSize: 11, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  total: { color: "#FFFFFF", fontSize: 42, fontWeight: "800", letterSpacing: -1.3 },
  deltaRow: { flexDirection: "row", gap: 8 },
  deltaValue: { fontSize: 13, fontWeight: "700" },
  deltaPct: { fontSize: 13 },
  metric: { flexGrow: 1, flexBasis: "28%", minWidth: 88 },
  metricLabel: { fontSize: 12, fontWeight: "600" },
  composition: { paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  compositionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compositionHeading: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  compositionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  compositionHint: { fontSize: 11, marginTop: 2 },
  positionTitle: { fontSize: 14, fontWeight: "700" },
  position: { gap: 10 },
  positionSummary: { flexDirection: "row", gap: 16 },
  positionValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  bar: { height: 9, borderRadius: 999, overflow: "hidden", flexDirection: "row" },
  segment: { height: "100%" },
  legend: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  legendText: { fontSize: 11 },
  details: { gap: 11, paddingTop: 2 },
});
