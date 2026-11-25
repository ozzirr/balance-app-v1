import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { KPIItem } from "@/ui/dashboard/types";
import { formatEUR } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  items: KPIItem[];
  onPress?: () => void;
};

const COLORS: Record<string, string> = {
  liquidity: "#72DFAD",
  investments: "#9167F4",
  pension: "#C9B2FF",
};

export default function PortfolioCompositionCard({ items, onPress }: Props): JSX.Element | null {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const composition = useMemo(
    () => items.filter((item) => ["liquidity", "investments", "pension"].includes(item.id)),
    [items]
  );
  const total = composition.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  if (!composition.length) return null;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={t("dashboard.portfolioComposition", { defaultValue: t("dashboard.section.distribution") })}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder },
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${tokens.colors.accent}1C` }]}>
          <MaterialCommunityIcons name="chart-donut" size={20} color={tokens.colors.accent} />
        </View>
        <Text style={[styles.title, { color: tokens.colors.text }]}>{t("dashboard.portfolioComposition", { defaultValue: t("dashboard.section.distribution") })}</Text>
        {onPress ? <MaterialCommunityIcons name="chevron-right" size={23} color={tokens.colors.muted} /> : null}
      </View>

      <View style={[styles.bar, { backgroundColor: tokens.colors.surface2 }]}>
        {total > 0 ? composition.map((item) => (
          <View
            key={item.id}
            style={{ height: "100%", width: `${(Math.max(0, item.value) / total) * 100}%`, backgroundColor: COLORS[item.id] ?? tokens.colors.accent }}
          />
        )) : null}
      </View>

      <View style={styles.metrics}>
        {composition.map((item) => (
          <View key={item.id} style={styles.metric}>
            <View style={styles.metricLabelRow}>
              <View style={[styles.dot, { backgroundColor: COLORS[item.id] ?? tokens.colors.accent }]} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.label, { color: tokens.colors.muted }]}>{item.label}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.value, { color: tokens.colors.text }]}>{formatEUR(item.value)}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 17, paddingVertical: 16, gap: 16 },
  pressed: { opacity: 0.86 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  bar: { height: 14, borderRadius: 999, overflow: "hidden", flexDirection: "row" },
  metrics: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  metric: { flex: 1, minWidth: 0, gap: 4 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { flex: 1, fontSize: 11 },
  value: { paddingLeft: 15, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
});
