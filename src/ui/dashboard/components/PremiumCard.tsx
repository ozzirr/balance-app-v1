import React from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle, StyleProp } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTheme } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hideDecorations?: boolean;
};

export default function PremiumCard({ children, style, hideDecorations = false }: Props): JSX.Element {
  const { tokens, shadows } = useDashboardTheme();
  const paperTheme = useTheme();
  const tint = paperTheme.dark ? "dark" : "light";
  return (
    <View
      style={[
        styles.card,
        shadows.card,
        { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.border, borderRadius: tokens.radius.md },
        style,
      ]}
    >
      <GlassBlur intensity={32} tint={tint} fallbackColor={tokens.colors.glassBg} />
      {!hideDecorations ? (
        <>
          <View pointerEvents="none" style={[styles.highlight, { backgroundColor: "rgba(255,255,255,0.05)" }]} />
          <View pointerEvents="none" style={[styles.accentGlow, { backgroundColor: `${tokens.colors.accent}18` }]} />
        </>
      ) : null}
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
