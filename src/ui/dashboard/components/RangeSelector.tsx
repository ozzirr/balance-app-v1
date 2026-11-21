import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/ui/components/BottomSheet";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props<T extends string> = {
  selectedRange: T;
  onChangeRange: (range: T) => void;
  options: { value: T; label: string }[];
};

export default function RangeSelector<T extends string>({ selectedRange, onChangeRange, options }: Props<T>) {
  const { tokens: { colors } } = useDashboardTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === selectedRange);
  return (
    <>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.muted }]}>{t("dashboard.range.label")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.range.title")}
          accessibilityValue={{ text: selected?.label }} accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)} style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
          <MaterialCommunityIcons name="calendar-range" size={17} color={colors.accent} />
          <Text style={[styles.value, { color: colors.text }]}>{selected?.label}</Text>
          <MaterialCommunityIcons name="chevron-down" size={17} color={colors.muted} />
        </Pressable>
      </View>
      <BottomSheet visible={open} title={t("dashboard.range.title")} subtitle={t("dashboard.range.subtitle")} onClose={() => setOpen(false)}>
        {options.map(({ value, label }) => (
          <Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: value === selectedRange }}
            onPress={() => { setOpen(false); onChangeRange(value); }} style={styles.option}>
            <Text style={[styles.value, { color: colors.text }]}>{label}</Text>
            {value === selectedRange && <MaterialCommunityIcons name="check" size={21} color={colors.accent} />}
          </Pressable>
        ))}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, minHeight: 44, paddingHorizontal: 12 },
  value: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, minHeight: 48 },
});
