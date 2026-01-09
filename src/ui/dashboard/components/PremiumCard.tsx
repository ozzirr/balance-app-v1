import React from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle, StyleProp } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function PremiumCard({ children, style }: Props): JSX.Element {
  const { tokens, shadows } = useDashboardTheme();
  return (
    <View
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.border, borderRadius: tokens.radius.md },
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: "rgba(255,255,255,0.05)" }]} />
      <View pointerEvents="none" style={[styles.accentGlow, { backgroundColor: `${tokens.colors.accent}18` }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    top: -90,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ rotate: "-8deg" }],
  },
  accentGlow: {
    position: "absolute",
    right: -60,
    bottom: -80,
    width: 220,
    height: 220,
    borderRadius: 140,
  },
});
