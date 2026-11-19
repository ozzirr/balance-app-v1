import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR } from "@/ui/dashboard/formatters";
import type { CashflowMonth } from "@/ui/dashboard/types";

export default function MonthlyPulse({ month, onOpenCashflow }: { month: CashflowMonth; onOpenCashflow: (type?: "income" | "expense") => void }): JSX.Element {
  const { t, i18n } = useTranslation();
  const { tokens, isDark } = useDashboardTheme();
  const [year, monthNumber] = month.month.split("-").map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  const maximum = Math.max(month.income, month.expense, 1);
  const balance = month.income - month.expense;
  return (
    <View style={[styles.card, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder }]}>
      <View style={styles.header}>
        <View><Text style={[styles.eyebrow, { color: tokens.colors.muted }]}>{t("dashboard.pulse.eyebrow")}</Text><Text style={[styles.month, { color: tokens.colors.text }]}>{label}</Text></View>
        <View style={[styles.icon, { backgroundColor: tokens.colors.surface2 }]}><MaterialCommunityIcons name="chart-timeline-variant" size={21} color={tokens.colors.accent} /></View>
      </View>
      <View style={styles.metrics}>
        <Pressable accessibilityRole="button" onPress={() => onOpenCashflow("income")} style={[styles.metric, { backgroundColor: isDark ? "#FFFFFF09" : "#F4F7F5" }]}><View style={styles.metricHeader}><MaterialCommunityIcons name="arrow-bottom-left" size={16} color={tokens.colors.green} /><Text style={[styles.metricLabel, { color: tokens.colors.muted }]}>{t("dashboard.pulse.income")}</Text></View><Text style={[styles.value, { color: tokens.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatEUR(month.income)}</Text><View style={[styles.track, { backgroundColor: tokens.colors.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, month.income / maximum) * 100}%`, backgroundColor: tokens.colors.green }]} /></View></Pressable>
        <Pressable accessibilityRole="button" onPress={() => onOpenCashflow("expense")} style={[styles.metric, { backgroundColor: isDark ? "#FFFFFF09" : "#FAF4F3" }]}><View style={styles.metricHeader}><MaterialCommunityIcons name="arrow-top-right" size={16} color={tokens.colors.expense} /><Text style={[styles.metricLabel, { color: tokens.colors.muted }]}>{t("dashboard.pulse.expense")}</Text></View><Text style={[styles.value, { color: tokens.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{formatEUR(month.expense)}</Text><View style={[styles.track, { backgroundColor: tokens.colors.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, month.expense / maximum) * 100}%`, backgroundColor: tokens.colors.expense }]} /></View></Pressable>
      </View>
      <View style={[styles.footer, { borderTopColor: tokens.colors.glassBorder }]}><Text style={{ color: tokens.colors.muted, fontSize: 12 }}>{t("dashboard.pulse.net")}</Text><Text style={{ color: balance >= 0 ? tokens.colors.green : tokens.colors.expense, fontSize: 15, fontWeight: "800" }}>{balance > 0 ? "+" : ""}{formatEUR(balance)}</Text></View>
      <Text style={[styles.note, { color: tokens.colors.muted }]}>{t("dashboard.pulse.note")}</Text>
      <Pressable accessibilityRole="button" onPress={() => onOpenCashflow()} style={styles.action}><Text style={{ color: tokens.colors.accent, fontSize: 13, fontWeight: "700" }}>{t("dashboard.pulse.edit")}</Text><MaterialCommunityIcons name="arrow-right" size={18} color={tokens.colors.accent} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  month: { fontSize: 19, fontWeight: "800", marginTop: 4, textTransform: "capitalize" },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1, minWidth: 0, gap: 9, padding: 12, borderRadius: 14 }, metricHeader: { flexDirection: "row", alignItems: "center", gap: 5 }, metricLabel: { fontSize: 12 }, value: { fontSize: 20, fontWeight: "800" },
  track: { height: 5, borderRadius: 5, overflow: "hidden" }, fill: { height: 5, borderRadius: 5 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  note: { fontSize: 11, lineHeight: 15 },
  action: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
});
