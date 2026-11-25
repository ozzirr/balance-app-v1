import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { KPIItem, KpiDeltaRange, PortfolioPoint } from "@/ui/dashboard/types";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import BottomSheet from "@/ui/components/BottomSheet";

type Props = {
  items: KPIItem[];
  series: PortfolioPoint[];
  selectedRange: KpiDeltaRange;
  rangeOptions: { value: KpiDeltaRange; label: string }[];
  onChangeRange: (range: KpiDeltaRange) => void;
};

const METRIC_COLORS: Record<string, string> = {
  liquidity: "#72E6B0",
  investments: "#9A73FF",
  pension: "#CBB5FF",
};

export default function PortfolioSummaryCard({ items, series, selectedRange, rangeOptions, onChangeRange }: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens, isDark } = useDashboardTheme();
  const [amountHidden, setAmountHidden] = useState(false);
  const [rangeVisible, setRangeVisible] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const netWorth = byId.get("netWorth") ?? byId.get("liquidity");
  const detailItems = useMemo(() => items.filter((item) => ["liquidity", "investments", "pension"].includes(item.id)), [items]);
  const [displayValue, setDisplayValue] = useState(netWorth?.value ?? 0);
  const animationRef = useRef<number | null>(null);
  const deltaIsPositive = (netWorth?.deltaValue ?? 0) >= 0;
  const deltaColor = deltaTone(netWorth, isDark, tokens.colors.muted);
  const sparkline = useMemo(() => buildSparkline(series.map((point) => point.total)), [series]);
  const compactRange = selectedRange.endsWith("D") ? selectedRange.replace("D", "G") : selectedRange;

  const toggleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.spring(flip, { toValue: next ? 1 : 0, friction: 9, tension: 72, useNativeDriver: true }).start();
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
      if (progress < 1) animationRef.current = requestAnimationFrame(tick);
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(tick);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [netWorth?.value]);

  const frontRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotation = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <>
      <View style={[styles.container, { backgroundColor: isDark ? "#211B43" : "#ECE6FB", borderColor: tokens.colors.glassBorder }]}>
        <Animated.View style={[styles.face, { transform: [{ perspective: 1000 }, { rotateY: frontRotation }] }]} pointerEvents={flipped ? "none" : "auto"}>
          <GradientBackground isDark={isDark} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.portfolioFlip.details", { defaultValue: "Mostra il dettaglio del patrimonio" })} onPress={toggleFlip} style={styles.hero}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: isDark ? "#CBBDEB" : "#65537E" }]}>{t("dashboard.portfolioTotal", { defaultValue: netWorth?.label ?? "Patrimonio totale" }).toLocaleUpperCase()}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={amountHidden ? t("dashboard.amountPrivacy.show", { defaultValue: "Mostra patrimonio" }) : t("dashboard.amountPrivacy.hide", { defaultValue: "Nascondi patrimonio" })} accessibilityState={{ selected: amountHidden }} onPress={() => setAmountHidden((value) => !value)} hitSlop={8} style={[styles.heroIcon, !isDark && { backgroundColor: "rgba(75,45,130,0.09)" }]}>
                <MaterialCommunityIcons name={amountHidden ? "eye-off-outline" : "eye-outline"} size={21} color={isDark ? "#D6C4FF" : "#7650C9"} />
              </Pressable>
            </View>
            <Text accessibilityLabel={amountHidden ? t("dashboard.amountPrivacy.hidden", { defaultValue: "Patrimonio nascosto" }) : undefined} style={[styles.total, { color: isDark ? "#FFFFFF" : "#201637" }]} numberOfLines={1} adjustsFontSizeToFit>{amountHidden ? "••••••" : formatEUR(displayValue)}</Text>
            <View style={styles.deltaRow}>
              {netWorth?.deltaStatus !== "NO_DATA" ? <>
                <Text style={[styles.deltaValue, { color: deltaColor }]}>{amountHidden ? "••••" : `${deltaIsPositive ? "+" : ""}${formatEUR(netWorth?.deltaValue ?? 0)}`}</Text>
                <Text style={[styles.deltaPct, { color: deltaColor }]}>{deltaIsPositive ? "+" : ""}{formatPct(netWorth?.deltaPct ?? 0)}</Text>
              </> : <Text style={[styles.deltaUnavailable, { color: tokens.colors.muted }]}>{t("dashboard.range.noData", { defaultValue: "Delta non disponibile" })}</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.range.title")} accessibilityState={{ expanded: rangeVisible }} onPress={() => setRangeVisible(true)} style={[styles.rangePill, { backgroundColor: "rgba(255,255,255,0.10)", borderColor: tokens.colors.glassBorder }]}>
                <Text style={[styles.rangePillText, { color: isDark ? "#E4D9FF" : tokens.colors.accent }]}>{compactRange}</Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={isDark ? "#D6C4FF" : tokens.colors.accent} />
              </Pressable>
            </View>
            <Sparkline path={sparkline} color="#79E9B5" />
            <View style={styles.flipHint}><MaterialCommunityIcons name="rotate-3d-variant" size={15} color={isDark ? "#CBBDEB" : tokens.colors.accent} /></View>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.face, styles.backFace, { transform: [{ perspective: 1000 }, { rotateY: backRotation }] }]} pointerEvents={flipped ? "auto" : "none"}>
          <GradientBackground isDark={isDark} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.portfolioFlip.total", { defaultValue: "Torna al patrimonio totale" })} onPress={toggleFlip} style={styles.backContent}>
            <View style={styles.backHeader}>
              <Text style={[styles.backTitle, { color: isDark ? "#E8E0FA" : "#39295B" }]}>{t("dashboard.portfolioComposition", { defaultValue: "Composizione patrimonio" })}</Text>
              <MaterialCommunityIcons name="rotate-3d-variant" size={19} color={isDark ? "#CBBDEB" : tokens.colors.accent} />
            </View>
            <View style={styles.detailList}>{detailItems.map((item) => <DetailMetric key={item.id} item={item} series={series} hidden={amountHidden} />)}</View>
          </Pressable>
        </Animated.View>
      </View>

      <BottomSheet visible={rangeVisible} title={t("dashboard.range.title")} subtitle={t("dashboard.range.subtitle")} onClose={() => setRangeVisible(false)}>
        {rangeOptions.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === selectedRange }} onPress={() => { setRangeVisible(false); onChangeRange(option.value); }} style={styles.rangeOption}>
          <Text style={[styles.rangeOptionText, { color: tokens.colors.text }]}>{option.label}</Text>
          {option.value === selectedRange ? <MaterialCommunityIcons name="check" size={21} color={tokens.colors.accent} /> : null}
        </Pressable>)}
      </BottomSheet>
    </>
  );
}

