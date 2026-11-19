import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import PressScale from "@/ui/dashboard/components/PressScale";
import { GlassCardContainer } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import type { KPIItem } from "@/ui/dashboard/types";

type Props = {
  item: KPIItem;
  emphasizeValue?: boolean;
  compact?: boolean;
  dense?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  rowWidth?: string;
};

export default function KPICard({ item, emphasizeValue = false, compact = false, dense = false, expanded: controlledExpanded, onToggle: onControlledToggle, rowWidth }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const [displayValue, setDisplayValue] = useState(item.value);
  const animationRef = useRef<number | null>(null);
  const icon = useMemo(() => {
    if (item.id === "liquidity") return "cash";
    if (item.id === "investments") return "trending-up";
    if (item.id === "pension") return "shield-account-outline";
    return "shield-star";
  }, [item.id]);
  const hasDelta = item.deltaStatus !== "NO_DATA";
  const deltaIsPositive = item.deltaValue >= 0;
  const deltaColor = item.deltaValue === 0 ? tokens.colors.muted : deltaIsPositive ? tokens.colors.green : tokens.colors.red;

  const onToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (onControlledToggle) onControlledToggle();
    else setLocalExpanded((prev) => !prev);
  };

  useEffect(() => {
    const from = displayValue;
    const to = item.value;
    const duration = 700;
    const start = Date.now();

    const tick = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      setDisplayValue(next);
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
  }, [item.value]);

  return (
    <PressScale onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} style={[styles.pressable, compact ? styles.pressableCompact : null, dense ? { flexBasis: 0, minWidth: 0 } : null, rowWidth ? { flexBasis: rowWidth as `${number}%`, minWidth: 0 } : null]}>
      <GlassCardContainer style={styles.card} contentStyle={dense ? styles.denseContent : compact ? styles.compactContent : undefined}>
        {compact ? (
          <View style={styles.compactMain}>
            <View style={styles.compactHeaderRow}>
              <Text style={[styles.label, styles.compactLabel, { color: tokens.colors.muted }]}>{item.label}</Text>
              <MaterialCommunityIcons name={icon} size={18} color={item.accent ?? tokens.colors.accent} />
            </View>
            <Text
              style={[styles.value, styles.valueEmphasis, styles.valueCompact, { color: tokens.colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formatEUR(displayValue)}
            </Text>
            {hasDelta ? (
              <View style={styles.compactDeltaRow}>
                <Text style={[styles.compactDeltaValue, { color: deltaColor }]}>
                  {deltaIsPositive ? "+" : ""}{formatEUR(item.deltaValue)}
                </Text>
                <Text style={[styles.compactDeltaPct, { color: deltaColor }]}>
                  {deltaIsPositive ? "+" : ""}{formatPct(item.deltaPct)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.standardMain}>
            <View style={styles.headerRow}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, { color: tokens.colors.muted, flexShrink: 1 }]}>{item.label}</Text>
              <MaterialCommunityIcons name={icon} size={16} color={item.accent ?? tokens.colors.accent} />
            </View>
            <Text
              style={[
                styles.value,
                { color: tokens.colors.text },
                emphasizeValue ? styles.valueEmphasis : null,
                dense ? styles.denseValue : null,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatEUR(displayValue)}
            </Text>
            {hasDelta ? (
              <View style={styles.deltaRow}>
                <Text style={[styles.deltaValue, { color: deltaColor }]}>
                  {deltaIsPositive ? "+" : ""}
                  {formatEUR(item.deltaValue)}
                </Text>
                <Text style={[styles.deltaPct, { color: deltaColor }]}>
                  {deltaIsPositive ? "+" : ""}
                  {formatPct(item.deltaPct)}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        {expanded && item.breakdown?.length ? (
          <View style={styles.breakdown}>
            {item.breakdown.map((row, index) => (
              <View key={`${row.label}-${index}`} style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: tokens.colors.muted }]}>{row.label}</Text>
                <Text style={[styles.breakdownValue, { color: tokens.colors.text }]}>{formatEUR(row.value)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCardContainer>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexGrow: 1,
    flexBasis: "48%",
  },
  pressableCompact: {
    flexBasis: "100%",
    width: "100%",
  },
  card: {
    gap: 6,
  },
  denseContent: { paddingHorizontal: 12, paddingVertical: 15 },
  denseValue: { fontSize: 19 },
  standardMain: {
    gap: 6,
  },
  compactMain: {
    gap: 6,
  },
  compactContent: {
    paddingVertical: 14,
  },
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compactLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  compactDeltaRow: {
    flexDirection: "row",
    gap: 7,
  },
  compactDeltaValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  compactDeltaPct: {
    fontSize: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  valueEmphasis: {
    fontSize: 28,
    fontWeight: "800",
  },
  valueCompact: {
    flexShrink: 1,
  },
  deltaRow: {
    flexDirection: "row",
    gap: 8,
  },
  deltaValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  deltaPct: {
    fontSize: 13,
  },
  breakdown: {
    marginTop: 12,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 12,
  },
});
