import React from "react";
import { Platform, StyleSheet } from "react-native";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "react-native-paper";

type Props = {
  intensity?: number;
  tint?: "light" | "dark";
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
  pointerEvents?: ViewProps["pointerEvents"];
};

export default function GlassBlur({
  intensity = 32,
  tint,
  style,
  pointerEvents = "none",
}: Props): JSX.Element {
  const theme = useTheme();
  const resolvedTint = tint ?? (theme.dark ? "dark" : "light");

  if (Platform.OS === "android") {
    return null;
  }

  return (
    <BlurView
      intensity={intensity}
      tint={resolvedTint}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={pointerEvents}
    />
  );
}
