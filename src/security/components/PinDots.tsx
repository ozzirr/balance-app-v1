import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";

type Props = {
  length: number;
  filled: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export default function PinDots({
  length,
  filled,
  color = "#C1A4FF",
  style,
}: Props): JSX.Element {
  const dots = Array.from({ length }, (_, index) => index < filled);
  return (
    <View style={[styles.row, style]}>
      {dots.map((active, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            {
              borderColor: color,
              backgroundColor: active ? color : "transparent",
              shadowColor: active ? color : "#000",
            },
            active ? styles.dotFilled : styles.dotEmpty,
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
    gap: 22,
    marginVertical: 14,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  dotEmpty: {
    opacity: 0.6,
  },
  dotFilled: {
    opacity: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 20,
    elevation: 8,
    backgroundColor: "#C1A4FF",
  },
});
