import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import type { StyleProp } from "react-native";
import { Card, useTheme } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassCard({ children, style }: Props): JSX.Element {
  const theme = useTheme();
  const isDark = theme.dark;
  const tint = isDark ? "dark" : "light";
  const cardBackground = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)";
  return (
    <View style={[styles.wrap, { borderColor: theme.colors.outline }, style]}>
      <GlassBlur
        intensity={28}
        tint={tint}
        fallbackColor={isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)"}
      />
      <Card style={[styles.card, { backgroundColor: cardBackground }]} mode="contained">
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
  },
});
