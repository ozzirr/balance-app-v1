import React from "react";
import { StyleSheet, View } from "react-native";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  children: React.ReactNode;
};

export default function AppBackground({ children }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.bg }]}>
      <View pointerEvents="none" style={[styles.orbTop, { backgroundColor: `${tokens.colors.accent}0D` }]} />
      <View pointerEvents="none" style={[styles.orbBottom, { backgroundColor: `${tokens.colors.income}0A` }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orbTop: {
    position: "absolute",
    top: -120,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -140,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(120,96,255,0.12)",
  },
});
