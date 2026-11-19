import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { KPIItem } from "@/ui/dashboard/types";
import KPICard from "@/ui/dashboard/components/KPICard";

type Props = {
  items: KPIItem[];
};

export default function KPIStrip({ items }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const primaryItems = items.filter((item) => item.id === "liquidity" || item.id === "investments" || item.id === "pension");
  const secondaryItems = items.filter((item) => item.id !== "liquidity" && item.id !== "investments" && item.id !== "pension");
  const selected = primaryItems.find((item) => item.id === expandedId);
  const ordered = selected ? primaryItems.filter((item) => item.id !== selected.id) : primaryItems;
  const columns = selected ? Math.max(1, primaryItems.length - 1) : primaryItems.length;

  return (
    <View style={[styles.container, { gap: tokens.spacing.sm }]}>
      {primaryItems.length > 0 ? (
        <View style={{ gap: tokens.spacing.sm }}>
        {selected ? <View style={styles.row}><KPICard key={selected.id} item={selected} emphasizeValue expanded onToggle={() => setExpandedId(null)} rowWidth="100%" /></View> : null}
        <View style={[styles.row, { gap: tokens.spacing.sm }]}>
          {ordered.map((item) => (
            <KPICard key={item.id} item={item} emphasizeValue expanded={false} onToggle={() => setExpandedId(item.id)} rowWidth="0%" dense={columns > 2} />
          ))}
        </View>
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
    alignItems: "stretch",
  },
});
