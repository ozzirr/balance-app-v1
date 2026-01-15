import React from "react";
import { StyleSheet, View } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  count: number;
  activeIndex: number;
};

export default function OnboardingDots({ count, activeIndex }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            {
              opacity: activeIndex === index ? 1 : 0.35,
              backgroundColor: tokens.colors.accent,
            },
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
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
