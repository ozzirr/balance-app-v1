import React from "react";
import { StyleSheet, View } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { KPIItem } from "@/ui/dashboard/types";
import KPICard from "@/ui/dashboard/components/KPICard";

type Props = {
  items: KPIItem[];
};

export default function KPIStrip({ items }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const primaryItems = items.filter((item) => item.id === "liquidity" || item.id === "investments");
  const secondaryItems = items.filter((item) => item.id !== "liquidity" && item.id !== "investments");

  return (
    <View style={[styles.container, { gap: tokens.spacing.sm }]}>
      {primaryItems.length > 0 ? (
        <View style={[styles.row, { gap: tokens.spacing.sm }]}>
          {primaryItems.map((item) => (
            <KPICard key={item.id} item={item} emphasizeValue />
          ))}
        </View>
      ) : null}
      {secondaryItems.map((item) => (
        <KPICard key={item.id} item={item} compact />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
  },
});
