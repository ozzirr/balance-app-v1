import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";

type Props = {
  length: number;
  filled: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export default function PinDots({ length, filled, color = "#A97CFF", style }: Props): JSX.Element {
  const dots = Array.from({ length }, (_, index) => index < filled);
  return (
    <View style={[styles.row, style]}>
      {dots.map((active, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            { borderColor: color, backgroundColor: active ? color : "transparent" },
            active && styles.dotFilled,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginVertical: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.8,
  },
  dotFilled: {
    opacity: 1,
  },
});
