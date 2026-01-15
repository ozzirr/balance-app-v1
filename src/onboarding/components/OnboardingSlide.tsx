import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { SlideData } from "@/onboarding/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  slide: SlideData;
};

export default function OnboardingSlide({ slide }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.text }]}>{slide.title}</Text>
      <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{slide.subtitle}</Text>
      <View style={styles.bullets}>
        {slide.bullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: tokens.colors.accent }]} />
            <Text style={[styles.bulletText, { color: tokens.colors.text }]}>{bullet}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  bullets: {
    gap: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
