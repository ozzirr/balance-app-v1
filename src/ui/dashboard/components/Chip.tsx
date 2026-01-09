import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  label: string;
  tone?: "green" | "red" | "blue" | "muted";
  color?: string;
};

export default function Chip({ label, tone = "muted", color }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const colorMap = {
    green: tokens.colors.green,
    red: tokens.colors.red,
    blue: tokens.colors.blue,
    muted: tokens.colors.muted,
  };
  const tint = color ?? colorMap[tone];
  return (
    <View style={[styles.chip, { borderColor: tint, backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.text, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
