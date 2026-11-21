import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  labelKey: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
};

export default function HeaderAction({ icon, labelKey, onPress }: Props) {
  const { t } = useTranslation();
  const { tokens: { colors } } = useDashboardTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t(labelKey)} onPress={onPress}
      style={({ pressed }) => [styles.target, pressed && styles.pressed]}>
      <View style={[styles.circle, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.65 },
});