function DetailMetric({ item, series, hidden }: { item: KPIItem; series: PortfolioPoint[]; hidden: boolean }): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const color = METRIC_COLORS[item.id] ?? tokens.colors.accent;
  const values = series.map((point) => item.id === "liquidity" ? point.liquidity : item.id === "pension" ? point.pension ?? 0 : point.investments);
  const path = buildSparkline(values, 88, 30);
  const positive = item.deltaValue >= 0;
  const tone = deltaTone(item, isDark, tokens.colors.muted);
  return <View style={styles.detailRow}>
    <View style={styles.detailCopy}>
      <View style={styles.detailLabelRow}><View style={[styles.detailDot, { backgroundColor: color }]} /><Text numberOfLines={1} style={[styles.detailLabel, { color: isDark ? "#CFC6E3" : tokens.colors.muted }]}>{item.label}</Text></View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.detailValue, { color: isDark ? "#FFFFFF" : tokens.colors.text }]}>{hidden ? "••••" : formatEUR(item.value)}</Text>
    </View>
    <View style={styles.detailDelta}>{item.deltaStatus !== "NO_DATA" ? <Text numberOfLines={1} style={[styles.detailDeltaText, { color: tone }]}>{hidden ? "••" : `${positive ? "+" : ""}${formatEUR(item.deltaValue)}`} · {positive ? "+" : ""}{formatPct(item.deltaPct)}</Text> : null}</View>
    <View style={styles.detailChart}><Sparkline path={path} color={color} compact /></View>
  </View>;
}

function GradientBackground({ isDark }: { isDark: boolean }): JSX.Element {
  return <View style={StyleSheet.absoluteFill} pointerEvents="none"><Svg width="100%" height="100%" preserveAspectRatio="none"><Defs><LinearGradient id="portfolioGradient" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={isDark ? "#30275F" : "#E8DFFF"} /><Stop offset="0.55" stopColor={isDark ? "#211B43" : "#F1EDFF"} /><Stop offset="1" stopColor={isDark ? "#102E33" : "#DDF3EC"} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#portfolioGradient)" /><Circle cx="96%" cy="0%" r="92" fill="#AF88FF" opacity="0.08" /></Svg></View>;
}

