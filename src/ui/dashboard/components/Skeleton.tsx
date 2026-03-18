import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import type { DimensionValue, ViewStyle, StyleProp } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Skeleton({ width = "100%", height = 16, radius = 12, style }: Props): JSX.Element {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.base, { width, height, borderRadius: radius, opacity }, style]} />
  );
}

export function SkeletonBlock({ height = 120 }: { height?: number }): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={styles.block}>
      <Skeleton height={height} radius={tokens.radius.md} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  block: {
    overflow: "hidden",
  },
});
