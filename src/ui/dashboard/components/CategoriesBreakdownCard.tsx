import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatPct } from "@/ui/dashboard/formatters";
import type { CategoryRow } from "@/ui/dashboard/types";

type Props = {
  items: CategoryRow[];
  hideHeader?: boolean;
  noCard?: boolean;
};

function AnimatedBar({
  pct,
  color,
  trackColor,
}: {
  pct: number;
  color: string;
  trackColor: string;
}): JSX.Element {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 300, useNativeDriver: false }).start();
  }, [pct, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
    </View>
  );
}

export default function CategoriesBreakdownCard({ items, hideHeader = false, noCard = false }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const content = (
    <>
      {!hideHeader && <SectionHeader title="Spese per categoria" />}
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>Nessun dato disponibile.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.label, { color: tokens.colors.text }]}>{item.label}</Text>
                <Text style={[styles.value, { color: tokens.colors.text }]}>{formatEUR(item.value)}</Text>
                <Text style={[styles.pct, { color: tokens.colors.muted }]}>{formatPct(item.pct)}</Text>
              </View>
              <AnimatedBar pct={item.pct} color={item.color} trackColor={tokens.colors.surface2} />
            </View>
          ))}
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
  list: {
    gap: 12,
  },
  row: {
    gap: 6,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
  },
  pct: {
    fontSize: 12,
    width: 48,
    textAlign: "right",
  },
  barTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
  },
  empty: {},
});