function Sparkline({ path, color, compact = false }: { path: SparklinePath; color: string; compact?: boolean }): JSX.Element {
  const width = compact ? 88 : 320;
  const height = compact ? 30 : 86;
  const gradientId = `area-${color.replace("#", "")}`;
  return <View style={compact ? styles.compactSpark : styles.chart} pointerEvents="none"><Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={compact ? 0.18 : 0.28} /><Stop offset="1" stopColor={color} stopOpacity="0" /></LinearGradient></Defs>{path.area ? <Path d={path.area} fill={`url(#${gradientId})`} /> : null}{path.line ? <Path d={path.line} fill="none" stroke={color} strokeWidth={compact ? 1.8 : 2.4} strokeLinecap="round" strokeLinejoin="round" /> : null}{!compact && path.end ? <Circle cx={path.end.x} cy={path.end.y} r="4" fill="#F5FFFA" stroke={color} strokeWidth="2" /> : null}</Svg></View>;
}

type SparklinePath = { line: string; area: string; end: { x: number; y: number } | null };

function buildSparkline(values: number[], width = 320, height = 86): SparklinePath {
  const safeValues = values.filter(Number.isFinite);
  if (!safeValues.length) return { line: "", area: "", end: null };
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const spread = Math.max(max - min, Math.abs(max) * 0.04, 1);
  const xInset = width * 0.013;
  const top = height * 0.2;
  const bottom = height * 0.84;
  const points = safeValues.map((value, index) => ({ x: safeValues.length === 1 ? width / 2 : xInset + (index / (safeValues.length - 1)) * (width - xInset * 2), y: bottom - ((value - min) / spread) * (bottom - top) }));
  if (points.length === 1) points.unshift({ x: xInset, y: points[0].y });
  const line = points.length === 2 ? `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}` : points.slice(1).reduce((result, point, index) => {
    const previous = points[index];
    const midpointX = (previous.x + point.x) / 2;
    const midpointY = (previous.y + point.y) / 2;
    return index === points.length - 2 ? `${result} Q${previous.x.toFixed(1)},${previous.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}` : `${result} Q${previous.x.toFixed(1)},${previous.y.toFixed(1)} ${midpointX.toFixed(1)},${midpointY.toFixed(1)}`;
  }, `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
  const end = points[points.length - 1];
  return { line, area: `${line} L${end.x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`, end };
}

function deltaTone(item: KPIItem | undefined, isDark: boolean, muted: string): string {
  if (!item || item.deltaValue === 0) return muted;
  return item.deltaValue > 0 ? (isDark ? "#A5F0CE" : "#08784A") : (isDark ? "#FFB1AE" : "#B83D3D");
}

const styles = StyleSheet.create({
  container: { height: 224, borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  face: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: "hidden" },
  backFace: { zIndex: 2 },
  hero: { flex: 1, overflow: "hidden", paddingHorizontal: 22, paddingTop: 20, gap: 11 },
  heroIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  total: { color: "#FFFFFF", fontSize: 42, fontWeight: "800", letterSpacing: -1.3 },
  deltaRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8 },
  deltaValue: { fontSize: 13, fontWeight: "700" },
  deltaPct: { fontSize: 13 },
  deltaUnavailable: { fontSize: 11 },
  rangePill: { marginLeft: 3, minHeight: 27, paddingHorizontal: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 2 },
  rangePillText: { fontSize: 11, fontWeight: "800" },
  chart: { height: 78, marginHorizontal: -4, marginTop: -6 },
  flipHint: { position: "absolute", right: 18, bottom: 13, opacity: 0.72 },
  backContent: { flex: 1, paddingHorizontal: 18, paddingVertical: 15, gap: 8 },
  backHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backTitle: { fontSize: 14, fontWeight: "800" },
  detailList: { flex: 1, justifyContent: "space-between" },
  detailRow: { minHeight: 51, flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 5 },
  detailCopy: { width: "34%", minWidth: 0, gap: 2 },
  detailLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailDot: { width: 7, height: 7, borderRadius: 4 },
  detailLabel: { fontSize: 10, flexShrink: 1 },
  detailValue: { fontSize: 16, fontWeight: "800" },
  detailDelta: { width: "37%", minWidth: 0 },
  detailDeltaText: { fontSize: 10, fontWeight: "700" },
  detailChart: { flex: 1, alignItems: "flex-end" },
  compactSpark: { width: 88, height: 30 },
  rangeOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  rangeOptionText: { fontSize: 15, fontWeight: "600" },
});
