import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
};

export default function SectionHeader({ title, subtitle, trailing }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  trailing: {
    marginLeft: 12,
  },
});
